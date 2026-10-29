// Grounding helpers shared by the Gemini stream (lib/ai-server.ts). Kept free of
// the `server-only` import so they can be unit-tested.
//
// Gemini reports grounding as a list of chunks (the sources) plus a list of
// "supports": a sentence of the answer and the chunk indices that back it. Those
// indices point into the chunk list of the metadata they arrived with, so they
// must be translated to positions in our de-duplicated sources list before the
// browser can use them to place citation chips.

import type { GroundingSource, CitationSupport } from './ai';

type ChunkSource = { uri?: string | null; title?: string | null };

// The subset of Gemini's groundingMetadata this module reads.
export type GroundingMetadataLike = {
  groundingChunks?: { web?: ChunkSource; retrievedContext?: ChunkSource }[];
  groundingSupports?: { segment?: { text?: string }; groundingChunkIndices?: number[] }[];
};

/** The one place a grounding chunk is resolved to its {uri, title}. */
export function chunkSource(gc: unknown): ChunkSource | undefined {
  const c = gc as { web?: ChunkSource; retrievedContext?: ChunkSource } | null | undefined;
  return c?.web ?? c?.retrievedContext;
}

// Dedup-and-accumulate sources by URI + normalized title.
export class SourceCollector {
  private index = new Map<string, number>();
  private sources: GroundingSource[] = [];
  private lastEmitted = 0;

  /** Adds a source and returns its position in `list()`, or -1 if it has no uri. */
  add(uri?: string | null, title?: string | null): number {
    if (!uri) return -1;
    const t = (title || '').trim() || uri;
    const key = `${uri}::${t.toLowerCase()}`;
    const existing = this.index.get(key);
    if (existing !== undefined) return existing;
    const i = this.sources.length;
    this.index.set(key, i);
    this.sources.push({ uri, title: t });
    return i;
  }

  /** True if new sources were added since the last time this returned true. */
  changed(): boolean {
    if (this.sources.length > this.lastEmitted) {
      this.lastEmitted = this.sources.length;
      return true;
    }
    return false;
  }

  list(): GroundingSource[] {
    return this.sources.slice();
  }
}

/**
 * Translates Gemini's groundingSupports into CitationSupports whose indices
 * point into `collector.list()`. Chunk indices are looked up in this metadata's
 * own chunk list, resolved like the sources list resolves them, and registered
 * with the collector (so the result is always valid against its list).
 * Out-of-range or uri-less chunks are dropped, repeated sources collapse, and
 * supports left with no text or no sources are omitted.
 */
export function mapSupports(metadata: GroundingMetadataLike, collector: SourceCollector): CitationSupport[] {
  const chunks = metadata.groundingChunks ?? [];
  const out: CitationSupport[] = [];
  for (const support of metadata.groundingSupports ?? []) {
    const text = support.segment?.text;
    if (!text || !text.trim()) continue;
    const sourceIndices: number[] = [];
    for (const chunkIndex of support.groundingChunkIndices ?? []) {
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= chunks.length) continue;
      const src = chunkSource(chunks[chunkIndex]);
      const position = collector.add(src?.uri, src?.title);
      if (position >= 0 && !sourceIndices.includes(position)) sourceIndices.push(position);
    }
    if (sourceIndices.length) out.push({ text, sourceIndices });
  }
  return out;
}

// Accumulates supports across streamed chunks, de-duplicated by sentence text
// (the first one seen wins).
export class SupportCollector {
  private byText = new Map<string, CitationSupport>();

  /** Adds supports; true if any new text was added. */
  add(supports: CitationSupport[]): boolean {
    let changed = false;
    for (const s of supports) {
      if (this.byText.has(s.text)) continue;
      this.byText.set(s.text, s);
      changed = true;
    }
    return changed;
  }

  list(): CitationSupport[] {
    return Array.from(this.byText.values());
  }
}
