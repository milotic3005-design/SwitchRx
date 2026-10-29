// Server-only AI integration (Google Gemini). This is the ONLY place the Gemini
// SDK is instantiated and the API key is read — it must never be imported by
// client components (the `server-only` guard enforces that at build time). The
// browser talks to this exclusively through the app/api/ai/* route handlers.

import 'server-only';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { GEMINI_MODEL, type GroundingSource, type CitationSupport, type ChatMessage } from './ai';
import { SourceCollector, SupportCollector, chunkSource, mapSupports } from './grounding';

// Build the server-side SDK client. Reads the key from the server environment
// only — GEMINI_API_KEY (preferred), with fallbacks for the common alternate
// SERVER-SIDE names so existing project config keeps working. Never a
// NEXT_PUBLIC_ var: those are inlined into the client bundle by Next.js, which
// would leak the key to every visitor (see .env.example).
export function makeGeminiClient(): GoogleGenAI {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set on the server. Add it to the Vercel project (and .env.local for local dev).',
    );
  }
  return new GoogleGenAI({ apiKey });
}

// Convert the provider-neutral ChatMessage[] (the wire format from the browser)
// into Gemini `contents`. role assistant -> model; text/image/document blocks
// map to text / inlineData parts.
type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages.map((m) => {
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
    if (typeof m.content === 'string') {
      return { role, parts: [{ text: m.content }] };
    }
    const parts: GeminiPart[] = m.content.map((b) => {
      if (b.type === 'text') return { text: b.text };
      // image / document -> inline base64 data part
      return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
    });
    return { role, parts };
  });
}

// Newline-delimited events the stream route forwards to the browser.
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'sources'; sources: GroundingSource[] }
  | { type: 'supports'; supports: CitationSupport[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

// Run a single-turn streaming Gemini request with HIGH thinking (LOW when asked)
// and (optionally) Google Search grounding, invoking `onEvent` for each semantic
// event. Used by the /api/ai/stream route to pipe events back to the browser.
export async function runAIStream(opts: {
  system: string;
  messages: ChatMessage[];
  webSearch?: boolean;
  thinkingLevel?: 'low' | 'high';
  onEvent: (e: StreamEvent) => void;
}): Promise<void> {
  const { system, messages, webSearch = false, thinkingLevel, onEvent } = opts;

  const ai = makeGeminiClient();
  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: system,
      thinkingConfig: {
        thinkingLevel: thinkingLevel === 'low' ? ThinkingLevel.LOW : ThinkingLevel.HIGH,
      },
      // Google Search grounding so answers cite real FDA labels, PubMed
      // articles, and society guidelines with verifiable URLs.
      ...(webSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  const sources = new SourceCollector();
  const supports = new SupportCollector();

  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        const text = (part as any).text as string | undefined;
        if (!text) continue;
        if ((part as any).thought) {
          onEvent({ type: 'thinking', delta: text });
        } else {
          onEvent({ type: 'text', delta: text });
        }
      }
    }
    // Collect grounding chunks for verifiable, clickable sources, then the
    // supports (which sentence is backed by which sources) against that list.
    const metadata = chunk.candidates?.[0]?.groundingMetadata;
    for (const gc of metadata?.groundingChunks ?? []) {
      const src = chunkSource(gc);
      sources.add(src?.uri, src?.title);
    }
    // Sources go out before the supports that index into them.
    if (sources.changed()) onEvent({ type: 'sources', sources: sources.list() });
    if (metadata && supports.add(mapSupports(metadata, sources))) {
      onEvent({ type: 'supports', supports: supports.list() });
    }
  }

  // Final flush in case the very last chunk added new sources.
  if (sources.changed()) onEvent({ type: 'sources', sources: sources.list() });
}
