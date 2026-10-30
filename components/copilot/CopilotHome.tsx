'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { EXAMPLE_CATEGORIES, SHORTCUTS } from '@/lib/copilot/examples';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500';

/**
 * What the Copilot tab shows before any question: the title, the question box (passed in as `composer`),
 * what is checked on every question, three shortcut chips, and a library of example questions. Picking
 * a shortcut or an example only hands its text to `onPickExample`; nothing is sent.
 */
export function CopilotHome({ composer, onPickExample }: { composer: ReactNode; onPickExample: (text: string) => void }) {
  const [examplesOpen, setExamplesOpen] = useState(false);
  const examplesId = useId();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center pb-8 pt-4 text-center sm:pt-12">
      <h1 className="text-3xl sm:text-4xl">Infusion Copilot</h1>
      <p className="mt-3 text-[15px] text-slate-400">Ask any infusion question. Answers cite their sources.</p>

      <div className="mt-8 w-full text-left">{composer}</div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-slate-400">
        <ShieldCheck size={13} className="shrink-0 text-emerald-400" aria-hidden="true" />
        Verified FDA label check on every question
      </p>
      <p className="mt-1 text-[12px] text-slate-500">Saved on this device · avoid patient identifiers</p>

      <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Shortcuts">
        {SHORTCUTS.map(shortcut => (
          <li key={shortcut.label}>
            <button
              type="button"
              onClick={() => onPickExample(shortcut.text)}
              className={`rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[13px] text-slate-300 transition-colors hover:bg-white/10 ${FOCUS_RING}`}
            >
              {shortcut.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-8 w-full">
        <button
          type="button"
          aria-expanded={examplesOpen}
          aria-controls={examplesOpen ? examplesId : undefined}
          onClick={() => setExamplesOpen(o => !o)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-slate-400 transition-colors hover:bg-white/5 ${FOCUS_RING}`}
        >
          {examplesOpen ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
          Explore example questions
        </button>

        {examplesOpen && (
          <div id={examplesId} className="glass-panel mt-3 grid gap-x-6 gap-y-5 p-4 text-left sm:grid-cols-2">
            {EXAMPLE_CATEGORIES.map((category, i) => {
              const titleId = `${examplesId}-${i}`;
              return (
                <div key={category.title} role="group" aria-labelledby={titleId}>
                  <p id={titleId} className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {category.title}
                  </p>
                  <ul>
                    {category.examples.map(example => (
                      <li key={example}>
                        <button
                          type="button"
                          onClick={() => onPickExample(example)}
                          className={`block w-full rounded-lg px-2 py-1.5 text-left text-[13px] leading-5 text-slate-300 transition-colors hover:bg-white/10 ${FOCUS_RING}`}
                        >
                          {example}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
