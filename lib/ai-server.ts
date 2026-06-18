// Server-only AI integration (Google Gemini). This is the ONLY place the Gemini
// SDK is instantiated and the API key is read — it must never be imported by
// client components (the `server-only` guard enforces that at build time). The
// browser talks to this exclusively through the app/api/ai/* route handlers.

import 'server-only';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { GEMINI_MODEL, type GroundingSource, type ChatMessage } from './ai';

// Build the server-side SDK client. Reads the key from the server environment
// only — GEMINI_API_KEY (preferred), with fallbacks for the common alternate
// names so existing project config keeps working. Never exposed to the browser.
export function makeGeminiClient(): GoogleGenAI {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;
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

// Dedup-and-accumulate sources by URI + normalized title.
class SourceCollector {
  private map = new Map<string, GroundingSource>();
  private lastEmitted = 0;

  add(uri?: string | null, title?: string | null) {
    if (!uri) return;
    const t = (title || '').trim() || uri;
    const key = `${uri}::${t.toLowerCase()}`;
    if (!this.map.has(key)) this.map.set(key, { uri, title: t });
  }

  /** True if new sources were added since the last time this returned true. */
  changed(): boolean {
    if (this.map.size > this.lastEmitted) {
      this.lastEmitted = this.map.size;
      return true;
    }
    return false;
  }

  list(): GroundingSource[] {
    return Array.from(this.map.values());
  }
}

// Newline-delimited events the stream route forwards to the browser.
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'sources'; sources: GroundingSource[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

// Run a single-turn streaming Gemini request with HIGH thinking and (optionally)
// Google Search grounding, invoking `onEvent` for each semantic event. Used by
// the /api/ai/stream route to pipe events back to the browser.
export async function runAIStream(opts: {
  system: string;
  messages: ChatMessage[];
  webSearch?: boolean;
  onEvent: (e: StreamEvent) => void;
}): Promise<void> {
  const { system, messages, webSearch = false, onEvent } = opts;

  const ai = makeGeminiClient();
  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: system,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      // Google Search grounding so answers cite real FDA labels, PubMed
      // articles, and society guidelines with verifiable URLs.
      ...(webSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  const sources = new SourceCollector();

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
    // Collect grounding chunks for verifiable, clickable sources.
    const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    for (const gc of groundingChunks) {
      const web = (gc as any).web ?? (gc as any).retrievedContext;
      sources.add(web?.uri, web?.title);
    }
    if (sources.changed()) onEvent({ type: 'sources', sources: sources.list() });
  }

  // Final flush in case the very last chunk added new sources.
  if (sources.changed()) onEvent({ type: 'sources', sources: sources.list() });
}
