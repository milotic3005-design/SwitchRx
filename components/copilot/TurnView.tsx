'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, CornerDownRight, Gamepad2, RotateCcw, Square } from 'lucide-react';
import { WaitGame } from '@/components/WaitGame';
import { placeCitations, toPlainText } from '@/lib/copilot/citations';
import type { DrugMatcher } from '@/lib/copilot/markdown';
import type { CopilotTurn } from '@/lib/copilot/types';
import { AnswerBlock } from './AnswerBlock';
import { ReferenceList } from './ReferenceList';
import { SafetyStrip } from './SafetyStrip';
import { SourceMixBadge } from './SourceMixBadge';
import { StepTimeline } from './StepTimeline';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500';

const SMALL_BUTTON = `inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] font-medium text-slate-300 transition-colors hover:bg-white/10 ${FOCUS_RING}`;

const COPIED_MS = 2000;

const DEPTH_LABEL = { quick: 'Quick', thorough: 'Thorough' } as const;

const ASKED_AT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** When the question was asked, e.g. "Oct 29, 3:42 PM"; null for a timestamp outside the Date range (hand-edited storage). */
function askedAt(timestamp: number): { iso: string; label: string } | null {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : { iso: date.toISOString(), label: ASKED_AT.format(date) };
}

const NO_SOURCES_NOTE = "These sources couldn't be tied to specific sentences.";

/**
 * One question and its answer: the question, its depth and time with the mix of sources behind the
 * answer, safety flags from the pharmacy lookup, the step timeline, then the answer with citation chips,
 * its references, and the actions on it (copy, retry, suggested follow-ups).
 *
 * Chips are placed only once the text has stopped streaming. When none can be placed the sources are
 * still listed, as "Sources searched".
 */
export const TurnView = memo(function TurnView({
  turn,
  isLatest,
  onFollowUp,
  onRetry,
  drugMatcher,
}: {
  turn: CopilotTurn;
  isLatest: boolean;
  onFollowUp: (question: string) => void;
  onRetry: (turnId: string) => void;
  drugMatcher: DrugMatcher;
}) {
  const [gameOpen, setGameOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const running = turn.status === 'lookup' || turn.status === 'streaming' || turn.status === 'resolving';
  const textFinal = turn.status !== 'lookup' && turn.status !== 'streaming';
  const waitingForText = turn.depth === 'thorough' && turn.status === 'streaming' && turn.firstTokenAt === undefined;
  const referencesId = `copilot-refs-${turn.id}`;

  const view = useMemo(() => {
    if (!textFinal) return { markdown: turn.answer, chipRefs: [] as number[], listed: [] as number[], cited: false };
    const placement = placeCitations(turn.answer, turn.supports, turn.sources.length);
    const cited = placement.refs.length > 0;
    return {
      markdown: placement.markdown,
      chipRefs: placement.refs,
      // With chips, every source a support named (the dropped ones after the cited ones); without, all of them.
      listed: cited ? [...placement.refs, ...placement.uncited] : turn.sources.map((_, i) => i),
      cited,
    };
  }, [textFinal, turn.answer, turn.supports, turn.sources]);

  const listedSources = useMemo(() => view.listed.map(i => turn.sources[i]), [view.listed, turn.sources]);
  const flags = turn.lookup?.safety_flags ?? [];
  const asked = askedAt(turn.askedAt);
  const hasAnswer = turn.answer.trim().length > 0;

  const copyAnswer = () => {
    const text = toPlainText(view.markdown, view.listed, turn.sources);
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => {
        // Clipboard refused (permissions or an insecure context): leave the button as it was.
      },
    );
  };

  return (
    <article className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-slate-200">{turn.question}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[12px] text-slate-500">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-px text-[11px] font-medium text-slate-400">
            {DEPTH_LABEL[turn.depth]}
          </span>
          {asked && <time dateTime={asked.iso}>{asked.label}</time>}
        </p>
        <SourceMixBadge sources={listedSources} />
      </div>

      <SafetyStrip flags={flags} />
      <StepTimeline turn={turn} />

      {waitingForText &&
        (gameOpen ? (
          <WaitGame active={waitingForText} />
        ) : (
          <button
            type="button"
            onClick={() => setGameOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] font-medium text-blue-400 underline decoration-blue-400/40 transition-colors hover:bg-white/5 ${FOCUS_RING}`}
          >
            <Gamepad2 size={13} aria-hidden="true" />
            Play while you wait
          </button>
        ))}

      {hasAnswer && (
        <AnswerBlock
          markdown={view.markdown}
          refs={view.chipRefs}
          sources={turn.sources}
          drugMatcher={drugMatcher}
          referencesId={referencesId}
        />
      )}

      {turn.status === 'stopped' && (
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Square size={10} fill="currentColor" aria-hidden="true" />
            Stopped
          </span>
          <button type="button" onClick={() => onRetry(turn.id)} className={SMALL_BUTTON}>
            <RotateCcw size={12} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {turn.status === 'error' && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-[13px] leading-5 text-slate-300">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="min-w-0 break-words">{turn.error || 'The answer could not be completed.'}</span>
          </p>
          <button type="button" onClick={() => onRetry(turn.id)} className={SMALL_BUTTON}>
            <RotateCcw size={12} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {!running && hasAnswer && (
        <div>
          <button type="button" onClick={copyAnswer} className={SMALL_BUTTON}>
            {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy answer'}
          </button>
        </div>
      )}

      {view.listed.length > 0 &&
        (view.cited ? (
          <ReferenceList id={referencesId} refs={view.listed} sources={turn.sources} heading="References" />
        ) : (
          <ReferenceList
            id={referencesId}
            refs={view.listed}
            sources={turn.sources}
            heading="Sources searched"
            note={NO_SOURCES_NOTE}
          />
        ))}

      {isLatest && !running && turn.followUps.length > 0 && (
        <section aria-labelledby={`${referencesId}-followups`}>
          <h3 id={`${referencesId}-followups`} className="text-[13px] font-semibold text-slate-200">
            Suggested follow-ups
          </h3>
          <ul className="mt-2 space-y-1.5">
            {turn.followUps.map(question => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => onFollowUp(question)}
                  className={`flex w-full items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-[13px] leading-5 text-slate-300 transition-colors hover:bg-white/10 ${FOCUS_RING}`}
                >
                  <CornerDownRight size={14} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
                  {question}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
});
