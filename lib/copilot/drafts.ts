/**
 * The question box's unsent text, one draft per place: the home screen and each thread. Kept apart so a
 * question typed (or handed over from another tab) for one case is never sent as a follow-up in another
 * thread, where the model would answer it with that thread's patient details and drug lookup.
 */
export type Drafts = Readonly<Record<string, string>>;

/** The key of the home screen's draft. */
export const HOME_DRAFT = '';

/** The key of the box on screen: the open thread's id, or the home screen's key when no thread is open. */
export const draftKey = (activeThreadId: string | null): string => activeThreadId ?? HOME_DRAFT;

/** The draft at `key`, or '' when there is none. */
export const draftAt = (drafts: Drafts, key: string): string =>
  Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] : '';

/** `drafts` with the draft at `key` set to `text`, or removed when `text` is empty; the same object if nothing changes. */
export function withDraft(drafts: Drafts, key: string, text: string): Drafts {
  if (draftAt(drafts, key) === text) return drafts;
  const next: Record<string, string> = { ...drafts };
  if (text) next[key] = text;
  else delete next[key];
  return next;
}

/** Only the home screen's draft, for when every thread is gone. */
export const homeDraftOnly = (drafts: Drafts): Drafts => withDraft({}, HOME_DRAFT, draftAt(drafts, HOME_DRAFT));
