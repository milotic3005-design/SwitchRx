'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Check, ChevronDown, Square } from 'lucide-react';
import type { Depth } from '@/lib/copilot/types';
import { AnchoredPopover } from './AnchoredPopover';

const DEPTHS: { value: Depth; label: string; description: string }[] = [
  { value: 'quick', label: 'Quick', description: 'Fast answers to simple questions' },
  { value: 'thorough', label: 'Thorough', description: 'Careful answers for complex cases' },
];

const PLACEHOLDER = { hero: 'Ask an infusion question…', docked: 'Ask a follow-up…' } as const;

/** Tallest the box grows (px) before it scrolls. */
const MAX_HEIGHT = { hero: 224, docked: 160 } as const;

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500';

/**
 * The question box: an auto-growing textarea with the depth picker and a send arrow, which is replaced
 * by "Stop" while an answer is being generated. Enter sends (never mid-composition, never empty, never
 * while busy); Shift+Enter starts a new line. When the text is set from outside (an example, a shortcut,
 * a prefill) the box takes focus with the caret at the end, ready to edit or send.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  depth,
  onDepthChange,
  busy,
  variant,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  depth: Depth;
  onDepthChange: (depth: Depth) => void;
  busy: boolean;
  variant: 'hero' | 'docked';
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const depthButtonRef = useRef<HTMLButtonElement>(null);
  const checkedRadioRef = useRef<HTMLInputElement>(null);
  const lastTyped = useRef('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const groupName = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const placeholder = PLACEHOLDER[variant];
  const maxHeight = MAX_HEIGHT[variant];
  const canSend = !busy && value.trim().length > 0;
  const current = DEPTHS.find(d => d.value === depth) ?? DEPTHS[1];

  /** Sizes the box to its text, up to `maxHeight`, then lets it scroll. */
  const fit = useCallback(() => {
    const el = textareaRef.current;
    // Not laid out (the tab is hidden): leave the height alone and fit when it shows.
    if (!el || el.scrollHeight === 0) return;
    el.style.height = 'auto';
    const full = el.scrollHeight;
    el.style.height = `${Math.min(full, maxHeight)}px`;
    el.style.overflowY = full > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight]);

  useLayoutEffect(fit, [value, fit]);

  // Wrapping changes with the width, and a tab that was hidden has no width until it shows.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [fit]);

  // Text that did not come from typing here was filled in from outside.
  useEffect(() => {
    if (value === lastTyped.current) return;
    lastTyped.current = value;
    const el = textareaRef.current;
    if (!value || !el || document.activeElement === el) return;
    el.focus();
    el.setSelectionRange(value.length, value.length);
  }, [value]);

  // Opening the depth menu puts focus on the chosen option, so the arrow keys work straight away.
  useEffect(() => {
    if (menuOpen) checkedRadioRef.current?.focus({ preventScroll: true });
  }, [menuOpen]);

  const submit = () => {
    if (canSend) onSubmit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    // Enter that confirms an IME candidate must not send (keyCode 229 covers Safari, which reports
    // isComposing false on the keydown that ends a composition).
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    e.preventDefault();
    submit();
  };

  return (
    <div
      className={`border border-white/10 bg-white/5 px-3 pb-2 pt-3 has-[textarea:focus-visible]:outline has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-violet-500 ${
        variant === 'hero' ? 'rounded-2xl' : 'rounded-xl'
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => {
          lastTyped.current = e.target.value;
          onChange(e.target.value);
        }}
        onKeyDown={onKeyDown}
        rows={variant === 'hero' ? 2 : 1}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="send"
        autoComplete="off"
        className="block w-full resize-none overflow-hidden bg-transparent text-[16px] leading-6 text-slate-200 outline-none placeholder:text-slate-500"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <div>
          <button
            ref={depthButtonRef}
            type="button"
            aria-label={`Answer depth: ${current.label}`}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen(o => !o)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/10 ${FOCUS_RING}`}
          >
            {current.label}
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {menuOpen && (
            <AnchoredPopover id={menuId} label="Choose answer depth" anchorRef={depthButtonRef} onClose={closeMenu}>
              <span role="radiogroup" aria-label="Answer depth" className="block space-y-1">
                {DEPTHS.map(d => {
                  const checked = d.value === depth;
                  return (
                    <label
                      key={d.value}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/10 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet-500 ${
                        checked ? 'bg-white/5' : ''
                      }`}
                    >
                      <input
                        ref={checked ? checkedRadioRef : undefined}
                        type="radio"
                        name={groupName}
                        value={d.value}
                        checked={checked}
                        onChange={() => onDepthChange(d.value)}
                        onClick={() => {
                          closeMenu();
                          depthButtonRef.current?.focus();
                        }}
                        className="sr-only"
                      />
                      <span className="mt-0.5 flex w-4 shrink-0 justify-center" aria-hidden="true">
                        {checked && <Check size={14} className="text-blue-400" />}
                      </span>
                      <span className="block min-w-0">
                        <span className="block text-[13px] font-medium text-white">{d.label}</span>
                        <span className="block text-[12px] text-slate-400">{d.description}</span>
                      </span>
                    </label>
                  );
                })}
              </span>
            </AnchoredPopover>
          )}
        </div>

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[13px] font-medium text-white transition-colors ${FOCUS_RING}`}
          >
            <Square size={11} fill="currentColor" aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send question"
            className={`inline-flex size-8 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40 ${FOCUS_RING}`}
          >
            <ArrowUp size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
