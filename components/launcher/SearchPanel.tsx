"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Calculator, Network, Pill, Search } from 'lucide-react';
import { INITIAL_PANEL, activeTarget, panelKey, type PanelState } from '@/lib/launcher/panel-state';
import { DRUG_ACTIONS, rowTarget, searchAll, type RecentItem, type ResultRow, type Target } from '@/lib/launcher/search';
import { useShortcutHint } from './hooks';
import { TOOL_ICONS } from './icons';

const ACTION_BASE = 'rounded-full border px-2.5 py-0.5 text-[13px] font-medium transition-colors';
const ACTION_IDLE = 'border-white/10 text-slate-400 hover:bg-white/10 hover:text-white';
const ACTION_ACTIVE = 'border-violet-500/40 bg-violet-500/10 text-violet-300';

function RowIcon({ row }: { row: ResultRow }) {
  const Icon = row.kind === 'drug' ? Pill : row.kind === 'calculator' ? Calculator : row.kind === 'tool' ? TOOL_ICONS[row.tab] : Network;
  return <Icon size={15} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden="true" />;
}

/**
 * The one search: an input, its results and the keyboard handling. The home page shows it inline (the list
 * appears under the box while there is a query); the Cmd+K dialog shows it with the list always open.
 * Arrows move through the rows, Tab cycles a drug's three places, Enter goes to the active one.
 */
export function SearchPanel({
  variant,
  recents,
  onGo,
  onEscape,
  inputRef,
  autoFocus = false,
}: {
  variant: 'inline' | 'dialog';
  recents: RecentItem[];
  onGo: (target: Target) => void;
  onEscape?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<PanelState>(INITIAL_PANEL);
  const [listOpen, setListOpen] = useState(true);
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  const listId = useId();
  const hint = useShortcutHint();

  const sections = useMemo(() => searchAll(query, recents), [query, recents]);
  const rows = useMemo(() => sections.flatMap(s => s.rows), [sections]);
  // Each row's place in the flat list the arrow keys move through.
  const indexOf = useMemo(() => new Map(rows.map((row, i) => [row.key, i])), [rows]);
  const showList = variant === 'dialog' || (listOpen && query.trim() !== '');

  // Focus in an effect, not with the autoFocus attribute, so the dialog can note what had focus before it.
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, ref]);

  // A row reached with the arrow keys is brought into view; the list is shorter than its results can be.
  // A row reached with the mouse is already under the pointer, and scrolling it would move it away.
  const movedByKey = useRef(false);
  useEffect(() => {
    if (!showList || !movedByKey.current) return;
    document.getElementById(`${listId}-option-${panel.active}`)?.scrollIntoView({ block: 'nearest' });
  }, [panel.active, showList, listId]);

  const run = (target: Target) => {
    onGo(target);
    if (variant === 'inline') {
      setQuery('');
      setPanel(INITIAL_PANEL);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!showList) return setListOpen(true);
      const moved = panelKey(panel, e.key, rows);
      if (moved.handled) e.preventDefault();
      movedByKey.current = true;
      setPanel(moved.state);
    } else if (e.key === 'Tab') {
      if (!showList) return;
      const moved = panelKey(panel, e.shiftKey ? 'ShiftTab' : 'Tab', rows);
      // In the dialog Tab never leaves the input: there is nothing else to move to.
      if (moved.handled || variant === 'dialog') e.preventDefault();
      setPanel(moved.state);
    } else if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing || !showList) return;
      const target = activeTarget(panel, rows);
      if (!target) return;
      e.preventDefault();
      run(target);
    } else if (e.key === 'Escape') {
      if (variant === 'inline' && showList) setListOpen(false);
      onEscape?.();
    }
  };

  const optionId = (i: number) => `${listId}-option-${i}`;

  return (
    <div
      className={variant === 'inline' ? 'relative' : ''}
      // A press anywhere in the panel but the input (a heading, the padding, the list's scrollbar) must not
      // take focus from the input: typing would stop working, and on the home page the list would close.
      onMouseDown={e => {
        if (e.target !== ref.current) e.preventDefault();
      }}
    >
      <div
        className={
          variant === 'inline'
            ? 'flex items-center gap-3 rounded-2xl border border-white/10 bg-[#121212] px-4 py-3.5 transition-colors focus-within:border-violet-500/50'
            : 'flex items-center gap-3 border-b border-white/10 px-4 py-3.5'
        }
      >
        <Search size={18} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden="true" />
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setPanel(INITIAL_PANEL);
            setListOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setListOpen(true)}
          // On the home page the list covers the tool cards, so it closes when focus leaves the box.
          onBlur={() => {
            if (variant === 'inline') setListOpen(false);
          }}
          placeholder="Search any drug or calculator…"
          aria-label="Search drugs and tools"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && rows.length > 0 ? optionId(panel.active) : undefined}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500"
        />
        <kbd className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-[13px] text-slate-500">{hint}</kbd>
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className={
            variant === 'inline'
              ? 'absolute left-0 right-0 z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#121212] p-2 shadow-2xl'
              : 'max-h-[55vh] overflow-y-auto p-2'
          }
        >
          {sections.map(section => (
            <li key={section.heading ?? 'none'} role="presentation">
              {section.heading && <div className="px-3 pb-1 pt-2 text-[13px] font-medium text-slate-500">{section.heading}</div>}
              <ul role="presentation">
                {section.rows.map(row => {
                  const i = indexOf.get(row.key) ?? 0;
                  const active = i === panel.active;
                  const actions = row.kind === 'drug' && row.dest === undefined;
                  return (
                    <li
                      key={row.key}
                      id={optionId(i)}
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => {
                        if (active) return;
                        movedByKey.current = false;
                        setPanel({ active: i, action: 0 });
                      }}
                      onClick={() => run(rowTarget(row, 0))}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${active ? 'bg-white/10' : ''}`}
                    >
                      <RowIcon row={row} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-white">{row.title}</div>
                        {'subtitle' in row && row.subtitle && <div className="truncate text-[13px] text-slate-400">{row.subtitle}</div>}
                      </div>
                      {actions && (
                        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          {DRUG_ACTIONS.map((a, n) => (
                            <button
                              key={a.dest}
                              type="button"
                              tabIndex={-1}
                              onClick={e => {
                                e.stopPropagation();
                                run(rowTarget(row, n));
                              }}
                              className={`${ACTION_BASE} ${active && panel.action === n ? ACTION_ACTIVE : ACTION_IDLE}`}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
