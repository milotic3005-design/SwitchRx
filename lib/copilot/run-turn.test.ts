import { describe, it, expect, vi, afterEach, type Mock } from 'vitest';
import type { CitationSupport, GroundingSource } from '@/lib/ai';
import { formatLookupForPrompt, type LookupResult } from '@/lib/pharmacy-lookup';
import { titleFdaLabels } from './label-titles';
import { buildCopilotRequest, type CopilotRequest } from './request';
import { runTurn, type CopilotTransport } from './run-turn';
import { fallbackSource } from './source-types';
import { realTransport } from './transport';
import type { CopilotTurn, EnrichedSource, TurnPatch } from './types';

const V = (id: string) => `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${id}`;

const SOURCES: GroundingSource[] = [
  { uri: V('label'), title: 'DailyMed - REMICADE- infliximab injection' },
  { uri: V('trial'), title: 'pubmed.ncbi.nlm.nih.gov' },
];
const SUPPORTS: CitationSupport[] = [{ text: 'Infuse over at least 2 hours.', sourceIndices: [0, 1] }];
const ENRICHED: EnrichedSource[] = [
  {
    ...fallbackSource(SOURCES[0]),
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=abc',
    site: 'dailymed.nlm.nih.gov',
    shortName: 'FDA label',
    type: 'fda-label',
  },
  {
    ...fallbackSource(SOURCES[1]),
    url: 'https://pubmed.ncbi.nlm.nih.gov/12047962/',
    title: 'Maintenance infliximab for Crohn\'s disease: the ACCENT I randomised trial.',
    shortName: 'Lancet',
    journal: 'Lancet (London, England)',
    year: 2002,
    pmid: '12047962',
    type: 'trial',
  },
];

const BODY = 'Infuse over at least 2 hours.\n\nUse an in-line filter.';
const ANSWER = `${BODY}\n\n\`\`\`followups\n- First follow-up?\n- Second follow-up?\n- Third follow-up?\n\`\`\``;

const LOOKUP: LookupResult = {
  classification: { drug_names: ['infliximab'], query_domain: 'iv_drug_info', urgency: 'routine' },
  drug_lookups: [
    {
      generic_name: 'infliximab',
      label_sections: [
        {
          drug: 'infliximab',
          field: 'storage_and_handling',
          label: 'Storage & Handling',
          content: 'Store unopened vials in a refrigerator at 2°C to 8°C.',
          source: 'openFDA',
        },
      ],
    },
  ],
  safety_flags: [],
  data_sources_used: ['openfda_label'],
};

const QUESTION = 'How do I prepare infliximab?';
const INPUT = { history: [] as CopilotTurn[], question: QUESTION, depth: 'thorough' as const };

type StreamCallbacks = Parameters<CopilotTransport['stream']>[1];

