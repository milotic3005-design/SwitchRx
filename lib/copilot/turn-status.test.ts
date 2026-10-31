import { describe, it, expect } from 'vitest';
import type { LookupResult } from '@/lib/pharmacy-lookup';
import {
  acceptAfterStop,
  answeredWithoutSources,
  effectiveLookup,
  endsTurn,
  isRunning,
  namesDrug,
  stepStates as statesFor,
} from './turn-status';
import { fallbackSource } from './source-types';
import type { CopilotTurn, LookupState, TurnStatus } from './types';

const lookupFor = (...names: string[]): LookupResult => ({
  classification: { drug_names: names, query_domain: 'iv_drug_info', urgency: 'routine' },
  drug_lookups: names.map(generic_name => ({ generic_name, label_sections: [] })),
  safety_flags: [],
  data_sources_used: [],
});

function turn(status: TurnStatus, lookupState: LookupState, extra: Partial<CopilotTurn> = {}): CopilotTurn {
  return {
    id: 't1',
    question: 'How do I prepare infliximab?',
    depth: 'quick',
    askedAt: 1,
    status,
    answer: '',
    followUps: [],
    supports: [],
    sources: [],
    lookup: lookupState === 'ok' ? lookupFor('infliximab') : null,
    lookupState,
    ...extra,
  };
}

/** The step states for a turn showing its own lookup. */
const stepStates = (t: CopilotTurn) => statesFor(t, t.lookup);

describe('namesDrug', () => {
  it('is true when the classifier named a drug, whether or not openFDA had its label', () => {
    expect(namesDrug(lookupFor('infliximab'))).toBe(true);
    const missing = lookupFor('vincristine');
    missing.drug_lookups[0].not_found = true;
    expect(namesDrug(missing)).toBe(true);
  });
  it('is false for a lookup that named no drug, or no lookup', () => {
    expect(namesDrug(lookupFor())).toBe(false);
    expect(namesDrug(null)).toBe(false);
  });
});

describe('effectiveLookup', () => {
  const first = turn('done', 'ok', { id: 't1' });
  const reusing = turn('done', 'ok', { id: 't2', lookup: lookupFor(), lookupFromTurnId: 't1' });

  it('is the turn’s own lookup when it reused none', () => {
    expect(effectiveLookup(first, [first])).toEqual({ lookup: first.lookup, fromEarlierTurn: false });
    expect(effectiveLookup(first, [first]).lookup).toBe(first.lookup);
  });
  it('follows the reference to the earlier turn’s lookup', () => {
    const shown = effectiveLookup(reusing, [first, reusing]);
    expect(shown.lookup).toBe(first.lookup);
    expect(shown.fromEarlierTurn).toBe(true);
  });
  it('shows no lookup when the referenced turn is missing or has none', () => {
    expect(effectiveLookup(reusing, [reusing])).toEqual({ lookup: null, fromEarlierTurn: false });
    const failed = turn('done', 'failed', { id: 't1' });
    expect(effectiveLookup(reusing, [failed, reusing])).toEqual({ lookup: null, fromEarlierTurn: false });
  });
  it('treats a turn saved before references existed as showing its own lookup', () => {
    const { lookupFromTurnId: _unused, ...old } = reusing;
    expect(effectiveLookup(old, [first, old]).lookup).toBe(old.lookup);
  });
});

describe('isRunning', () => {
  it('is true while the answer is in flight and false once it has finished', () => {
    for (const status of ['lookup', 'streaming', 'resolving'] as const) expect(isRunning(turn(status, 'ok')), status).toBe(true);
    for (const status of ['done', 'stopped', 'error'] as const) expect(isRunning(turn(status, 'ok')), status).toBe(false);
  });

  it('is true for a finished answer that is being asked again for sources', () => {
    expect(isRunning(turn('done', 'ok', { answer: 'Infuse over 2 hours.', sourceRetry: true }))).toBe(true);
    expect(isRunning(turn('done', 'ok', { answer: 'Infuse over 2 hours.', sourceRetry: false }))).toBe(false);
  });
});

describe('endsTurn', () => {
  it('is true for the patch that leaves the turn finished', () => {
    expect(endsTurn({ status: 'stopped' })).toBe(true);
    expect(endsTurn({ status: 'error', error: 'boom' })).toBe(true);
    expect(endsTurn({ status: 'done' })).toBe(true);
    expect(endsTurn({ status: 'done', sourceRetry: false })).toBe(true);
  });

  it('is false for a patch that leaves the turn running', () => {
    expect(endsTurn({ answer: 'Partial' })).toBe(false);
    expect(endsTurn({ status: 'resolving' })).toBe(false);
    // The first answer is done, but it is being asked again for sources.
    expect(endsTurn({ status: 'done', sourceRetry: true })).toBe(false);
  });
});

describe('acceptAfterStop', () => {
  it('passes every patch while the run has not been stopped', () => {
    const accept = acceptAfterStop(new AbortController().signal);
    expect(accept({ status: 'streaming' })).toBe(true);
    expect(accept({ answer: 'Partial' })).toBe(true);
    expect(accept({ status: 'done', sourceRetry: true })).toBe(true);
    expect(accept({ status: 'done', sourceRetry: false })).toBe(true);
  });

  it('after a stop, passes only the first patch that finishes the turn, then nothing', () => {
    const controller = new AbortController();
    const accept = acceptAfterStop(controller.signal);
    controller.abort();
    expect(accept({ answer: 'late text' })).toBe(false);
    // A stop during the source retry ends the turn as done with the first answer, not as stopped.
    expect(accept({ status: 'done', sourceRetry: false })).toBe(true);
    expect(accept({ status: 'stopped' })).toBe(false);
    expect(accept({ answer: 'even later' })).toBe(false);
  });

  it('after a stop mid-answer, passes the stopped patch', () => {
    const controller = new AbortController();
    const accept = acceptAfterStop(controller.signal);
    expect(accept({ answer: 'Partial' })).toBe(true);
    controller.abort();
    expect(accept({ status: 'stopped' })).toBe(true);
    expect(accept({ status: 'done' })).toBe(false);
  });
});

