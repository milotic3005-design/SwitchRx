import type { LookupResult } from '@/lib/pharmacy-lookup';
import type { CopilotTurn, TurnPatch, TurnStatus } from './types';

export type StepState = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

export interface StepStates {
  running: boolean;
  drugs: StepState;
  fda: StepState;
  search: StepState;
  done: StepState;
  /** The lookup finished but named no drug, so nothing was checked against FDA labels. */
  noDrugs: boolean;
  /** The answer came back without sources and is being asked again (`sourceRetry`). */
  searchingAgain: boolean;
}

/** The statuses an answer ends in. Only turns in one of them are saved: nothing would finish any other after a reload. */
export const FINISHED_STATUSES: ReadonlySet<TurnStatus> = new Set<TurnStatus>(['done', 'stopped', 'error']);

/**
 * Whether a turn is still being worked on: its answer has not finished, or it is a finished answer that came back
 * without sources and is being asked again (`sourceRetry`). The one rule for the Composer's Stop, the timeline and
 * the turn's actions.
 */
export const isRunning = (turn: Pick<CopilotTurn, 'status' | 'sourceRetry'>): boolean =>
  !FINISHED_STATUSES.has(turn.status) || turn.sourceRetry === true;

/** Whether `patch` leaves its turn finished, i.e. is the runner's last update for it. */
export const endsTurn = (patch: TurnPatch): boolean =>
  patch.status !== undefined && !isRunning({ status: patch.status, sourceRetry: patch.sourceRetry });

/**
 * The filter for a run's updates. Until `signal` aborts, every update passes. After it, only the first update that
 * finishes the turn passes (a stop mid-answer ends it as stopped; a stop during the source retry ends it as done
 * with the first answer), and nothing after that, so a late update can never reopen or change a stopped turn.
 */
export function acceptAfterStop(signal: AbortSignal): (patch: TurnPatch) => boolean {
  let ended = false;
  return patch => {
    if (ended) return false;
    if (signal.aborted) {
      if (!endsTurn(patch)) return false;
      ended = true;
    }
    return true;
  };
}

/**
 * Whether the classifier named at least one drug, whether or not openFDA had its label (a 429, a timeout or
 * a combination name also comes back as not found). The one rule for both reusing an earlier turn's lookup
 * and skipping the timeline's drug and FDA steps.
 */
export const namesDrug = (lookup: LookupResult | null): boolean => (lookup?.drug_lookups.length ?? 0) > 0;

/**
 * The lookup a turn's timeline, lookup panel and safety strip show: its own, or the one of the earlier turn
 * it reused (`lookupFromTurnId`). A reference to a turn that is missing, or that has no lookup, shows none.
 * `fromEarlierTurn` is true only when the reference resolved.
 */
export function effectiveLookup(
  turn: CopilotTurn,
  turns: readonly CopilotTurn[],
): { lookup: LookupResult | null; fromEarlierTurn: boolean } {
  if (turn.lookupFromTurnId === undefined) return { lookup: turn.lookup, fromEarlierTurn: false };
  const lookup = turns.find(t => t.id === turn.lookupFromTurnId)?.lookup ?? null;
  return { lookup, fromEarlierTurn: lookup !== null };
}

/**
 * Where each of the timeline's four steps stands, from the turn's status, the state of its pharmacy lookup,
 * and the lookup it shows (`effectiveLookup`). A lookup that worked but named no drug leaves the drug and
 * FDA steps skipped rather than done. While a finished answer is asked again for sources the search is
 * active again and Done waits.
 */
export function stepStates(turn: CopilotTurn, lookup: LookupResult | null): StepStates {
  const running = isRunning(turn);
  const searchingAgain = turn.sourceRetry === true;
  const noDrugs = turn.lookupState === 'ok' && !namesDrug(lookup);
  const lookupStep: StepState =
    turn.lookupState === 'pending'
      ? running
        ? 'active'
        : 'skipped'
      : turn.lookupState !== 'ok'
        ? 'failed'
        : noDrugs
          ? 'skipped'
          : 'done';
  const search: StepState =
    turn.status === 'done' && !searchingAgain
      ? 'done'
      : turn.status === 'streaming' || turn.status === 'resolving' || searchingAgain
        ? 'active'
        : turn.status === 'lookup'
          ? 'pending'
          : 'skipped';
  return {
    running,
    // The drug names come from the same call as the label check, so when it fails there is nothing to report.
    drugs: lookupStep === 'failed' ? 'skipped' : lookupStep,
    fda: lookupStep,
    search,
    done: running ? 'pending' : turn.status === 'done' ? 'done' : 'skipped',
    noDrugs,
    searchingAgain,
  };
}

/**
 * A finished answer that came back without a single source, so nothing in it is cited. Not while it is being
 * asked again for sources: that may still bring some.
 */
export function answeredWithoutSources(turn: CopilotTurn): boolean {
  return turn.status === 'done' && !isRunning(turn) && turn.answer.trim() !== '' && turn.sources.length === 0;
}
