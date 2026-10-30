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

const isRunning = (turn: CopilotTurn): boolean =>
  turn.status === 'lookup' || turn.status === 'streaming' || turn.status === 'resolving';

/**
 * Where each of the timeline's four steps stands, from the turn's status and the state of its pharmacy
 * lookup (after any reuse of an earlier turn's lookup). A lookup that worked but named no drug leaves the
 * drug and FDA steps skipped rather than done.
 */
export function stepStates(turn: CopilotTurn): StepStates {
  const running = isRunning(turn);
  const noDrugs = turn.lookupState === 'ok' && (turn.lookup?.drug_lookups.length ?? 0) === 0;
  const lookup: StepState =
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
    drugs: lookup === 'failed' ? 'skipped' : lookup,
    fda: lookup,
    search,
    done: turn.status === 'done' ? 'done' : running ? 'pending' : 'skipped',
    noDrugs,
  };
}

/** A finished answer that came back without a single source, so nothing in it is cited. */
export function answeredWithoutSources(turn: CopilotTurn): boolean {
  return turn.status === 'done' && turn.answer.trim() !== '' && turn.sources.length === 0;
}
