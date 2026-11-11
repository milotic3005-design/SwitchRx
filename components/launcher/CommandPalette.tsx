"use client";
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Target } from '@/lib/launcher/search';
import { useRecents } from './hooks';
import { SearchPanel } from './SearchPanel';

/**
 * The search dialog behind Cmd+K. It stays mounted so its Escape handler is in place before any other
 * layer's; closed, it renders nothing. Closing without choosing (Escape, a press outside, the shortcut
 * again) puts focus back where it was. Choosing a result leaves focus to the place it opens.
 *
 * It must render inside the app's root element: a global `body > *` rule breaks `position: fixed` on an
 * element placed directly under `body`, and the top menu's backdrop blur breaks it inside the menu.
 */
export function CommandPalette({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo: (target: Target) => void }) {
  const recents = useRecents();
  const returnTo = useRef<HTMLElement | null>(null);

  // A layout effect runs before the search box takes focus (a passive effect), so this sees what had it.
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) returnTo.current = document.activeElement;
  }, [open]);
  useEffect(() => {
    if (open || !returnTo.current) return;
    if (returnTo.current.isConnected) returnTo.current.focus();
    returnTo.current = null;
  }, [open]);

  const state = useRef({ open, onClose });
  useEffect(() => {
    state.current = { open, onClose };
  }, [open, onClose]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing || !state.current.open) return;
      // Capture phase on window: this Escape closes the dialog and reaches no layer under it.
      e.preventDefault();
      e.stopImmediatePropagation();
      state.current.onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[15vh]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl"
      >
        <SearchPanel
          variant="dialog"
          recents={recents}
          autoFocus
          onGo={target => {
            // The place being opened takes focus; nothing to hand back.
            returnTo.current = null;
            onGo(target);
          }}
        />
      </div>
    </div>
  );
}
