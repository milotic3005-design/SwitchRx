const FENCE = '```followups';
const CLOSE = '```';
const MAX_FOLLOW_UPS = 3;
// Leading list marker: "-", "*", or "1." followed by whitespace or end of line,
// so emphasis such as "**Bold**" is not mistaken for a bullet.
const LIST_MARKER = /^(?:[-*]|\d+\.)(?:\s+|$)/;

export interface FollowUpSplit {
  /** The answer text with any follow-up block (or partial opening fence) removed. */
  body: string;
  /** Up to three suggested follow-up questions; empty while the block is still streaming. */
  followUps: string[];
  /** True while a follow-up block is open or being typed and `final` is not set. */
  pending: boolean;
}

/**
 * Splits a model answer into its prose and the trailing "```followups" block.
 * Call with `final` omitted/false on partial streamed text, and `final: true`
 * once the stream has ended.
 */
export function splitFollowUps(text: string, final = false): FollowUpSplit {
  const lines = text.split('\n');

  let open = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === FENCE) {
      open = i;
      break;
    }
  }

  if (open >= 0) {
    const body = lines.slice(0, open).join('\n').trimEnd();
    const items: string[] = [];
    let closed = false;
    for (const line of lines.slice(open + 1)) {
      const trimmed = line.trim();
      if (trimmed === CLOSE) {
        closed = true;
        break;
      }
      const item = trimmed.replace(LIST_MARKER, '').trim();
      if (item) items.push(item);
    }
    const pending = !closed && !final;
    return { body, followUps: pending ? [] : items.slice(0, MAX_FOLLOW_UPS), pending };
  }

  if (!final) {
    const last = lines[lines.length - 1].trim();
    if (last.length >= 3 && FENCE.startsWith(last)) {
      return { body: lines.slice(0, -1).join('\n').trimEnd(), followUps: [], pending: true };
    }
  }

  return { body: text, followUps: [], pending: false };
}
