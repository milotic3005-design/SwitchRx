"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Lock, SquarePen } from 'lucide-react';
import { Composer } from './copilot/Composer';
import { CopilotHome } from './copilot/CopilotHome';
import { HistoryDrawer } from './copilot/HistoryDrawer';
import { ThreadView } from './copilot/ThreadView';
import { useCopilot } from './copilot/useCopilot';
import { buildDrugMatcher } from '@/lib/copilot/markdown';
import type { Depth } from '@/lib/copilot/types';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500';

const BAR_BUTTON = `inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/10 ${FOCUS_RING}`;

/**
 * The Infusion Copilot tab: a question box on the home screen, then the open thread with a docked box
 * for follow-ups, plus the saved-thread history. A question handed over from another tab
 * (`prefillScenario`, re-applied whenever its token changes) starts a new question with the box filled
 * in but not sent. `onLock`, when given, adds a Lock button that returns to the password screen.
 */
export function InfusionConsult({
  prefillScenario,
  onLock,
}: {
  prefillScenario?: { scenario: string; autoSubmit: boolean; token: number } | null;
  onLock?: () => void;
} = {}) {
  const { state, activeThread, busy, storageAvailable, ask, stop, retry, newQuestion, openThread, deleteThread, clearAll } =
    useCopilot();
  const [draft, setDraft] = useState('');
  const [depth, setDepth] = useState<Depth>('thorough');
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  // DRUG_DB is static, so the drug-name matcher is built once.
  const [drugMatcher] = useState(buildDrugMatcher);

  // A new prefill fills the box during render, so it shows in the same render that makes the tab visible;
  // leaving the open thread for the home screen happens just after, in the effect below.
  const [prefillToken, setPrefillToken] = useState<number | null>(null);
  if (prefillScenario && prefillScenario.token !== prefillToken) {
    setPrefillToken(prefillScenario.token);
    setDraft(prefillScenario.scenario);
  }
  const handledPrefill = useRef<number | null>(null);
  useEffect(() => {
    if (prefillToken === null || handledPrefill.current === prefillToken) return;
    handledPrefill.current = prefillToken;
    newQuestion();
  }, [prefillToken, newQuestion]);

  // The docked box sits over the bottom of the window while the thread scrolls. Reserving its height as the
  // page's bottom scroll padding makes anything the browser brings into view (keyboard focus, scrollIntoView,
  // find in page) stop above the box instead of underneath it. While the tab is hidden the box measures 0.
  const dockRef = useRef<HTMLDivElement>(null);
  const threadOpen = activeThread !== null;
  useEffect(() => {
    const dock = dockRef.current;
    if (!threadOpen || !dock || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const reserve = () => {
      root.style.scrollPaddingBottom = `${dock.offsetHeight}px`;
    };
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.scrollPaddingBottom = '';
    };
  }, [threadOpen]);

  const submit = () => {
    ask(draft, depth);
    setDraft('');
  };
  const followUp = useCallback((question: string) => ask(question, depth), [ask, depth]);

  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const openFromHistory = useCallback(
    (id: string) => {
      openThread(id);
      setHistoryOpen(false);
    },
    [openThread],
  );

  const composer = (variant: 'hero' | 'docked') => (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      onStop={stop}
      depth={depth}
      onDepthChange={setDepth}
      busy={busy}
      variant={variant}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            ref={historyButtonRef}
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen(open => !open)}
            className={BAR_BUTTON}
          >
            <History size={14} aria-hidden="true" />
            History
          </button>
          {onLock && (
            <button type="button" onClick={onLock} className={BAR_BUTTON}>
              <Lock size={14} aria-hidden="true" />
              Lock
            </button>
          )}
        </div>
        {!storageAvailable && <p className="text-[12px] text-slate-500">History can&apos;t be saved in this browser</p>}
        {activeThread && (
          <button type="button" onClick={newQuestion} className={BAR_BUTTON}>
            <SquarePen size={14} aria-hidden="true" />
            New question
          </button>
        )}
      </div>

      {activeThread ? (
        <>
          <ThreadView thread={activeThread} drugMatcher={drugMatcher} onFollowUp={followUp} onRetry={retry} />
          {/* Pinned to the bottom of the window while the thread scrolls under it. It stays in the flow, so at
              the end of the page the thread finishes above it at any box height. The fade uses the page colour
              of the current theme so text passing beneath does not show through. */}
          <div
            ref={dockRef}
            className="sticky bottom-0 z-10 pb-4 pt-6"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--cc-ink) 1.5rem)' }}
          >
            <div className="rounded-xl bg-[#121212]">{composer('docked')}</div>
          </div>
        </>
      ) : (
        <CopilotHome composer={composer('hero')} onPickExample={setDraft} />
      )}

      <HistoryDrawer
        open={historyOpen}
        onClose={closeHistory}
        threads={state.threads}
        activeThreadId={state.activeThreadId}
        onOpen={openFromHistory}
        onDelete={deleteThread}
        onClearAll={clearAll}
        storageAvailable={storageAvailable}
        returnFocusRef={historyButtonRef}
      />
    </div>
  );
}
