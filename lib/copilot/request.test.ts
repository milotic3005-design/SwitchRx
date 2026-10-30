import { describe, it, expect } from 'vitest';
import { COPILOT_DEPTH_ADDENDA, INFUSION_QA_SYSTEM_PROMPT } from '@/lib/ai-prompts';
import { buildCopilotRequest } from './request';
import { splitFollowUps } from './followups';
import type { CopilotTurn, TurnStatus } from './types';

function turn(n: number | string, status: TurnStatus = 'done', answer = `a${n}`): CopilotTurn {
  return {
    id: `t${n}`,
    question: `q${n}`,
    depth: 'quick',
    askedAt: 1,
    status,
    answer,
    followUps: [],
    supports: [],
    sources: [],
    lookup: null,
    lookupState: 'ok',
  };
}

describe('buildCopilotRequest', () => {
  it('combines prompt, depth addendum, and lookup context', () => {
    const r = buildCopilotRequest({ history: [], question: 'Q?', depth: 'quick', lookupContext: 'LOOKUP' });
    expect(r.system).toBe(`${INFUSION_QA_SYSTEM_PROMPT}\n\n${COPILOT_DEPTH_ADDENDA.quick}\n\n---\n\nLOOKUP`);
  });

  it('uses high thinking for both depths, so Quick still searches and cites its sources', () => {
    for (const depth of ['quick', 'thorough'] as const) {
      expect(buildCopilotRequest({ history: [], question: 'Q?', depth, lookupContext: '' }).thinkingLevel, depth).toBe('high');
    }
  });

  it('differs between depths only by the depth addendum', () => {
    const args = { history: [turn(1)], question: 'Q?', lookupContext: 'LOOKUP' };
    const quick = buildCopilotRequest({ ...args, depth: 'quick' });
    const thorough = buildCopilotRequest({ ...args, depth: 'thorough' });
    expect(thorough).toEqual({
      ...quick,
      system: quick.system.replace(COPILOT_DEPTH_ADDENDA.quick, COPILOT_DEPTH_ADDENDA.thorough),
    });
  });

  it('omits an empty lookup section', () => {
    const r = buildCopilotRequest({ history: [], question: 'Q?', depth: 'thorough', lookupContext: '' });
    expect(r.system.endsWith(COPILOT_DEPTH_ADDENDA.thorough)).toBe(true);
    expect(r.system).toBe(`${INFUSION_QA_SYSTEM_PROMPT}\n\n${COPILOT_DEPTH_ADDENDA.thorough}`);
  });

  it('sends only the question when there is no history', () => {
    const r = buildCopilotRequest({ history: [], question: 'Q?', depth: 'quick', lookupContext: '' });
    expect(r.messages).toEqual([{ role: 'user', content: 'Q?' }]);
  });

  it('sends the last six finished turns as user/assistant pairs, then the question', () => {
    // Eight eligible turns (t1..t8, one of them stopped) interleaved with turns that
    // must never be sent: an error turn, a done turn with an empty answer, a done turn
    // with a whitespace-only answer, and a turn still streaming. Only the last six
    // eligible turns (t3..t8) are kept, in order.
    const history = [
      turn(1),
      turn(2),
      turn('err', 'error', 'partial text'),
      turn(3),
      turn(4),
      turn('empty', 'done', ''),
      turn(5),
      turn('blank', 'done', '  \n '),
      turn(6, 'stopped'),
      turn(7),
      turn('live', 'streaming', 'partial answer so far'),
      turn(8),
    ];
    const r = buildCopilotRequest({ history, question: 'Q?', depth: 'thorough', lookupContext: '' });
    expect(r.messages).toEqual([
      { role: 'user', content: 'q3' },
      { role: 'assistant', content: 'a3' },
      { role: 'user', content: 'q4' },
      { role: 'assistant', content: 'a4' },
      { role: 'user', content: 'q5' },
      { role: 'assistant', content: 'a5' },
      { role: 'user', content: 'q6' },
      { role: 'assistant', content: 'a6' },
      { role: 'user', content: 'q7' },
      { role: 'assistant', content: 'a7' },
      { role: 'user', content: 'q8' },
      { role: 'assistant', content: 'a8' },
      { role: 'user', content: 'Q?' },
    ]);
  });

  it('keeps every eligible turn when there are fewer than six', () => {
    const history = [turn(1), turn('err', 'error', 'x'), turn(2, 'stopped')];
    const r = buildCopilotRequest({ history, question: 'Q?', depth: 'quick', lookupContext: '' });
    expect(r.messages.map((m) => m.content)).toEqual(['q1', 'a1', 'q2', 'a2', 'Q?']);
  });

  it('does not mutate the history it is given', () => {
    const history = Array.from({ length: 8 }, (_, i) => turn(i + 1));
    const snapshot = structuredClone(history);
    buildCopilotRequest({ history, question: 'Q?', depth: 'quick', lookupContext: '' });
    expect(history).toEqual(snapshot);
  });
});

