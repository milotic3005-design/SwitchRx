import type { LookupResult } from '@/lib/pharmacy-lookup';
import type { CopilotTurn } from './types';

export type StepState = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

export interface StepStates {
  running: boolean;
  drugs: StepState;
  fda: StepState;
  search: StepState;
  done: StepState;
  /** The lookup finished but named no drug, so nothing was checked against FDA labels. */
  noDrugs: boolean;
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

const isRunning = (turn: CopilotTurn): boolean =>
  turn.status === 'lookup' || turn.status === 'streaming' || turn.status === 'resolving';

/**
 * Where each of the timeline's four steps stands, from the turn's status, the state of its pharmacy lookup,
 * and the lookup it shows (`effectiveLookup`). A lookup that worked but named no drug leaves the drug and
 * FDA steps skipped rather than done.
 */
export function stepStates(turn: CopilotTurn, lookup: LookupResult | null): StepStates {
  const running = isRunning(turn);
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
    turn.status === 'done'
      ? 'done'
      : turn.status === 'streaming' || turn.status === 'resolving'
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
    done: turn.status === 'done' ? 'done' : running ? 'pending' : 'skipped',
    noDrugs,
  };
}

/** A finished answer that came back without a single source, so nothing in it is cited. */
export function answeredWithoutSources(turn: CopilotTurn): boolean {
  return turn.status === 'done' && turn.answer.trim() !== '' && turn.sources.length === 0;
}