function fakeTransport(overrides: Partial<{ [K in keyof CopilotTransport]: Mock<CopilotTransport[K]> }> = {}) {
  return {
    lookup: vi.fn<CopilotTransport['lookup']>(async () => LOOKUP),
    stream: vi.fn<CopilotTransport['stream']>(async (_req, cb) => {
      cb.onText(ANSWER.slice(0, 12));
      cb.onText(ANSWER);
      cb.onSources(SOURCES);
      cb.onSupports(SUPPORTS);
    }),
    resolve: vi.fn<CopilotTransport['resolve']>(async () => ENRICHED),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const merge = (patches: TurnPatch[]): TurnPatch => Object.assign({}, ...patches);
const statuses = (patches: TurnPatch[]) => patches.flatMap((p) => (p.status ? [p.status] : []));
const requestOf = (t: ReturnType<typeof fakeTransport>): CopilotRequest => t.stream.mock.calls[0][0];

async function run(
  t: CopilotTransport,
  signal: AbortSignal = new AbortController().signal,
  input: Parameters<typeof runTurn>[1] = INPUT,
) {
  const patches: TurnPatch[] = [];
  await runTurn(t, input, (p) => patches.push(p), signal, { now: () => 1234 });
  return patches;
}

/** Lets any already-scheduled callbacks and promise reactions run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('runTurn', () => {
  afterEach(() => vi.useRealTimers());

  it('runs lookup → stream → resolve and ends done', async () => {
    const t = fakeTransport();
    const patches = await run(t);
    const final = merge(patches);

    expect(statuses(patches)).toEqual(['lookup', 'streaming', 'resolving', 'done']);
    expect(patches[0]).toEqual({ status: 'lookup', lookupState: 'pending' });
    expect(final.status).toBe('done');
    expect(final.answer).toBe(BODY);
    expect(final.followUps).toEqual(['First follow-up?', 'Second follow-up?', 'Third follow-up?']);
    expect(final.supports).toEqual(SUPPORTS);
    expect(final.sources).toEqual(titleFdaLabels(ENRICHED, LOOKUP));
    expect(final.sources?.[0].title).toBe('Remicade (Infliximab) prescribing information');
    expect(final.sources?.[1]).toEqual(ENRICHED[1]);
    expect(final.lookup).toBe(LOOKUP);
    expect(final.lookupState).toBe('ok');
    expect(final.firstTokenAt).toBe(1234);
    expect(final.error).toBeUndefined();
    expect(t.resolve).toHaveBeenCalledWith(SOURCES, expect.any(AbortSignal));
  });

  it('streams the answer body without the follow-up block and shows fallback sources until resolved', async () => {
    const patches = await run(fakeTransport());
    const streamed = patches.filter((p) => p.answer !== undefined && p.status === undefined);

    expect(streamed.map((p) => p.answer)).toEqual([ANSWER.slice(0, 12), BODY]);
    expect(streamed.every((p) => p.firstTokenAt === 1234)).toBe(true);
    expect(patches).toContainEqual({ sources: SOURCES.map(fallbackSource) });
    expect(patches).toContainEqual({ supports: SUPPORTS });
    // The fallback list arrives during streaming, before the 'resolving' status.
    const fallbackAt = patches.findIndex((p) => p.sources !== undefined);
    expect(patches[fallbackAt].sources).toEqual(SOURCES.map(fallbackSource));
    expect(fallbackAt).toBeLessThan(patches.findIndex((p) => p.status === 'resolving'));
  });

  it('passes lookup context into the request system prompt', async () => {
    const history: CopilotTurn[] = [
      {
        id: 't0',
        question: 'Earlier question?',
        depth: 'quick',
        askedAt: 1,
        status: 'done',
        answer: 'Earlier answer.',
        followUps: [],
        supports: [],
        sources: [],
        lookup: null,
        lookupState: 'ok',
      },
    ];
    const t = fakeTransport();
    await run(t, undefined, { ...INPUT, history });

    const req = requestOf(t);
    expect(req.system).toContain(formatLookupForPrompt(LOOKUP));
    expect(req).toEqual(
      buildCopilotRequest({ history, question: QUESTION, depth: 'thorough', lookupContext: formatLookupForPrompt(LOOKUP) }),
    );
    expect(t.lookup).toHaveBeenCalledWith(QUESTION, expect.any(AbortSignal));
  });

  it('proceeds without the lookup after 12 s and records a timeout', async () => {
    vi.useFakeTimers();
    const t = fakeTransport({ lookup: vi.fn(() => new Promise<LookupResult | null>(() => {})) });
    const patches: TurnPatch[] = [];
    const done = runTurn(t, INPUT, (p) => patches.push(p), new AbortController().signal);

    await vi.advanceTimersByTimeAsync(11_999);
    expect(patches).toEqual([{ status: 'lookup', lookupState: 'pending' }]);
    expect(t.stream).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await done;

    const final = merge(patches);
    expect(final.lookupState).toBe('timeout');
    expect(final.lookup).toBeNull();
    expect(final.status).toBe('done');
    const req = requestOf(t);
    expect(req.system).toBe(buildCopilotRequest({ history: [], question: QUESTION, depth: 'thorough', lookupContext: '' }).system);
    expect(req.system).not.toContain('PRE-FETCHED AUTHORITATIVE DATA');
  });

  it('ignores a lookup that arrives after the timeout', async () => {
    vi.useFakeTimers();
    const late = deferred<LookupResult | null>();
    const t = fakeTransport({ lookup: vi.fn(() => late.promise) });
    const patches: TurnPatch[] = [];
    const done = runTurn(t, INPUT, (p) => patches.push(p), new AbortController().signal, { lookupTimeoutMs: 50 });

    await vi.advanceTimersByTimeAsync(50);
    await done;
    const count = patches.length;
    late.resolve(LOOKUP);
    await vi.advanceTimersByTimeAsync(0);

    expect(patches).toHaveLength(count);
    expect(merge(patches).lookupState).toBe('timeout');
    expect(merge(patches).lookup).toBeNull();
    expect(patches.some((p) => p.lookupState === 'ok')).toBe(false);
  });

  it('records a failed lookup and continues', async () => {
    const t = fakeTransport({ lookup: vi.fn(async () => Promise.reject(new Error('classifier down'))) });
    const patches = await run(t);
    const final = merge(patches);

    expect(final.lookupState).toBe('failed');
    expect(final.lookup).toBeNull();
    expect(final.status).toBe('done');
    expect(final.answer).toBe(BODY);
    expect(requestOf(t).system).not.toContain('PRE-FETCHED AUTHORITATIVE DATA');
  });

  it('treats a lookup that returns null as failed', async () => {
    const final = merge(await run(fakeTransport({ lookup: vi.fn(async () => null) })));
    expect(final.lookupState).toBe('failed');
    expect(final.lookup).toBeNull();
    expect(final.status).toBe('done');
  });

  it('keeps the partial answer and ends stopped when aborted mid-stream', async () => {
    const controller = new AbortController();
    const t = fakeTransport({
      stream: vi.fn(
        (_req: CopilotRequest, cb: StreamCallbacks, signal: AbortSignal) =>
          new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            cb.onText('First chunk.');
          }),
      ),
    });
    const patches: TurnPatch[] = [];
    await runTurn(
      t,
      INPUT,
      (p) => {
        patches.push(p);
        if (p.answer === 'First chunk.') controller.abort();
      },
      controller.signal,
    );

    const final = merge(patches);
    expect(final.status).toBe('stopped');
    expect(final.answer).toBe('First chunk.');
    expect(patches.at(-1)).toEqual({ status: 'stopped' });
    expect(t.resolve).not.toHaveBeenCalled();
  });

  it('reports nothing after stopped, even if the transport keeps calling back', async () => {
    const controller = new AbortController();
    let lateCallbacks: Promise<void> = Promise.resolve();
    const t = fakeTransport({
      // Ignores the signal: keeps streaming text, sources and supports after the abort, both in the
      // same call stack as the chunk that triggered it and on a later task.
      stream: vi.fn(async (_req: CopilotRequest, cb: StreamCallbacks) => {
        cb.onText('First chunk.');
        cb.onText('First chunk. More.');
        cb.onSources(SOURCES);
        cb.onSupports(SUPPORTS);
        lateCallbacks = (async () => {
          await settle();
          cb.onText('First chunk. Second chunk.');
          cb.onSources(SOURCES);
          cb.onSupports(SUPPORTS);
          cb.onText(ANSWER);
        })();
        await lateCallbacks;
      }),
    });
    const patches: TurnPatch[] = [];
    await runTurn(
      t,
      INPUT,
      (p) => {
        patches.push(p);
        if (p.answer === 'First chunk.') controller.abort();
      },
      controller.signal,
    );
    const atStop = patches.length;
    await lateCallbacks;
    await settle();

    expect(patches).toHaveLength(atStop);
    expect(patches.at(-1)).toEqual({ status: 'stopped' });
    expect(patches.filter((p) => p.status === 'stopped')).toHaveLength(1);
    expect(merge(patches).answer).toBe('First chunk.');
    expect(patches.some((p) => p.sources !== undefined || p.supports !== undefined)).toBe(false);
    expect(t.resolve).not.toHaveBeenCalled();
  });

  it('stops during the lookup and ignores the lookup when it arrives later', async () => {
    const controller = new AbortController();
    const pending = deferred<LookupResult | null>();
    const t = fakeTransport({ lookup: vi.fn(() => pending.promise) });
    const patches: TurnPatch[] = [];
    const done = runTurn(t, INPUT, (p) => patches.push(p), controller.signal);

    controller.abort();
    await done;
    pending.resolve(LOOKUP);
    await settle();

    expect(patches).toEqual([{ status: 'lookup', lookupState: 'pending' }, { status: 'stopped' }]);
    expect(t.stream).not.toHaveBeenCalled();
  });

  it('stops while resolving sources and keeps the finished answer', async () => {
    const controller = new AbortController();
    const pending = deferred<EnrichedSource[]>();
    const t = fakeTransport({ resolve: vi.fn(() => pending.promise) });
    const patches: TurnPatch[] = [];
    const done = runTurn(
      t,
      INPUT,
      (p) => {
        patches.push(p);
        if (p.status === 'resolving') controller.abort();
      },
      controller.signal,
    );
    await done;
    pending.resolve(ENRICHED);
    await settle();

    const final = merge(patches);
    expect(statuses(patches)).toEqual(['lookup', 'streaming', 'resolving', 'stopped']);
    expect(final.answer).toBe(BODY);
    expect(final.sources).toEqual(SOURCES.map(fallbackSource));
  });

  it('reports only stopped when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const t = fakeTransport();
    const patches = await run(t, controller.signal);

    expect(patches).toEqual([{ status: 'stopped' }]);
    expect(t.lookup).not.toHaveBeenCalled();
    expect(t.stream).not.toHaveBeenCalled();
  });

  it('ends in error with the message, keeping partial text', async () => {
    const t = fakeTransport({
      stream: vi.fn(async (_req: CopilotRequest, cb: StreamCallbacks) => {
        cb.onText('Partial answer');
        throw new Error('boom');
      }),
    });
    const patches = await run(t);
    const final = merge(patches);

    expect(final.status).toBe('error');
    expect(final.error).toBe('boom');
    expect(final.answer).toBe('Partial answer');
    expect(patches.at(-1)).toEqual({ status: 'error', error: 'boom' });
    expect(t.resolve).not.toHaveBeenCalled();
  });

  it('keeps fallback sources when resolve fails', async () => {
    const t = fakeTransport({ resolve: vi.fn(async () => Promise.reject(new Error('resolve failed'))) });
    const final = merge(await run(t));

    expect(final.status).toBe('done');
    expect(final.sources).toEqual(SOURCES.map(fallbackSource));
    expect(final.answer).toBe(BODY);
    expect(final.followUps).toHaveLength(3);
  });

  it('skips resolving when the answer has no sources', async () => {
    const t = fakeTransport({
      stream: vi.fn(async (_req: CopilotRequest, cb: StreamCallbacks) => cb.onText(ANSWER)),
    });
    const patches = await run(t);

    expect(statuses(patches)).toEqual(['lookup', 'streaming', 'resolving', 'done']);
    expect(t.resolve).not.toHaveBeenCalled();
    expect(merge(patches).sources).toBeUndefined();
  });

  it('ignores stream callbacks that arrive after the stream has finished', async () => {
    let streamCb: StreamCallbacks | undefined;
    const t = fakeTransport({
      stream: vi.fn(async (_req: CopilotRequest, cb: StreamCallbacks) => {
        streamCb = cb;
        cb.onText(ANSWER);
        cb.onSources(SOURCES);
        cb.onSupports(SUPPORTS);
      }),
      // Calls back into the finished stream while the sources are being resolved.
      resolve: vi.fn(async () => {
        streamCb?.onText('Late text');
        streamCb?.onSources([]);
        streamCb?.onSupports([]);
        return ENRICHED;
      }),
    });
    const patches = await run(t);
    const resolvingAt = patches.findIndex((p) => p.status === 'resolving');

    expect(t.resolve).toHaveBeenCalledTimes(1);
    expect(patches.slice(resolvingAt + 1)).toEqual([
      { sources: titleFdaLabels(ENRICHED, LOOKUP) },
      { status: 'done' },
    ]);
    expect(merge(patches).answer).toBe(BODY);
    expect(merge(patches).supports).toEqual(SUPPORTS);
  });
});

function ndjson(events: unknown[]): Response {
  const body = events.map((e) => JSON.stringify(e) + '\n').join('');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}

type FetchArgs = [string, RequestInit];

describe('realTransport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('streams through streamAI with web search, 8000 tokens, the request thinking level and the signal', async () => {
    const supports: CitationSupport[] = [{ text: 'Hello.', sourceIndices: [0] }];
    const fetchMock = vi.fn(async (..._args: FetchArgs) =>
      ndjson([
        { type: 'text', delta: 'Hello' },
        { type: 'text', delta: '.' },
        { type: 'sources', sources: [SOURCES[0]] },
        { type: 'supports', supports },
        { type: 'done' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const req = buildCopilotRequest({ history: [], question: QUESTION, depth: 'quick', lookupContext: '' });
    const signal = new AbortController().signal;
    const cb = { onText: vi.fn(), onSources: vi.fn(), onSupports: vi.fn() };

    await realTransport.stream(req, cb, signal);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/stream');
    expect(init.signal).toBe(signal);
    expect(JSON.parse(init.body as string)).toEqual({
      system: req.system,
      messages: req.messages,
      maxTokens: 8000,
      webSearch: true,
      thinkingLevel: 'low',
    });
    expect(cb.onText.mock.calls).toEqual([['Hello'], ['Hello.']]);
    expect(cb.onSources).toHaveBeenCalledWith([SOURCES[0]]);
    expect(cb.onSupports).toHaveBeenCalledWith(supports);
  });

  it('resolves at most 40 sendable sources and maps the response back to the original positions', async () => {
    const longUri = V('x'.repeat(2049 - V('').length));
    expect(longUri).toHaveLength(2049);
    const longTitle = 'T'.repeat(600);
    const sources: GroundingSource[] = Array.from({ length: 42 }, (_, i) => ({ uri: V(`s${i}`), title: `title ${i}` }));
    sources[1] = { uri: longUri, title: 'too long a link' };
    sources[2] = { uri: V('s2'), title: longTitle };

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = (JSON.parse(init.body as string) as { sources: GroundingSource[] }).sources;
      const enriched = sent.map((s): EnrichedSource => ({
        ...fallbackSource(s),
        url: `https://resolved.example/${s.uri.split('/').pop()}`,
        title: `Resolved ${s.uri.split('/').pop()}`,
      }));
      return Response.json({ sources: enriched });
    });
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;

    const result = await realTransport.resolve(sources, signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sources/resolve');
    expect(init.method).toBe('POST');
    expect(init.signal).toBe(signal);
    const sent = (JSON.parse(init.body as string) as { sources: GroundingSource[] }).sources;
    // Sources 0 and 2..40: the over-long link is skipped and the 41st sendable source is not sent.
    expect(sent).toHaveLength(40);
    expect(sent.map((s) => s.uri)).toEqual([0, ...Array.from({ length: 39 }, (_, k) => k + 2)].map((i) => V(`s${i}`)));
    expect(sent[1].title).toBe(longTitle.slice(0, 500));
    expect(sent.every((s) => s.uri.length <= 2048 && s.title.length <= 500)).toBe(true);

    expect(result).toHaveLength(42);
    expect(result[0]).toMatchObject({ uri: V('s0'), url: 'https://resolved.example/s0', title: 'Resolved s0' });
    expect(result[1]).toEqual(fallbackSource(sources[1]));
    expect(result[2]).toMatchObject({ uri: V('s2'), url: 'https://resolved.example/s2' });
    expect(result[40]).toMatchObject({ uri: V('s40'), url: 'https://resolved.example/s40' });
    expect(result[41]).toEqual(fallbackSource(sources[41]));
  });

  it('returns fallbacks without a request when no source can be sent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const sources = [{ uri: V('y'.repeat(2100)), title: 'long' }];

    expect(await realTransport.resolve(sources, new AbortController().signal)).toEqual(sources.map(fallbackSource));
    expect(await realTransport.resolve([], new AbortController().signal)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the resolve request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad request', { status: 400 })));
    await expect(realTransport.resolve(SOURCES, new AbortController().signal)).rejects.toThrow('400');

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ nope: true })));
    await expect(realTransport.resolve(SOURCES, new AbortController().signal)).rejects.toThrow();

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(realTransport.resolve(SOURCES, new AbortController().signal)).rejects.toThrow('Failed to fetch');
  });
});
