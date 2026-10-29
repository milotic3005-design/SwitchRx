'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

const GAP = 6;
const MARGIN = 8;

/** Puts `pop` just below `anchor` (or above when there is no room), kept inside the viewport. */
function place(anchor: HTMLElement, pop: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.max(MARGIN, Math.min(rect.left, viewportWidth - pop.offsetWidth - MARGIN));
  const below = rect.bottom + GAP;
  const above = rect.top - GAP - pop.offsetHeight;
  const top = below + pop.offsetHeight > viewportHeight - MARGIN && above >= MARGIN ? above : below;
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

/**
 * A card anchored to a trigger, rendered only while it is open.
 *
 * It is a manual popover, which the browser draws in the top layer: it is never clipped by a table
 * cell or a scrolling ancestor and ignores transformed ancestors, yet it stays in the DOM beside its
 * trigger, so keyboard focus moves into it naturally. Without Popover API support it falls back to
 * plain fixed positioning. The contents sit in a `<span>` so it is valid inside a paragraph.
 *
 * Escape and a press outside both the card and `anchorRef` call `onClose`.
 */
export function AnchoredPopover({
  id,
  label,
  anchorRef,
  onClose,
  children,
}: {
  id: string;
  /** Accessible name of the card. */
  label: string;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const popRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const pop = popRef.current;
    const anchor = anchorRef.current;
    if (!pop || !anchor) return;
    if (typeof pop.showPopover === 'function') {
      try {
        pop.showPopover();
      } catch {
        // Already showing: nothing to do.
      }
    }
    const reposition = () => place(anchor, pop);
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Take focus back to the trigger first so it is not lost when the card unmounts.
      if (popRef.current?.contains(document.activeElement)) anchorRef.current?.focus();
      onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node)) return;
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [anchorRef, onClose]);

  return (
    <span
      ref={popRef}
      id={id}
      role="dialog"
      aria-label={label}
      popover="manual"
      tabIndex={-1}
      style={{ position: 'fixed', inset: 'auto', margin: 0 }}
      className="not-prose block w-80 max-w-[calc(100vw-1rem)] max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl border border-white/10 bg-[#121212] p-3 font-body text-[13px] font-normal not-italic leading-5 text-slate-300 shadow-xl shadow-black/30 outline-none"
    >
      {children}
    </span>
  );
}
