// Client-safe Claude helpers for the clinical tools.
//
// The model is NEVER called directly from the browser. All Claude traffic goes
// through server-side Next.js API routes (app/api/claude/*) that hold
// ANTHROPIC_API_KEY server-side — so the key never ships in the client bundle.
// This module only contains the browser-side fetch wrapper + shared types/const.
// The SDK is imported here for TYPES ONLY (`import type`), which is erased at
// build time and adds nothing to the bundle. The server half lives in
// lib/claude-server.ts.
//
// Model: claude-opus-4-8 with adaptive thinking. Verified sources are preserved
// via Claude's built-in web_search tool — every web_search_tool_result block and
// citations_delta carries a real URL + title, surfaced as clickable [N] citations.

import type Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-opus-4-8';

// A normalized source the UI renders in its "Verified Sources" list.
export type GroundingSource = { uri: string; title: string };

// Re-export the SDK message type so call sites can keep using a single name
// without importing the SDK at runtime themselves.
export type ChatMessage = Anthropic.MessageParam;

export type StreamCallbacks = {
  onText?: (full: string, delta: string) => void;
  onThinking?: (full: string, delta: string) => void;
  onSources?: (sources: GroundingSource[]) => void;
};

// Run a single-turn streaming Claude request with adaptive thinking and
// (optionally) web search — via the server route. Streams text, thinking, and
// verified sources to the provided callbacks. Returns the final assembled text.
//
// The server route emits newline-delimited JSON events; we reconstruct the
// running text/thinking here so the callback contract matches the old in-browser
// SDK helper exactly (onText(full, delta), onThinking(full, delta), onSources).
export async function streamClaude(opts: {
  system: string;
  prompt: string | Anthropic.MessageParam[];
  maxTokens?: number;
  webSearch?: boolean;
  cb?: StreamCallbacks;
  signal?: AbortSignal;
}): Promise<{ text: string; thinking: string; sources: GroundingSource[] }> {
  const { system, prompt, maxTokens = 8000, webSearch = false, cb, signal } = opts;

  const messages: Anthropic.MessageParam[] =
    typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;

  const res = await fetch('/api/claude/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, maxTokens, webSearch }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Claude request failed (${res.status} ${res.statusText})${detail ? `: ${detail}` : ''}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let fullText = '';
  let fullThinking = '';
  let sources: GroundingSource[] = [];
  let errorMsg = '';

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let evt: any;
    try {
      evt = JSON.parse(line);
    } catch {
      return;
    }
    switch (evt.type) {
      case 'text':
        fullText += evt.delta;
        cb?.onText?.(fullText, evt.delta);
        break;
      case 'thinking':
        fullThinking += evt.delta;
        cb?.onThinking?.(fullThinking, evt.delta);
        break;
      case 'sources':
        sources = Array.isArray(evt.sources) ? evt.sources : [];
        cb?.onSources?.(sources);
        break;
      case 'error':
        errorMsg = evt.message || 'Claude stream error';
        break;
      // 'done' — nothing to do; loop ends when the body closes.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      handleLine(line);
    }
  }
  if (buf.trim()) handleLine(buf);

  if (errorMsg) throw new Error(errorMsg);

  return { text: fullText, thinking: fullThinking, sources };
}
