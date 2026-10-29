'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { sourceMix } from '@/lib/copilot/source-types';
import type { EnrichedSource } from '@/lib/copilot/types';
import { AnchoredPopover } from './AnchoredPopover';
import { SourceEntry } from './SourceEntry';

/**
 * The one-line source mix for an answer, e.g. "1 FDA label · 2 guidelines · 1 trial". Clicking it opens
 * every source, grouped by type. Renders nothing when there are no sources.
 */
export function SourceMixBadge({ sources }: { sources: EnrichedSource[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const close = useCallback(() => setOpen(false), []);
  const mix = useMemo(() => sourceMix(sources), [sources]);

  if (mix.groups.length === 0) return null;

  return (
    <span className="inline-block max-w-full">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen(o => !o)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500"
      >
        <BookOpen size={12} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{mix.text}</span>
        <ChevronDown size={12} className="shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <AnchoredPopover id={popoverId} label="Sources by type" anchorRef={buttonRef} onClose={close}>
          <span className="block space-y-3">
            {mix.groups.map(group => (
              <span key={group.type} className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </span>
                <span className="block space-y-2.5">
                  {group.sourceIndices.map(i => (
                    <SourceEntry key={i} source={sources[i]} />
                  ))}
                </span>
              </span>
            ))}
          </span>
        </AnchoredPopover>
      )}
    </span>
  );
}
