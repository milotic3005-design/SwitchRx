// Server-only Claude integration. This is the ONLY place the Anthropic SDK is
// instantiated and the API key is read — it must never be imported by client
// components (the `server-only` guard enforces that at build time). The browser
// talks to this exclusively through the app/api/claude/* route handlers.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL, type GroundingSource } from './claude';

// The web_search tool definition (current version). Pass in `tools` to let the
// model search live and return verifiable source URLs.
export const WEB_SEARCH_TOOL = {
  type: 'web_search_20260209' as const,
  name: 'web_search' as const,
};

// Build the server-side SDK client. Reads the secret key from the server
// environment only — ANTHROPIC_API_KEY (preferred) with a NEXT_PUBLIC fallback
// for backwards compatibility. No `dangerouslyAllowBrowser`: this only ever runs
// on the server.
export function makeServerClient(): Anthropic {
  const apiKey =
    process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set on the server. Add it to the Vercel project (and .env.local for local dev).',
    );
  }
  return new Anthropic({ apiKey });
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

// Run a single-turn streaming Claude request with adaptive thinking and
// (optionally) web search, invoking `onEvent` for each semantic event. Used by
// the /api/claude/stream route to pipe events back to the browser.
//
// `display: 'summarized'` on thinking is required — Opus 4.8 omits thinking text
// by default, so without it the AI-reasoning panel would stay empty.
export async function runClaudeStream(opts: {
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  webSearch?: boolean;
  onEvent: (e: StreamEvent) => void;
}): Promise<void> {
  const { system, messages, maxTokens = 8000, webSearch = false, onEvent } = opts;

  const client = makeServerClient();
  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive', display: 'summarized' },
    system,
    messages,
    ...(webSearch ? { tools: [WEB_SEARCH_TOOL] } : {}),
  });

  const sources = new SourceCollector();

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      // Web search results arrive as a complete block — harvest every URL.
      const block: any = event.content_block;
      if (block?.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) sources.add(r?.url, r?.title);
        if (sources.changed()) onEvent({ type: 'sources', sources: sources.list() });
      }
    } else if (event.type === 'content_block_delta') {
      const delta: any = event.delta;
      if (delta.type === 'text_delta') {
        onEvent({ type: 'text', delta: delta.text });
      } else if (delta.type === 'thinking_delta') {
        onEvent({ type: 'thinking', delta: delta.thinking });
      } else if (delta.type === 'citations_delta') {
        const c = delta.citation;
        sources.add(c?.url, c?.title);
        if (sources.changed()) onEvent({ type: 'sources', sources: sources.list() });
      }
    }
  }

  // Final flush in case the last block added sources.
  if (sources.changed()) onEvent({ type: 'sources', sources: sources.list() });
}
