// Shared Anthropic (Claude) client + streaming helpers for the clinical tools.
//
// The app runs the model directly from the browser (matching the prior Gemini
// setup), so the SDK is constructed with `dangerouslyAllowBrowser: true` and a
// NEXT_PUBLIC_ key. NOTE: this exposes the key in the client bundle — acceptable
// for a local/demo build, but for a public deployment move these calls behind a
// Next.js API route that holds ANTHROPIC_API_KEY server-side.
//
// Model: claude-opus-4-8 with adaptive thinking. Verified sources are preserved
// via Claude's built-in web_search tool — every web_search_tool_result block and
// citations_delta carries a real URL + title, which replaces the Gemini
// "grounding metadata" the UI used to render as clickable [N] citations.

import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-opus-4-8';

// A normalized source the UI renders in its "Verified Sources" list.
export type GroundingSource = { uri: string; title: string };

export function getApiKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ||
    (process.env as any).ANTHROPIC_API_KEY
  );
}

export function makeClient(): Anthropic {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Anthropic API key missing. Set NEXT_PUBLIC_ANTHROPIC_API_KEY in your environment.',
    );
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// The web_search tool definition (current version). Pass in `tools` to let the
// model search live and return verifiable source URLs.
export const WEB_SEARCH_TOOL = {
  type: 'web_search_20260209' as const,
  name: 'web_search' as const,
};

export type StreamCallbacks = {
  onText?: (full: string, delta: string) => void;
  onThinking?: (full: string, delta: string) => void;
  onSources?: (sources: GroundingSource[]) => void;
};

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

  flushIfChanged(cb?: (s: GroundingSource[]) => void) {
    if (cb && this.map.size > this.lastEmitted) {
      cb(this.list());
      this.lastEmitted = this.map.size;
    }
  }

  list(): GroundingSource[] {
    return Array.from(this.map.values());
  }
}

// Run a single-turn streaming Claude request with adaptive thinking and
// (optionally) web search. Streams text, thinking, and verified sources to the
// provided callbacks. Returns the final assembled text.
//
// `display: 'summarized'` on thinking is required — Opus 4.8 omits thinking text
// by default, so without it the AI-reasoning panel would stay empty.
export async function streamClaude(opts: {
  client: Anthropic;
  system: string;
  prompt: string | Anthropic.MessageParam[];
  maxTokens?: number;
  webSearch?: boolean;
  cb?: StreamCallbacks;
}): Promise<{ text: string; thinking: string; sources: GroundingSource[] }> {
  const { client, system, prompt, maxTokens = 8000, webSearch = false, cb } = opts;

  const messages: Anthropic.MessageParam[] =
    typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;

  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive', display: 'summarized' },
    system,
    messages,
    ...(webSearch ? { tools: [WEB_SEARCH_TOOL] } : {}),
  });

  let fullText = '';
  let fullThinking = '';
  const sources = new SourceCollector();

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      // Web search results arrive as a complete block — harvest every URL.
      const block: any = event.content_block;
      if (block?.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) sources.add(r?.url, r?.title);
        sources.flushIfChanged(cb?.onSources);
      }
    } else if (event.type === 'content_block_delta') {
      const delta: any = event.delta;
      if (delta.type === 'text_delta') {
        fullText += delta.text;
        cb?.onText?.(fullText, delta.text);
      } else if (delta.type === 'thinking_delta') {
        fullThinking += delta.thinking;
        cb?.onThinking?.(fullThinking, delta.thinking);
      } else if (delta.type === 'citations_delta') {
        // Inline citations also carry a verifiable URL + title.
        const c = delta.citation;
        sources.add(c?.url, c?.title);
        sources.flushIfChanged(cb?.onSources);
      }
    }
  }

  // Final flush in case the last block added sources.
  sources.flushIfChanged(cb?.onSources);

  return { text: fullText, thinking: fullThinking, sources: sources.list() };
}
