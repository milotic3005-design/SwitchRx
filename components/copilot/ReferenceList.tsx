'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EnrichedSource } from '@/lib/copilot/types';
import { SourceEntry } from './SourceEntry';

/**
 * The numbered list of sources under an answer, collapsible and open by default.
 *
 * Shows exactly the sources `refs` names (indices into `sources`), numbered 1..n in that order. A
 * number whose source is missing is skipped without renumbering the rest, so the numbers always match
 * the citation chips. A link to `#id` anywhere on the page (the citation cards' "See all references")
 * opens the list if it is collapsed.
 */
export function ReferenceList({
  id,
  refs,
  sources,
  heading,
  note,
}: {
  /** Anchor id for the section. */
  id: string;
  /** Source indices in display order; entry `i` is shown as reference `i + 1`. */
  refs: number[];
  sources: EnrichedSource[];
  heading: 'References' | 'Sources searched';
  note?: string;
}) {
  const [open, setOpen] = useState(true);
  const listId = useId();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('a[href]')?.getAttribute('href') === `#${id}`) setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [id]);

  const entries = refs.flatMap((sourceIndex, i) => {
    const source: EnrichedSource | undefined = sources[sourceIndex];
    return source ? [{ n: i + 1, source }] : [];
  });
  if (entries.length === 0) return null;

  return (
    <section id={id}>
      <h3 className="text-[13px]">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center gap-1.5 rounded-md py-1 text-left font-semibold text-slate-200 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500"
        >
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
          )}
          {heading}
          <span className="font-normal tabular-nums text-slate-500">{entries.length}</span>
        </button>
      </h3>
      <div id={listId} hidden={!open} className="mt-1">
        {note && <p className="mb-3 pl-5 text-[12px] text-slate-500">{note}</p>}
        <ol className="space-y-3 pl-1">
          {entries.map(({ n, source }) => (
            <li key={n}>
              <SourceEntry source={source} number={n} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
