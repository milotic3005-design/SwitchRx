import { describe, it, expect } from 'vitest';
import type { LookupResult } from '@/lib/pharmacy-lookup';
import { answeredWithoutSources, stepStates } from './turn-status';
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

describe('stepStates', () => {
  it('shows the lookup in progress, then the search, then done', () => {
    expect(stepStates(turn('lookup', 'pending'))).toEqual({
      running: true,
      drugs: 'active',
      fda: 'active',
      search: 'pending',
      done: 'pending',
      noDrugs: false,
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
    });
    // Also while the answer is still streaming.
    expect(stepStates(turn('streaming', 'ok', { lookup: lookupFor() }))).toMatchObject({
      drugs: 'skipped',
      fda: 'skipped',
      search: 'active',
      noDrugs: true,
    });
  });

  it('treats an ok lookup with no result as naming no drug', () => {
    expect(stepStates(turn('done', 'ok', { lookup: null }))).toMatchObject({ drugs: 'skipped', fda: 'skipped', noDrugs: true });
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

  it('is false while the turn runs, and for a stopped or failed turn', () => {
    for (const status of ['lookup', 'streaming', 'resolving', 'stopped', 'error'] as const) {
      expect(answeredWithoutSources(turn(status, 'ok', { answer: 'Partial answer.' })), status).toBe(false);
    }
  });
});
