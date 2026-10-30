'use client';

import { useEffect, useRef } from 'react';
import type { DrugMatcher } from '@/lib/copilot/markdown';
import { effectiveLookup } from '@/lib/copilot/turn-status';
import type { CopilotThread } from '@/lib/copilot/types';
import { TurnView } from './TurnView';

/** The turns of one thread, oldest first. When a new turn starts (or another thread opens) it scrolls into view. */
export function ThreadView({
  thread,
  drugMatcher,
  onFollowUp,
  onRetry,
}: {
  thread: CopilotThread;
  drugMatcher: DrugMatcher;
  onFollowUp: (question: string) => void;
  onRetry: (turnId: string) => void;
}) {
  const latestRef = useRef<HTMLDivElement>(null);
  const latestId = thread.turns[thread.turns.length - 1]?.id;

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    latestRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [latestId]);

  return (
    <div className="pb-8 pt-6">
      {thread.turns.map((turn, i) => {
        const isLatest = turn.id === latestId;
        // A follow-up that reused an earlier turn's lookup stores only that turn's id; resolve it here.
        const shown = effectiveLookup(turn, thread.turns);
        return (
          <div
            key={turn.id}
            ref={isLatest ? latestRef : undefined}
            className={`scroll-mt-6 ${i > 0 ? 'mt-10 border-t border-white/10 pt-10' : ''}`}
          >
            <TurnView
              turn={turn}
              lookup={shown.lookup}
              lookupFromEarlierTurn={shown.fromEarlierTurn}
              isLatest={isLatest}
              onFollowUp={onFollowUp}
              onRetry={onRetry}
              drugMatcher={drugMatcher}
            />
          </div>
        );
      })}
    </div>
  );
}
