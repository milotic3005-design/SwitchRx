import { describe, it, expect } from 'vitest';
import { splitFollowUps } from './followups';

const FULL = 'Answer text.\n\n```followups\n- How long is the infusion?\n- What premeds?\n- Is a filter needed?\n```';

describe('splitFollowUps', () => {
  it('extracts a complete block and strips it from the body', () => {
    expect(splitFollowUps(FULL)).toEqual({
      body: 'Answer text.',
      followUps: ['How long is the infusion?', 'What premeds?', 'Is a filter needed?'],
      pending: false,
    });
  });
  it('hides an open block while streaming', () => {
    expect(splitFollowUps('Answer text.\n\n```followups\n- How long')).toEqual({ body: 'Answer text.', followUps: [], pending: true });
  });
  it('hides a partially typed opening fence while streaming', () => {
    expect(splitFollowUps('Answer text.\n\n```follo')).toEqual({ body: 'Answer text.', followUps: [], pending: true });
  });
  it('returns the text unchanged when there is no block', () => {
    expect(splitFollowUps('Just an answer.')).toEqual({ body: 'Just an answer.', followUps: [], pending: false });
  });
  it('recovers items from an unclosed block when final', () => {
    expect(splitFollowUps('A.\n```followups\n- One?\n* Two?\n1. Three?', true)).toEqual({ body: 'A.', followUps: ['One?', 'Two?', 'Three?'], pending: false });
  });
  it('keeps at most three non-empty items', () => {
    const r = splitFollowUps('A.\n```followups\n- 1?\n-\n- 2?\n- 3?\n- 4?\n```');
    expect(r.followUps).toEqual(['1?', '2?', '3?']);
  });
  it('does not treat an ordinary code fence as a follow-up block', () => {
    const t = 'Use:\n```\nrate = dose / time\n```\nDone.';
    expect(splitFollowUps(t, true)).toEqual({ body: t, followUps: [], pending: false });
  });
});
