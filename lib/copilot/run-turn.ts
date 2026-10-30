import type { CitationSupport, GroundingSource } from '@/lib/ai';
import { formatLookupForPrompt, type LookupResult } from '@/lib/pharmacy-lookup';
import { splitFollowUps } from './followups';
import { titleFdaLabels } from './label-titles';
import { titleWebSources } from './path-title';
import { buildCopilotRequest, type CopilotRequest } from './request';
import { fallbackSource } from './source-types';
import { namesDrug } from './turn-status';
import type { CopilotTurn, Depth, EnrichedSource, LookupState, TurnPatch } from './types';

/** The three backend calls one Copilot question needs (real backend or the dev-only demo). */
export interface CopilotTransport {
  lookup(question: string, signal: AbortSignal): Promise<LookupResult | null>;
  stream(
    req: CopilotRequest,
    cb: {
      onText(full: string): void;
      onSources(s: GroundingSource[]): void;
      onSupports(s: CitationSupport[]): void;
    },
    signal: AbortSignal,
  ): Promise<void>;
  resolve(sources: GroundingSource[], signal: AbortSignal): Promise<EnrichedSource[]>;
}

/** How long the answer waits for the pharmacy lookup before going ahead without it. */
export const LOOKUP_TIMEOUT_MS = 12_000;

interface LookupOutcome {
  lookup: LookupResult | null;
  lookupState: Exclude<LookupState, 'pending'>;
}

/** Settles like `promise`, or rejects as soon as `signal` aborts, whether or not `promise` honors it. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * Runs the pharmacy lookup, giving up after `timeoutMs`. A lookup that fails, returns nothing, or
 * arrives after the timeout is not used.
 */
async function lookupWithin(
  t: CopilotTransport,
  question: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<LookupOutcome> {
  // The executor turns a synchronous throw from the transport into a failed lookup.
  const attempt = new Promise<LookupResult | null>((resolve) => resolve(t.lookup(question, signal))).then(
    (lookup): LookupOutcome => (lookup ? { lookup, lookupState: 'ok' } : { lookup: null, lookupState: 'failed' }),
    (): LookupOutcome => ({ lookup: null, lookupState: 'failed' }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<LookupOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ lookup: null, lookupState: 'timeout' }), timeoutMs);
  });
  try {
    return await untilAborted(Promise.race([attempt, timeout]), signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A follow-up such as "What if they had a reaction last time?" names no drug, so its own lookup comes back
 * empty. Then the most recent earlier turn whose own lookup named a drug stands in for it (a turn that itself
 * reused one is passed over, so references never chain). A follow-up that names any drug keeps its own lookup
 * and safety flags, even when openFDA had no label for it; a failed or timed-out lookup is never replaced, so
 * the timeline still says the lookup was unavailable.
 */
function reusableTurn(outcome: LookupOutcome, history: CopilotTurn[]): CopilotTurn | undefined {
  if (outcome.lookupState !== 'ok' || namesDrug(outcome.lookup)) return undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    if (namesDrug(history[i].lookup)) return history[i];
  }
  return undefined;
}

const errorMessage = (err: unknown): string =>
  (err instanceof Error ? err.message : typeof err === 'string' ? err : '') || 'The answer could not be completed.';

/**
 * Drives one question from start to finish, reporting progress as patches to the turn:
 * pharmacy lookup (at most `lookupTimeoutMs`) → streamed answer → source resolution → done.
 *
 * - A lookup that works but names no drug is stood in for by the most recent earlier turn in `history`
 *   whose own lookup named one: the turn records that turn's id (`lookupFromTurnId`), and that lookup
 *   feeds the prompt and FDA-label titling.
 * - While streaming, `answer` is the text with any follow-up block hidden, and `sources` are
 *   fallbacks built from the grounding sources; once the stream ends the follow-ups are parsed.
 * - Resolved sources are retitled: FDA labels for a looked-up drug, then bare-domain titles from the link's path.
 * - If source resolution fails, the fallback sources are kept and the turn still ends `done`.
 * - If the stream fails, the turn ends `error` with the message, keeping the partial answer.
 * - When `signal` aborts, `{ status: 'stopped' }` is reported at once (the partial answer is kept),
 *   and nothing is reported after it, even if the transport keeps calling back.
 *
 * `{ status: 'done' | 'stopped' | 'error' }` is always the last patch. The returned promise never rejects.
 */
export async function runTurn(
  t: CopilotTransport,
  input: { history: CopilotTurn[]; question: string; depth: Depth },
  onUpdate: (patch: TurnPatch) => void,
  signal: AbortSignal,
  opts: { lookupTimeoutMs?: number; now?: () => number } = {},
): Promise<void> {
  const { history, question, depth } = input;
  const { lookupTimeoutMs = LOOKUP_TIMEOUT_MS, now = Date.now } = opts;

  let ended = false;
  const update = (patch: TurnPatch) => {
    if (!ended) onUpdate(patch);
  };
  const end = (patch: TurnPatch) => {
    if (ended) return;
    ended = true;
    onUpdate(patch);
  };
  const stop = () => end({ status: 'stopped' });

  if (signal.aborted) return stop();
  signal.addEventListener('abort', stop, { once: true });

  try {
    update({ status: 'lookup', lookupState: 'pending' });
    const own = await lookupWithin(t, question, signal, lookupTimeoutMs);
    const from = reusableTurn(own, history);
    // The turn records only which turn's lookup it used; that lookup is not copied into it.
    update(from ? { ...own, lookupFromTurnId: from.id } : { ...own });
    const lookup = from ? from.lookup : own.lookup;

    update({ status: 'streaming' });
    const req = buildCopilotRequest({
      history,
      question,
      depth,
      lookupContext: lookup ? formatLookupForPrompt(lookup) : '',
    });

    let text = '';
    let sources: GroundingSource[] = [];
    let firstTokenAt: number | undefined;
    let streaming = true;
    try {
      await untilAborted(
        t.stream(
          req,
          {
            onText: (full) => {
              if (!streaming) return;
              text = full;
              firstTokenAt ??= now();
              update({ answer: splitFollowUps(full).body, firstTokenAt });
            },
            onSources: (list) => {
              if (!streaming) return;
              sources = list;
              update({ sources: list.map(fallbackSource) });
            },
            onSupports: (list) => {
              if (streaming) update({ supports: list });
            },
          },
          signal,
        ),
        signal,
      );
    } finally {
      streaming = false;
    }

    const final = splitFollowUps(text, true);
    update({ answer: final.body, followUps: final.followUps, status: 'resolving' });

    if (sources.length > 0) {
      try {
        const enriched = await untilAborted(t.resolve(sources, signal), signal);
        // FDA labels first, so a matched label keeps its "prescribing information" title.
        update({ sources: titleWebSources(titleFdaLabels(enriched, lookup)) });
      } catch {
        // Keep the fallback sources; an abort was already reported as stopped.
        if (signal.aborted) return;
      }
    }
    end({ status: 'done' });
  } catch (err) {
    if (!signal.aborted) end({ status: 'error', error: errorMessage(err) });
  } finally {
    signal.removeEventListener('abort', stop);
  }
}