describe('stepStates', () => {
  it('shows the lookup in progress, then the search, then done', () => {
    expect(stepStates(turn('lookup', 'pending'))).toEqual({
      running: true,
      drugs: 'active',
      fda: 'active',
      search: 'pending',
      done: 'pending',
      noDrugs: false,
      searchingAgain: false,
    });
    expect(stepStates(turn('streaming', 'ok'))).toMatchObject({ running: true, drugs: 'done', fda: 'done', search: 'active', done: 'pending' });
    expect(stepStates(turn('resolving', 'ok'))).toMatchObject({ running: true, search: 'active', done: 'pending' });
    expect(stepStates(turn('done', 'ok'))).toEqual({
      running: false,
      drugs: 'done',
      fda: 'done',
      search: 'done',
      done: 'done',
      noDrugs: false,
      searchingAgain: false,
    });
  });

  it('marks a failed or timed-out lookup as unavailable and skips the drug step', () => {
    for (const state of ['failed', 'timeout'] as const) {
      expect(stepStates(turn('done', state)), state).toMatchObject({ drugs: 'skipped', fda: 'failed', done: 'done', noDrugs: false });
    }
  });

  it('skips the steps a stopped or failed turn never reached', () => {
    expect(stepStates(turn('stopped', 'pending'))).toMatchObject({
      running: false,
      drugs: 'skipped',
      fda: 'skipped',
      search: 'skipped',
      done: 'skipped',
    });
    expect(stepStates(turn('error', 'ok'))).toMatchObject({ drugs: 'done', fda: 'done', search: 'skipped', done: 'skipped' });
  });

  it('skips the drug and FDA steps when the lookup worked but named no drug', () => {
    const states = stepStates(turn('done', 'ok', { lookup: lookupFor() }));
    expect(states).toEqual({
      running: false,
      drugs: 'skipped',
      fda: 'skipped',
      search: 'done',
      done: 'done',
      noDrugs: true,
      searchingAgain: false,
    });
    // Also while the answer is still streaming.
    expect(stepStates(turn('streaming', 'ok', { lookup: lookupFor() }))).toMatchObject({
      drugs: 'skipped',
      fda: 'skipped',
      search: 'active',
      noDrugs: true,
      searchingAgain: false,
    });
  });

  it('treats an ok lookup with no result as naming no drug', () => {
    expect(stepStates(turn('done', 'ok', { lookup: null }))).toMatchObject({ drugs: 'skipped', fda: 'skipped', noDrugs: true });
  });

  it('reads a reused earlier lookup that names a drug as done', () => {
    const reusing = turn('done', 'ok', { lookup: lookupFor(), lookupFromTurnId: 't0' });
    expect(statesFor(reusing, lookupFor('infliximab'))).toMatchObject({ drugs: 'done', fda: 'done', noDrugs: false });
    // A reference to a turn that is gone shows no lookup, so nothing was checked.
    expect(statesFor(reusing, null)).toMatchObject({ drugs: 'skipped', fda: 'skipped', noDrugs: true });
  });

  it('shows the search as active again while a finished answer is asked again for sources', () => {
    const retrying = turn('done', 'ok', { answer: 'Infuse over 2 hours.', sourceRetry: true });
    expect(stepStates(retrying)).toEqual({
      running: true,
      drugs: 'done',
      fda: 'done',
      search: 'active',
      done: 'pending',
      noDrugs: false,
      searchingAgain: true,
    });
    expect(stepStates({ ...retrying, sourceRetry: false })).toMatchObject({ running: false, search: 'done', done: 'done', searchingAgain: false });
  });

  it('counts a drug the classifier named even when openFDA had no label for it', () => {
    const lookup = lookupFor('notarealdrug');
    lookup.drug_lookups[0].not_found = true;
    expect(stepStates(turn('done', 'ok', { lookup }))).toMatchObject({ drugs: 'done', fda: 'done', noDrugs: false });
  });
});

describe('answeredWithoutSources', () => {
  const source = fallbackSource({ uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/a', title: 'fda.gov' });

  it('is true for a finished answer that came back with no sources', () => {
    expect(answeredWithoutSources(turn('done', 'ok', { answer: 'Infuse over 2 hours.' }))).toBe(true);
  });

  it('is false when the answer has sources', () => {
    expect(answeredWithoutSources(turn('done', 'ok', { answer: 'Infuse over 2 hours.', sources: [source] }))).toBe(false);
  });

  it('is false without answer text', () => {
    expect(answeredWithoutSources(turn('done', 'ok', { answer: '' }))).toBe(false);
    expect(answeredWithoutSources(turn('done', 'ok', { answer: ' \n ' }))).toBe(false);
  });

  it('is false while the answer is being asked again for sources', () => {
    expect(answeredWithoutSources(turn('done', 'ok', { answer: 'Infuse over 2 hours.', sourceRetry: true }))).toBe(false);
    expect(answeredWithoutSources(turn('done', 'ok', { answer: 'Infuse over 2 hours.', sourceRetry: false }))).toBe(true);
  });

  it('is false while the turn runs, and for a stopped or failed turn', () => {
    for (const status of ['lookup', 'streaming', 'resolving', 'stopped', 'error'] as const) {
      expect(answeredWithoutSources(turn(status, 'ok', { answer: 'Partial answer.' })), status).toBe(false);
    }
  });
});
