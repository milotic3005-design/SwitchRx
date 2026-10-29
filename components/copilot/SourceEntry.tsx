import { ExternalLink } from 'lucide-react';
import { safeHttpUrl } from '@/lib/copilot/safe-url';
import { isRecent, TYPE_LABEL } from '@/lib/copilot/source-types';
import type { EnrichedSource } from '@/lib/copilot/types';

const TAG = 'rounded-full border px-1.5 py-px text-[10px] font-medium leading-4';

/**
 * One source as shown in the reference list and in the citation and source-mix cards: an optional
 * number, the title (a link only when its URL is a plain http(s) one), then journal or site · year ·
 * authors, then the type tag and a "Recent" tag. Built from `<span>`s so it is valid inside a paragraph.
 */
export function SourceEntry({ source, number }: { source: EnrichedSource; number?: number }) {
  const href = safeHttpUrl(source.url);
  const title = source.title.trim() || source.site || 'Untitled source';
  const meta = [source.journal || source.site, source.year, source.authors].filter(Boolean).join(' · ');

  return (
    <span className="flex items-start gap-2">
      {number !== undefined && (
        <span className="mt-px w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-slate-500">{number}</span>
      )}
      <span className="block min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1 break-words text-[13px] font-medium leading-snug text-blue-400 underline decoration-blue-400/40 hover:text-blue-300 hover:decoration-blue-300"
          >
            <span>{title}</span>
            <ExternalLink size={11} strokeWidth={1.5} className="mt-0.5 shrink-0 opacity-70" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <span className="break-words text-[13px] font-medium leading-snug text-slate-200">{title}</span>
        )}
        {meta && <span className="mt-0.5 block text-[12px] leading-snug text-slate-400">{meta}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <span className={`${TAG} border-white/10 bg-white/5 text-slate-400`}>{TYPE_LABEL[source.type]}</span>
          {isRecent(source.year, new Date()) && (
            <span className={`${TAG} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`}>Recent</span>
          )}
        </span>
      </span>
    </span>
  );
}
