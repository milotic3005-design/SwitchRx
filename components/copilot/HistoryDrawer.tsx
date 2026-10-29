'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Trash2, X } from 'lucide-react';
import type { CopilotThread } from '@/lib/copilot/types';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500';

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "Just now", "5 minutes ago", "yesterday", "3 days ago", then a plain date. */
function relativeDate(timestamp: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return RELATIVE.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return RELATIVE.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return RELATIVE.format(-days, 'day');
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  });
}

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  threads: CopilotThread[];
  activeThreadId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  storageAvailable: boolean;
  /** Where focus goes when the drawer closes, normally the History button. Defaults to where it was on open. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * The saved threads, newest first, in a drawer on the left: over the page on a narrow screen (with a
 * backdrop that closes it), below the page header on a wide one. Escape closes it from anywhere, and that
 * Escape goes no further, so a handler elsewhere does not also act on it. Focus moves into the drawer
 * when it opens and goes back to where it was (or to `returnFocusRef`, e.g. the History button) when it
 * closes, unless the user has already moved on to something else.
 *
 * It is positioned `fixed`, so render it outside any ancestor with a transform, filter, or backdrop-filter.
 * Opening a thread calls `onOpen` only; the owner decides whether the drawer then closes.
 */
export function HistoryDrawer({ open, ...props }: HistoryDrawerProps) {
  // Mounted only while open, so each opening starts with fresh focus and fresh relative dates.
  return open ? <DrawerPanel {...props} /> : null;
}

function DrawerPanel({
  onClose,
  threads,
  activeThreadId,
  onOpen,
  onDelete,
  onClearAll,
  storageAvailable,
  returnFocusRef,
}: Omit<HistoryDrawerProps, 'open'>) {
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [now] = useState(() => Date.now());
  const sorted = useMemo(() => [...threads].sort((a, b) => b.updatedAt - a.updatedAt), [threads]);

  // Focus in on open, back out on close. A layout effect, so the cleanup runs before the panel leaves the DOM
  // and can tell whether focus is still inside it.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const before = document.activeElement;
    // The owner's button, read when closing: it is the ref that matters, not the element it held at open.
    const returnTo = returnFocusRef;
    panel?.focus();
    return () => {
      const active = document.activeElement;
      if (active && active !== document.body && !panel?.contains(active)) return;
      const target = returnTo?.current ?? before;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, [returnFocusRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    // Capture phase, so this runs before any other Escape handler and can stop it from running.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const clearAll = () => {
    if (window.confirm('Clear all history? This removes every saved question and cannot be undone.')) onClearAll();
  };

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed bottom-0 left-0 top-0 z-[60] flex w-80 max-w-[85vw] flex-col border-r border-white/10 bg-[#121212] shadow-xl shadow-black/30 outline-none md:top-24"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 id={titleId} className="text-[15px]">
            History
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className={`inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 ${FOCUS_RING}`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="px-4 pt-3 text-[12px] text-slate-500">
          {storageAvailable ? 'Saved in this browser only' : "History can't be saved in this browser"}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {sorted.length === 0 ? (
            <p className="px-2 text-[13px] text-slate-500">No questions yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {sorted.map(thread => {
                const active = thread.id === activeThreadId;
                return (
                  <li key={thread.id} className={`flex items-stretch rounded-lg ${active ? 'bg-white/10' : ''}`}>
                    <button
                      type="button"
                      onClick={() => onOpen(thread.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5 ${FOCUS_RING}`}
                    >
                      <span className="line-clamp-2 text-[13px] leading-5 text-slate-200">{thread.title}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{relativeDate(thread.updatedAt, now)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(thread.id);
                        // The button is about to disappear: keep focus in the drawer.
                        panelRef.current?.focus();
                      }}
                      aria-label={`Delete “${thread.title}”`}
                      className={`inline-flex w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 ${FOCUS_RING}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {sorted.length > 0 && (
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={clearAll}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-400 transition-colors hover:bg-white/10 ${FOCUS_RING}`}
            >
              <Trash2 size={14} aria-hidden="true" />
              Clear all history
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
