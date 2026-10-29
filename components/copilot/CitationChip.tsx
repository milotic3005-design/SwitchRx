'use client';

import { useCallback, useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { chipLabel } from '@/lib/copilot/citations';
import type { EnrichedSource } from '@/lib/copilot/types';
import { AnchoredPopover } from './AnchoredPopover';
import { SourceEntry } from './SourceEntry';

const HOVER_CLOSE_DELAY_MS = 150;

/**
 * A citation pill at the end of a sentence, e.g. "IDSA + 1". Hovering, focusing or tapping it opens a
 * card listing each reference (with a link to the full list); Escape and a press outside close it.
 * Tapping or pressing Enter pins the card open until the next tap, Escape, or focus leaving.
 */
export function CitationChip({
  refNums,
  refs,
  sources,
  referencesId,
}: {
  /** The 1-based reference numbers this chip stands for. */
  refNums: number[];
  /** `refs[n - 1]` is the index in `sources` of reference `n`. */
  refs: number[];
  sources: EnrichedSource[];
  /** The `id` of the reference list the card links to. */
  referencesId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const popoverId = useId();

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(false);
    setPinned(false);
  }, []);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const label = chipLabel(refNums, refs, sources);
  if (!label) return null;

  const entries = [...new Set(refNums)].flatMap(n => {
    const source: EnrichedSource | undefined = sources[refs[n - 1]];
    return source ? [{ n, source }] : [];
  });

  const handleFocus = (e: FocusEvent<HTMLElement>) => {
    // Only focus arriving from outside opens the card, so returning focus to the pill after Escape stays closed.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const handleBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
  };

  return (
    <span
      onMouseEnter={() => {
        clearTimeout(closeTimer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        if (pinned) return;
        closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (open && pinned) {
            close();
          } else {
            clearTimeout(closeTimer.current);
            setOpen(true);
            setPinned(true);
          }
        }}
        className="mx-0.5 inline-flex items-center whitespace-nowrap rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-px align-baseline font-body text-[11px] font-medium not-italic leading-4 text-blue-300 transition-colors hover:border-blue-500/50 hover:bg-blue-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500"
      >
        {label}
      </button>
      {open && (
        <AnchoredPopover
          id={popoverId}
          label={entries.length === 1 ? 'Reference' : 'References'}
          anchorRef={buttonRef}
          onClose={close}
        >
          <span className="block space-y-3">
            {entries.map(({ n, source }) => (
              <SourceEntry key={n} source={source} number={n} />
            ))}
          </span>
          <a
            href={`#${referencesId}`}
            onClick={close}
            className="mt-3 block border-t border-white/10 pt-2 text-[12px] font-medium text-blue-400 hover:text-blue-300"
          >
            See all references
          </a>
        </AnchoredPopover>
      )}
    </span>
  );
}
