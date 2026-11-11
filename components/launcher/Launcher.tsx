"use client";
import type { RefObject } from 'react';
import { DRUG_DB } from '@/data/drug-database';
import { CALCULATORS, TOOLS, isCalcId, toolLine } from '@/lib/launcher/catalog';
import { DEST_PLACE, type RecentItem, type Target } from '@/lib/launcher/search';
import { useFinePointer, useRecents } from './hooks';
import { TOOL_ICONS } from './icons';
import { SearchPanel } from './SearchPanel';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500';

/** What a recent item's chip says and where it leads, or null when its drug or calculator no longer exists. */
function recentChip(item: RecentItem): { label: string; target: Target } | null {
  if (item.kind === 'calculator') {
    const calc = isCalcId(item.id) ? CALCULATORS.find(c => c.id === item.id) : undefined;
    return calc ? { label: calc.label, target: { kind: 'calculator', id: calc.id } } : null;
  }
  const drug = DRUG_DB.find(d => d.id === item.id);
  const dest = item.dest ?? 'mixing';
  return drug ? { label: `${drug.genericName} · ${DEST_PLACE[dest]}`, target: { kind: 'drug', id: drug.id, dest } } : null;
}

/**
 * The home page: one search box, a card for each of the six tools, and the drugs and calculators opened
 * last. The search box takes focus on a computer with a mouse or trackpad, so typing can start at once;
 * on a touch device it does not, so the keyboard stays closed.
 */
export function Launcher({ onGo, searchInputRef }: { onGo: (target: Target) => void; searchInputRef: RefObject<HTMLInputElement | null> }) {
  const recents = useRecents();
  const finePointer = useFinePointer();
  const counts = { drugs: DRUG_DB.length, calculators: CALCULATORS.length };
  const chips = recents.flatMap(item => recentChip(item) ?? []);

  return (
    <div className="pt-32 pb-16 px-6 md:px-12 max-w-5xl mx-auto w-full">
      <h1 className="sr-only">ClinicalRx AI</h1>

      <SearchPanel variant="inline" recents={recents} onGo={onGo} inputRef={searchInputRef} autoFocus={finePointer} />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(tool => {
          const Icon = TOOL_ICONS[tool.tab];
          return (
            <button
              key={tool.tab}
              type="button"
              onClick={() => onGo({ kind: 'tool', tab: tool.tab })}
              className={`glass-card flex items-start gap-4 rounded-2xl p-5 text-left ${FOCUS_RING}`}
            >
              <div className="shrink-0 rounded-xl border border-violet-500/20 bg-violet-500/10 p-2.5">
                <Icon className="text-violet-400" size={20} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-[16px] font-semibold text-white">{tool.label}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-slate-400">{toolLine(tool.tab, counts)}</div>
              </div>
            </button>
          );
        })}
      </div>

      {chips.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] font-medium text-slate-500">Recent</span>
          {chips.map(chip => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onGo(chip.target)}
              className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
