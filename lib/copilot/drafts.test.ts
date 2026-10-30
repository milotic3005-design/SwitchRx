import { describe, it, expect } from 'vitest';
import { draftAt, draftKey, HOME_DRAFT, homeDraftOnly, withDraft, type Drafts } from './drafts';

describe('draftKey', () => {
  it('is the open thread id, or the home key on the home screen', () => {
    expect(draftKey('thread-a')).toBe('thread-a');
    expect(draftKey(null)).toBe(HOME_DRAFT);
    expect(HOME_DRAFT).toBe('');
  });
});

describe('draftAt', () => {
  it('is empty where nothing has been typed', () => {
    expect(draftAt({}, HOME_DRAFT)).toBe('');
    expect(draftAt({ a: 'x' }, 'b')).toBe('');
  });

  it('never reads inherited object properties as drafts', () => {
    expect(draftAt({}, 'constructor')).toBe('');
    expect(draftAt({}, 'toString')).toBe('');
  });
});

describe('withDraft', () => {
  it('sets one place and leaves the others alone', () => {
    const drafts = withDraft({ a: 'in a' }, 'b', 'in b');
    expect(drafts).toEqual({ a: 'in a', b: 'in b' });
  });

  it('removes the entry when the text is emptied', () => {
    expect(withDraft({ a: 'in a', b: 'in b' }, 'a', '')).toEqual({ b: 'in b' });
  });

  it('returns the same object when nothing changes', () => {
    const drafts: Drafts = { a: 'in a' };
    expect(withDraft(drafts, 'a', 'in a')).toBe(drafts);
    expect(withDraft(drafts, 'b', '')).toBe(drafts);
  });

  it('does not mutate its input', () => {
    const drafts: Drafts = { a: 'in a' };
    withDraft(drafts, 'a', 'changed');
    withDraft(drafts, 'a', '');
    expect(drafts).toEqual({ a: 'in a' });
  });
});

describe('homeDraftOnly', () => {
  it('keeps the home draft and drops every thread draft', () => {
    expect(homeDraftOnly({ [HOME_DRAFT]: 'home', a: 'in a', b: 'in b' })).toEqual({ [HOME_DRAFT]: 'home' });
    expect(homeDraftOnly({ a: 'in a' })).toEqual({});
  });
});

/** The question box as InfusionConsult drives it: one draft per place, the place being the open thread or home. */
function box() {
  let drafts: Drafts = {};
  let open: string | null = null;
  return {
    get text() {
      return draftAt(drafts, draftKey(open));
    },
    type(text: string) {
      drafts = withDraft(drafts, draftKey(open), text);
    },
    /** A question handed over from another tab goes to the home box, then the home screen opens. */
    prefill(text: string) {
      drafts = withDraft(drafts, HOME_DRAFT, text);
      open = null;
    },
    open(threadId: string | null) {
      open = threadId;
    },
    /** Sending clears the box it was sent from; a question from home then opens its new thread. */
    submit(newThreadId?: string) {
      drafts = withDraft(drafts, draftKey(open), '');
      if (open === null && newThreadId) open = newThreadId;
    },
  };
}

describe('one draft per place', () => {
  it('does not carry a prefilled question into an older thread, and keeps it for the home screen', () => {
    const b = box();
    b.open('vancomycin-thread');
    b.prefill('Cefazolin question');
    expect(b.text).toBe('Cefazolin question');
    b.open('vancomycin-thread');
    expect(b.text).toBe('');
    b.open(null);
    expect(b.text).toBe('Cefazolin question');
  });

  it("brings back a thread's half-typed follow-up when that thread is reopened", () => {
    const b = box();
    b.open('a');
    b.type('Follow-up for A');
    b.open('b');
    expect(b.text).toBe('');
    b.type('Follow-up for B');
    b.open('a');
    expect(b.text).toBe('Follow-up for A');
    b.open('b');
    expect(b.text).toBe('Follow-up for B');
  });

  it('clears only the draft of the place a question is sent from', () => {
    const b = box();
    b.open('a');
    b.type('Follow-up for A');
    b.open(null);
    b.type('New question');
    b.submit('c');
    expect(b.text).toBe('');
    b.open(null);
    expect(b.text).toBe('');
    b.open('a');
    expect(b.text).toBe('Follow-up for A');
    b.submit();
    expect(b.text).toBe('');
  });
});
