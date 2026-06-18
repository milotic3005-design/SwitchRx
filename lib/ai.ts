// Client-safe AI helpers for the clinical tools.
//
// The model (Google Gemini) is NEVER called directly from the browser. All AI
// traffic goes through server-side Next.js API routes (app/api/ai/*) that hold
// GEMINI_API_KEY server-side — so the key never ships in the client bundle.
// This module only contains the browser-side fetch wrapper + shared types/const.
// The server half (Gemini SDK) lives in lib/ai-server.ts.
//
// Model: gemini-3.1-pro-preview with HIGH thinking. Verified sources are
// preserved via Gemini's Google Search grounding — every groundingChunk carries
// a real URL + title, surfaced as clickable [N] citations.

export const GEMINI_MODEL = 'gemini-3.1-pro-preview';

// A normalized source the UI renders in its "Verified Sources" list.
export type GroundingSource = { uri: string; title: string };

// Provider-neutral chat message shape (mirrors the structure components already
// build). Content is either a plain string or an array of typed blocks so
// images / PDFs can be attached. The server translates this to Gemini `contents`.
export type TextBlock = { type: 'text'; text: string };
export type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
};
export type DocumentBlock = {
  type: 'document';
  source: { type: 'base64'; media_type: string; data: string };
};
export type ContentBlock = TextBlock | ImageBlock | DocumentBlock;
export type ChatMessage = { role: 'user' | 'assistant'; content: string | ContentBlock[] };

export type StreamCallbacks = {
  onText?: (full: string, delta: string) => void;
  onThinking?: (full: string, delta: string) => void;
  onSources?: (sources: GroundingSource[]) => void;
};

// Run a single-turn streaming AI request with HIGH thinking and (optionally)
// Google Search grounding — via the server route. Streams text, thinking, and
// verified sources to the provided callbacks. Returns the final assembled text.
//
// The server route emits newline-delimited JSON events; we reconstruct the
// running text/thinking here so the callback contract is (onText(full, delta),
// onThinking(full, delta), onSources(list)).
export async function streamAI(opts: {
  system: string;
  prompt: string | ChatMessage[];
  maxTokens?: number;
  webSearch?: boolean;
  cb?: StreamCallbacks;
  signal?: AbortSignal;
}): Promise<{ text: string; thinking: string; sources: GroundingSource[] }> {
  const { system, prompt, maxTokens = 8000, webSearch = false, cb, signal } = opts;

  const messages: ChatMessage[] =
    typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;

  const res = await fetch('/api/ai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, maxTokens, webSearch }),
    signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `AI request failed (${res.status} ${res.statusText})${detail ? `: ${detail}` : ''}`,
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
        errorMsg = evt.message || 'AI stream error';
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
