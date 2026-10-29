import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CitationSupport, GroundingSource } from '@/lib/ai';
import { placeCitations } from './citations';
import { DEMO_TURN, demoTransport, isDemoEnabled } from './demo';
import { splitFollowUps } from './followups';
import { titleFdaLabels } from './label-titles';
import { buildCopilotRequest } from './request';
import { runTurn } from './run-turn';
import { sourceMix } from './source-types';
import type { TurnPatch } from './types';

const REQUEST = buildCopilotRequest({ history: [], question: DEMO_TURN.question, depth: 'thorough', lookupContext: '' });

/** Removes emphasis markers and collapses whitespace, as citation placement does. */
const normalize = (s: string) => s.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();

describe('DEMO_TURN', () => {
  it('demo fixture exercises the citation edge cases', () => {
    const body = splitFollowUps(DEMO_TURN.answerText, true);
    expect(body.followUps).toHaveLength(3);
    const p = placeCitations(body.body, DEMO_TURN.supports, DEMO_TURN.enriched.length);
    expect(p.unplaced).toBe(1);
    expect(p.refs.length).toBeGreaterThanOrEqual(5);
    expect(sourceMix(p.refs.map(i => DEMO_TURN.enriched[i])).groups.length).toBeGreaterThanOrEqual(4);
  });

  it('has six or more supports, one citing two sources, and exactly one whose text is absent', () => {
    const { body } = splitFollowUps(DEMO_TURN.answerText, true);
    const flat = normalize(body);

    expect(DEMO_TURN.supports.length).toBeGreaterThanOrEqual(6);
    expect(DEMO_TURN.supports.some((s) => s.sourceIndices.length === 2)).toBe(true);
    const absent = DEMO_TURN.supports.filter((s) => !flat.includes(normalize(s.text)));
    expect(absent).toHaveLength(1);
    // Every other support occurs exactly once, so its chip lands on one sentence.
    for (const s of DEMO_TURN.supports) {
      if (absent.includes(s)) continue;
      expect(flat.split(normalize(s.text)).length - 1, s.text).toBe(1);
    }
    // The absent support's source is cited nowhere else, so it is listed but never chipped.
    const placed = placeCitations(body, DEMO_TURN.supports, DEMO_TURN.enriched.length);
    expect(placed.uncited).toEqual(absent[0].sourceIndices);
  });

  it('is shaped like a real answer: bottom line, sections, table, caveats, follow-ups', () => {
    const { body, followUps } = splitFollowUps(DEMO_TURN.answerText, true);
    expect(body.split('\n')[0]).not.toMatch(/^#/);
    expect(body.match(/^### /gm)?.length).toBeGreaterThanOrEqual(2);
    expect(body).toContain('### Important caveats');
    expect(body).toMatch(/^\|.*\|\n\|\s*-+/m);
    expect(body).toMatch(/\*\*[^*]*\d[^*]*\*\*/);
    expect(followUps.every((q) => q.endsWith('?'))).toBe(true);
  });

  it('uses only the numbers from the Remicade label facts', () => {
    const allowed = new Set(['100', '10', '21', '5', '250', '0.9', '0.4', '4', '2', '1.2', '8', '30', '6']);
    const { lookup } = DEMO_TURN;
    const text = [
      DEMO_TURN.answerText,
      ...lookup.drug_lookups.flatMap((d) => d.label_sections.map((s) => s.content)),
      ...lookup.safety_flags.map((f) => f.message),
    ].join('\n');
    const numbers = new Set(text.match(/\d+(?:\.\d+)?/g));
    expect([...numbers].filter((n) => !allowed.has(n))).toEqual([]);
  });

  it('spans FDA label, guideline, trial, journal and agency sources, aligned with the grounding sources', () => {
    expect(new Set(DEMO_TURN.enriched.map((s) => s.type))).toEqual(
      new Set(['fda-label', 'guideline', 'trial', 'journal', 'agency']),
    );
    expect(DEMO_TURN.enriched).toHaveLength(DEMO_TURN.sources.length);
    DEMO_TURN.enriched.forEach((e, i) => expect(e.uri).toBe(DEMO_TURN.sources[i].uri));
    for (const s of DEMO_TURN.sources) {
      expect(new URL(s.uri).host).toBe('vertexaisearch.cloud.google.com');
      expect(new URL(s.uri).pathname.startsWith('/grounding-api-redirect/')).toBe(true);
    }
    for (const e of DEMO_TURN.enriched.filter((s) => s.pmid)) {
      expect(e.url).toBe(`https://pubmed.ncbi.nlm.nih.gov/${e.pmid}/`);
      expect(e.journal && e.year && e.authors && e.title).toBeTruthy();
    }
  });

  it('has a lookup with exactly one warning safety flag', () => {
    expect(DEMO_TURN.lookup.safety_flags.filter((f) => f.level === 'warning')).toHaveLength(1);
    expect(DEMO_TURN.lookup.drug_lookups[0].generic_name).toBe('infliximab');
  });
});

describe('isDemoEnabled', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is on only in development with a copilotDemo query parameter', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDemoEnabled('?copilotDemo=1')).toBe(true);
    expect(isDemoEnabled('?tab=copilot&copilotDemo')).toBe(true);
    expect(isDemoEnabled('?tab=copilot')).toBe(false);
    expect(isDemoEnabled('')).toBe(false);

    vi.stubEnv('NODE_ENV', 'production');
    expect(isDemoEnabled('?copilotDemo=1')).toBe(false);
    vi.stubEnv('NODE_ENV', 'test');
    expect(isDemoEnabled('?copilotDemo=1')).toBe(false);
  });
});

