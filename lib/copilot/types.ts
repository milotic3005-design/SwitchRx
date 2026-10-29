import type { CitationSupport } from '@/lib/ai';
import type { LookupResult } from '@/lib/pharmacy-lookup';

export type Depth = 'quick' | 'thorough';

export type SourceType =
  | 'fda-label'
  | 'guideline'
  | 'systematic-review'
  | 'trial'
  | 'journal'
  | 'agency'
  | 'web';

export interface EnrichedSource {
  /** The grounding URI the model cited (normally a Vertex redirect). */
  uri: string;
  /** The resolved destination URL, or null when it could not be resolved. */
  url: string | null;
  site: string;
  title: string;
  shortName: string;
  journal?: string;
  year?: number;
  authors?: string;
  pmid?: string;
  type: SourceType;
}

export type TurnStatus = 'lookup' | 'streaming' | 'resolving' | 'done' | 'stopped' | 'error';

export type LookupState = 'pending' | 'ok' | 'failed' | 'timeout';

export interface CopilotTurn {
  id: string;
  question: string;
  depth: Depth;
  askedAt: number;
  status: TurnStatus;
  answer: string;
  followUps: string[];
  supports: CitationSupport[];
  sources: EnrichedSource[];
  lookup: LookupResult | null;
  lookupState: LookupState;
  firstTokenAt?: number;
  error?: string;
}

export type TurnPatch = Partial<Omit<CopilotTurn, 'id' | 'question' | 'depth' | 'askedAt'>>;

export interface CopilotThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: CopilotTurn[];
}