describe('INFUSION_QA_SYSTEM_PROMPT', () => {
  it('tells the model not to write citations and to end with a follow-up block', () => {
    expect(INFUSION_QA_SYSTEM_PROMPT).toContain('Do not write citation markers like [1], source lists, or URLs');
    expect(INFUSION_QA_SYSTEM_PROMPT).toContain('```followups');
  });

  it('shows the follow-up block as the app parses it: three "- " items closed by a ``` line', () => {
    const match = INFUSION_QA_SYSTEM_PROMPT.match(/^```followups\n((?:- .+\n){3})```$/m);
    expect(match).not.toBeNull();
    const split = splitFollowUps(`Answer.\n\n${match![0]}`, true);
    expect(split.body).toBe('Answer.');
    expect(split.followUps).toHaveLength(3);
  });

  it('asks for follow-ups the clinician would ask next, in their voice, never questions to the clinician', () => {
    const ending = INFUSION_QA_SYSTEM_PROMPT.slice(INFUSION_QA_SYSTEM_PROMPT.indexOf('## Ending every answer'));
    for (const needle of [
      'questions the clinician would ask you next',
      "in the clinician's own voice",
      '"What premedications are recommended before re-challenge?"',
      'Never ask the clinician',
      '"Did the patient have',
    ]) {
      expect(ending, needle).toContain(needle);
    }
  });

  it('covers the research order, answer shape, and decision-support framing', () => {
    const p = INFUSION_QA_SYSTEM_PROMPT;
    for (const needle of [
      'FDA label',
      'DailyMed',
      'IDSA',
      'ASHP',
      'INS',
      'NCCN',
      'ONS',
      'verified lookup',
      'bottom line',
      'Important caveats',
      'inpatient',
      'not patient-directed',
      'weight',
      'CrCl',
    ]) {
      expect(p, needle).toContain(needle);
    }
  });

  it('never carries another product identity or a HIPAA claim', () => {
    for (const banned of [/OpenEvidence/i, /EvidenceGrade/i, /Osler/i, /Sackett/i, /\bSnow\b/i, /HIPAA/i]) {
      expect(INFUSION_QA_SYSTEM_PROMPT).not.toMatch(banned);
      expect(COPILOT_DEPTH_ADDENDA.quick).not.toMatch(banned);
      expect(COPILOT_DEPTH_ADDENDA.thorough).not.toMatch(banned);
    }
  });
});

describe('COPILOT_DEPTH_ADDENDA', () => {
  it('pins the exact depth instructions', () => {
    expect(COPILOT_DEPTH_ADDENDA.quick).toBe('Be brief: 1–3 short paragraphs or a short list; skip background.');
    expect(COPILOT_DEPTH_ADDENDA.thorough).toBe(
      'Give a complete answer: lead with the bottom line, then short sections as the question requires.',
    );
  });
});
