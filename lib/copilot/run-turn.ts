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

/**
 * Resolves `sources` and retitles them: FDA labels for a looked-up drug, then bare-domain titles from the link's
 * path. Null when resolution fails, so the caller keeps the fallbacks; rejects when `signal` aborts.
 */
async function resolveAndTitle(
  t: CopilotTransport,
  sources: GroundingSource[],
  lookup: LookupResult | null,
  signal: AbortSignal,
): Promise<EnrichedSource[] | null> {
  try {
    const enriched = await untilAborted(t.resolve(sources, signal), signal);
    // FDA labels first, so a matched label keeps its "prescribing information" title.
    return titleWebSources(titleFdaLabels(enriched, lookup));
  } catch (err) {
    if (signal.aborted) throw err;
    return null;
  }
}

/**
 * Asks `req` once more for an answer that came back without sources, reporting nothing while it runs. Returns the
 * new answer only when it has text and sources, with the sources resolved and titled (or their fallbacks); null
 * when it has no sources or no text, fails, or is aborted. Never rejects.
 */
async function askAgainForSources(
  t: CopilotTransport,
  req: CopilotRequest,
  lookup: LookupResult | null,
  signal: AbortSignal,
): Promise<TurnPatch | null> {
  if (signal.aborted) return null;
  let text = '';
  let sources: GroundingSource[] = [];
  let supports: CitationSupport[] = [];
  let streaming = true;
  try {
    await untilAborted(
      t.stream(
        req,
        {
          onText: (full) => {
            if (streaming) text = full;
          },
          onSources: (list) => {
            if (streaming) sources = list;
          },
          onSupports: (list) => {
            if (streaming) supports = list;
          },
        },
        signal,
      ),
      signal,
    );
    // Callbacks after the stream has ended (while its sources resolve, say) change nothing.
    streaming = false;
    const final = splitFollowUps(text, true);
    if (sources.length === 0 || final.body.trim() === '') return null;
    const titled = await resolveAndTitle(t, sources, lookup, signal);
    return { answer: final.body, followUps: final.followUps, supports, sources: titled ?? sources.map(fallbackSource) };
  } catch {
    // A failed retry keeps the first answer; a stop has already ended the turn with it.
    return null;
  }
}

const errorMessage = (err: unknown): string =>
  (err instanceof Error ? err.message : typeof err === 'string' ? err : '') || 'The answer could not be completed.';

/**
 * Drives one question from start to finish, reporting progress as patches to the turn:
 * pharmacy lookup (at most `lookupTimeoutMs`) → streamed answer → source resolution (or, for an answer that
 * came back without sources, one source retry) → done.
 *
 * - A lookup that works but names no drug is stood in for by the most recent earlier turn in `history`
 *   whose own lookup named one: the turn records that turn's id (`lookupFromTurnId`), and that lookup
 *   feeds the prompt and FDA-label titling.
 * - While streaming, `answer` is the text with any follow-up block hidden, and `sources` are
 *   fallbacks built from the grounding sources; once the stream ends the follow-ups are parsed.
 * - Resolved sources are retitled: FDA labels for a looked-up drug, then bare-domain titles from the link's path.
 * - If source resolution fails, the fallback sources are kept and the turn still ends `done`.
 * - If the stream fails, the turn ends `error` with the message, keeping the partial answer.
 * - A finished answer with text but no sources (Gemini skipped Google Search) is asked again once, with the
 *   same request and no second lookup: the source retry. The turn is reported `done` with `sourceRetry: true`,
 *   so the first answer is saved and stays on screen, and nothing else is reported until the retry ends. A
 *   retry with text and sources then replaces the answer, follow-ups, supports and sources (resolved and titled
 *   as above) in one patch; any other outcome, an error or a stop included, keeps the first answer. Either way
 *   the turn ends `done` with `sourceRetry: false`.
 * - When `signal` aborts, `{ status: 'stopped' }` is reported at once (the partial answer is kept), or
 *   `{ status: 'done', sourceRetry: false }` during the source retry, and nothing is reported after it,
 *   even if the transport keeps calling back.
 *
 * The last patch always leaves the turn finished (`endsTurn`): `{ status: 'done' | 'stopped' | 'error' }`,
 * plus `sourceRetry: false` once a source retry has begun. The returned promise never rejects.
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
  // Once the source retry begins the first answer is already done, so however the turn ends, it ends done.
  let retrying = false;
  const update = (patch: TurnPatch) => {
    if (!ended) onUpdate(patch);
  };
  const end = (patch: TurnPatch) => {
    if (ended) return;
    ended = true;
    onUpdate(retrying ? { ...patch, sourceRetry: false } : patch);
  };
  const stop = () => end({ status: retrying ? 'done' : 'stopped' });

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

    if (sources.length === 0 && final.body.trim() !== '' && !signal.aborted) {
      // Set first, so a stop that comes with the patch below already ends the turn done.
      retrying = true;
      update({ status: 'done', sourceRetry: true });
      const again = await askAgainForSources(t, req, lookup, signal);
      return end({ status: 'done', ...again });
    }

    if (sources.length > 0) {
      // Null keeps the fallback sources; an abort rejects, and was already reported as stopped.
      const titled = await resolveAndTitle(t, sources, lookup, signal);
      if (titled) update({ sources: titled });
    }
    end({ status: 'done' });
  } catch (err) {
    if (!signal.aborted) end({ status: 'error', error: errorMessage(err) });
  } finally {
    signal.removeEventListener('abort', stop);
  }
}