describe('demoTransport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the lookup after 600 ms', async () => {
    const onResult = vi.fn();
    void demoTransport.lookup(DEMO_TURN.question, new AbortController().signal).then(onResult);

    await vi.advanceTimersByTimeAsync(599);
    expect(onResult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onResult).toHaveBeenCalledWith(DEMO_TURN.lookup);
  });

  it('streams the answer in 40-character chunks every 30 ms, then sources and supports', async () => {
    const events: { at: number; kind: string; value: unknown }[] = [];
    const start = Date.now();
    const log = (kind: string) => (value: unknown) => events.push({ at: Date.now() - start, kind, value });
    const done = demoTransport.stream(
      REQUEST,
      { onText: log('text'), onSources: log('sources'), onSupports: log('supports') },
      new AbortController().signal,
    );

    await vi.advanceTimersByTimeAsync(29);
    expect(events).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(events).toEqual([{ at: 30, kind: 'text', value: DEMO_TURN.answerText.slice(0, 40) }]);

    await vi.runAllTimersAsync();
    await done;

    const texts = events.filter((e) => e.kind === 'text');
    const answer = DEMO_TURN.answerText;
    expect(texts).toHaveLength(Math.ceil(answer.length / 40));
    texts.forEach((e, i) => {
      expect(e.at).toBe(30 * (i + 1));
      expect(e.value).toBe(answer.slice(0, 40 * (i + 1)));
    });
    expect(events.slice(texts.length).map((e) => e.kind)).toEqual(['sources', 'supports']);
    expect(events.at(-2)?.value).toEqual(DEMO_TURN.sources);
    expect(events.at(-1)?.value).toEqual(DEMO_TURN.supports);
  });

  it('returns the enriched sources after 800 ms', async () => {
    const onResult = vi.fn();
    void demoTransport.resolve(DEMO_TURN.sources, new AbortController().signal).then(onResult);

    await vi.advanceTimersByTimeAsync(799);
    expect(onResult).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onResult).toHaveBeenCalledWith(DEMO_TURN.enriched);
  });

  it('stops emitting and rejects when aborted', async () => {
    const controller = new AbortController();
    const onText = vi.fn();
    const onSources = vi.fn();
    const onSupports = vi.fn();
    const streamed = demoTransport.stream(REQUEST, { onText, onSources, onSupports }, controller.signal);
    const looked = demoTransport.lookup(DEMO_TURN.question, controller.signal);
    const resolved = demoTransport.resolve(DEMO_TURN.sources, controller.signal);
    const outcomes = Promise.allSettled([streamed, looked, resolved]);

    await vi.advanceTimersByTimeAsync(90);
    expect(onText).toHaveBeenCalledTimes(3);
    controller.abort();
    await vi.runAllTimersAsync();

    expect((await outcomes).map((o) => o.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect(onText).toHaveBeenCalledTimes(3);
    expect(onSources).not.toHaveBeenCalled();
    expect(onSupports).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hands out copies, so a consumer cannot change the fixture', async () => {
    let sources: GroundingSource[] = [];
    let supports: CitationSupport[] = [];
    const done = demoTransport.stream(
      REQUEST,
      { onText: () => {}, onSources: (s) => (sources = s), onSupports: (s) => (supports = s) },
      new AbortController().signal,
    );
    await vi.runAllTimersAsync();
    await done;

    sources[0].title = 'changed';
    supports[0].sourceIndices.push(99);
    expect(DEMO_TURN.sources[0].title).not.toBe('changed');
    expect(DEMO_TURN.supports[0].sourceIndices).not.toContain(99);
  });

  it('plays a whole turn through runTurn', async () => {
    const patches: TurnPatch[] = [];
    const done = runTurn(
      demoTransport,
      { history: [], question: DEMO_TURN.question, depth: 'thorough' },
      (p) => patches.push(p),
      new AbortController().signal,
    );
    await vi.runAllTimersAsync();
    await done;

    const final: TurnPatch = Object.assign({}, ...patches);
    const { body, followUps } = splitFollowUps(DEMO_TURN.answerText, true);
    expect(final.status).toBe('done');
    expect(final.lookupState).toBe('ok');
    expect(final.lookup).toEqual(DEMO_TURN.lookup);
    expect(final.answer).toBe(body);
    expect(final.followUps).toEqual(followUps);
    expect(final.supports).toEqual(DEMO_TURN.supports);
    expect(final.sources).toEqual(titleFdaLabels(DEMO_TURN.enriched, DEMO_TURN.lookup));
    expect(final.sources?.find((s) => s.type === 'fda-label')?.title).toBe('Remicade (Infliximab) prescribing information');
    // While streaming, no part of the follow-up fence ever shows (the answer itself has no backticks).
    expect(body).not.toContain('`');
    expect(patches.filter((p) => p.answer !== undefined).every((p) => !p.answer?.includes('`'))).toBe(true);
  });
});
