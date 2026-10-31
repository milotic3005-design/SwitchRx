'use client';

import { Fragment, useId, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronRight, Circle, Loader2, Minus } from 'lucide-react';
import { PharmacyLookupPanel } from '@/components/PharmacyLookupPanel';
import { stepStates, type StepState } from '@/lib/copilot/turn-status';
import type { CopilotTurn } from '@/lib/copilot/types';
import type { LookupResult } from '@/lib/pharmacy-lookup';

const STATE_WORD: Record<StepState, string> = {
  pending: 'not started',
  active: 'in progress',
  done: 'done',
  failed: 'unavailable',
  skipped: 'not completed',
};

/** The amber for safety cautions, deeper in the light theme for contrast. */
export const AMBER = 'text-amber-400 [html.light_&]:text-amber-700';

function StateIcon({ state }: { state: StepState }) {
  switch (state) {
    case 'done':
      return <Check size={12} strokeWidth={2.5} className="shrink-0 text-emerald-400" aria-hidden="true" />;
    case 'active':
      return <Loader2 size={12} className="shrink-0 animate-spin text-blue-400" aria-hidden="true" />;
    case 'failed':
      return <AlertTriangle size={12} strokeWidth={2} className={`shrink-0 ${AMBER}`} aria-hidden="true" />;
    case 'skipped':
      return <Minus size={12} className="shrink-0 text-slate-600" aria-hidden="true" />;
    case 'pending':
      return <Circle size={8} className="shrink-0 text-slate-600" aria-hidden="true" />;
  }
}

/**
 * What the app did for a question: Identified drugs → Checked FDA labels & safety lists →
 * Searched literature & guidelines → Done. Collapsed to one line that updates live while the turn runs;
 * expanding it shows the identified drugs and the pharmacy lookup panel. A failed or timed-out lookup
 * reads "FDA lookup unavailable" in amber, collapsed or not; a lookup that named no drug skips both
 * lookup steps and reads "No drugs to check against FDA labels". While an answer that came back without
 * sources is asked again, the search step is active again and reads "No sources yet — searching again".
 * A lookup reused from an earlier turn says so under the line.
 */
export function StepTimeline({
  turn,
  lookup,
  fromEarlierTurn,
}: {
  turn: CopilotTurn;
  /** The lookup this turn shows: its own, or the earlier turn's it reused (see `effectiveLookup`). */
  lookup: LookupResult | null;
  fromEarlierTurn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const states = stepStates(turn, lookup);
  const drugNames = lookup?.classification.drug_names ?? [];

  const steps: { key: string; state: StepState; label: ReactNode }[] = [
    { key: 'drugs', state: states.drugs, label: 'Identified drugs' },
    {
      key: 'fda',
      state: states.fda,
      label:
        states.fda === 'failed' ? (
          <span className={`font-medium ${AMBER}`}>FDA lookup unavailable</span>
        ) : states.noDrugs ? (
          'No drugs to check against FDA labels'
        ) : (
          'Checked FDA labels & safety lists'
        ),
    },
    {
      key: 'search',
      state: states.search,
      label: states.searchingAgain ? 'No sources yet — searching again' : 'Searched literature & guidelines',
    },
    { key: 'done', state: states.done, label: 'Done' },
  ];

  // On a narrow screen the line shows only where things stand now (plus a failed lookup), not all four steps.
  const latest = steps.reduce((at, step, i) => (['done', 'active', 'failed'].includes(step.state) ? i : at), 0);

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-start gap-1.5 rounded-lg px-1.5 py-1 text-left text-[12px] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500"
      >
        {expanded ? (
          <ChevronDown size={14} className="mt-px shrink-0 text-slate-500" aria-hidden="true" />
        ) : (
          <ChevronRight size={14} className="mt-px shrink-0 text-slate-500" aria-hidden="true" />
        )}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {steps.map((step, i) => (
            <Fragment key={step.key}>
              {i > 0 && <ArrowRight size={10} className="shrink-0 text-slate-600 max-sm:hidden" aria-hidden="true" />}
              <span
                className={`inline-flex items-center gap-1 ${
                  step.state === 'done' || step.state === 'active' ? 'text-slate-300' : 'text-slate-500'
                } ${i === latest || step.state === 'failed' ? '' : 'max-sm:hidden'}`}
              >
                <StateIcon state={step.state} />
                {step.label}
                <span className="sr-only">{`, ${STATE_WORD[step.state]}`}</span>
              </span>
            </Fragment>
          ))}
        </span>
      </button>
      {fromEarlierTurn && <p className="pl-[26px] text-[11px] text-slate-500">Using drug info from earlier in this thread</p>}

      {expanded && (
        <div id={panelId} className="mt-2 space-y-3 pl-5">
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-slate-300">Identified drugs</span>
            {drugNames.length > 0 ? (
              drugNames.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] capitalize text-slate-300"
                >
                  {name}
                </span>
              ))
            ) : (
              <span className="text-slate-500">{states.drugs === 'active' ? '…' : '—'}</span>
            )}
          </div>
          <PharmacyLookupPanel lookup={lookup} isLoading={turn.lookupState === 'pending' && states.running} />
        </div>
      )}
    </div>
  );
}
