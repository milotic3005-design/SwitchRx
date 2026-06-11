'use client';

import { useState, useRef, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { makeClient, streamClaude } from '@/lib/claude';
import {
  Stethoscope, Send, Loader2, AlertTriangle, ShieldAlert, ExternalLink,
  Link as LinkIcon, ChevronDown, ChevronUp, Network, Pill, FlaskConical,
  ClipboardCheck, Microscope, MessageSquare, Bot, User, CornerDownRight,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';

type GroundingSource = { uri: string; title: string };

// ─── System prompt — IDSA-aligned OPAT pharmacist persona ────────
const IDSA_SYSTEM_PROMPT = `You are an IDSA-certified infectious-disease clinical pharmacist specializing in outpatient parenteral antimicrobial therapy (OPAT). 15 years of outpatient infusion center experience. Evidence-based and IDSA-guideline-driven only.

## CONTEXT
Embedded in an outpatient infusion center tool used by pharmacists, infusion nurses, and prescribers. The clinical environment is OUTPATIENT INFUSION — not ICU, not inpatient. Therapy must be practically administrable in an ambulatory setting (typical OPAT regimens: once-daily or extended-interval IV; oral conversion when bioavailability ≥70%).

## REQUIRED OUTPUT STRUCTURE

CRITICAL MARKDOWN RULES (FOLLOW EXACTLY):
- Every section heading MUST start with "## " (two hashes + space) on its own line
- Every subsection MUST start with "### " on its own line
- Tables MUST have a blank line before AND after them
- Table header row, separator row (|---|---|...), and each data row MUST each be on their own line — NEVER collapse a table onto one line
- Do NOT use LaTeX or math notation ($...$). Write "fT>MIC > 40%" as plain text
- Use **bold** for inline labels, never colons-only

Return exactly four H2 sections, in this order, with a blank line between each section. Use clinical pharmacy shorthand (q8h, IV, BID, CrCl, AUC/MIC).

## Section 1 — Antibiotic Selection

Render exactly this markdown table (one row per line, blank line before and after the table):

| Tier | Drug · Dose · Route · Frequency · Duration | Rationale |
|---|---|---|
| First-line | Drug · dose · IV · qNh · X–Y days | One-line rationale |
| Renal-adjusted (CrCl X mL/min) | … | … |
| Allergy-adjusted | … | … |
| Second-line alternative | … | … |

OMIT the Renal-adjusted row if no CrCl/SCr provided. OMIT the Allergy-adjusted row if no allergy listed. Every drug recommendation MUST include all five elements: drug, dose, route, frequency, AND total duration.

## Section 2 — Monitoring Plan

### Baseline labs (pre-therapy)
- Specific labs by drug class

### Ongoing monitoring
- Parameter + interval (e.g., "SCr q48–72h")

### Therapeutic drug monitoring (TDM) targets
- AUC/MIC, troughs where applicable; "Not required for [drug class] with normal renal function" if N/A

### Clinical / infusion-site checkpoints
- Weekly clinical review, line care, fever curve

## Section 3 — Safety Alerts

Use these inline icons at the start of each alert (line them up as bullets):
- 🔴 for critical alerts
- 🟡 for warnings
- 🟢 for informational

Cover (one bullet each, in this order):
- Resistance / stewardship warnings (e.g., MERINO for ESBL bacteremia + pip-tazo)
- Drug–drug interactions (DDI flags)
- Allergy cross-reactivity caveats
- Pregnancy category (always include, write "N/A" if not applicable)

## Section 4 — Primary Source Reference

- **Guideline:** [Full guideline name]
- **Citation:** Authors · Year · Title · Publication · DOI
- **Direct URL:** [hyperlink to the official IDSA practice-guidelines page or the journal article]

The URL MUST be a real, verifiable IDSA-controlled link retrieved via web search. If you cannot retrieve a verified URL via search, link to https://www.idsociety.org/practice-guidelines/ and explicitly say so.

## CONSTRAINTS
- All recommendations must map to a named IDSA guideline
- Never hallucinate a URL — only use URLs retrieved via web search
- If input data is missing (e.g., no culture, no renal function), flag it AT THE TOP in a warning callout and adjust confidence language ("empiric recommendation pending sensitivities")
- Outpatient regimens only — flag if the case requires inpatient management
- If IDSA guidance doesn't cover the input condition, say so explicitly and provide the closest IDSA reference + fallback to ASHP/CDC/etc.

## EVALUATION
Your output is successful when:
- Every drug recommendation includes dose + route + frequency + duration
- The IDSA citation links to a real web-search-verified URL
- Renal and allergy adjustments are auto-applied when data is present
- A pharmacist can verify therapy with zero additional lookups
- No drug is recommended without a named evidence source`;

// ─── Follow-up chat addendum ──────────────────────────────────────
// Appended to the system prompt for the conversational thread that runs AFTER
// the structured recommendation. It tells the model to behave like a clinical
// chat partner — answer the specific follow-up concisely — rather than
// re-emitting the full 4-section template every turn.
const FOLLOWUP_ADDENDUM = `## FOLLOW-UP CHAT MODE
The structured 4-section recommendation has already been delivered above and is in your conversation history along with the full patient context. You are now in interactive clinical-chat mode with the pharmacist.

- Answer ONLY the specific follow-up question asked — be concise and conversational.
- Do NOT re-emit the full four-section template unless the pharmacist explicitly asks you to regenerate it.
- Stay anchored to the same patient: reuse their renal function, allergies, diagnosis, and cultures from the history without asking again.
- Keep the SAME markdown discipline: headings on their own line with "## "/"### ", tables with a blank line before and after and one row per line, no LaTeX.
- When you state a dose, interval, duration, or guideline claim, keep it IDSA-aligned and name the guideline.
- If the question moves outside OPAT/ID scope, say so briefly and redirect.`;

type ChatTurn = { role: 'user' | 'model'; content: string; sources?: GroundingSource[] };

// ─── Output post-processing (repair common LLM markdown malformations) ───
// The model occasionally collapses a 4-row markdown table onto a single line,
// omits the `##` prefix on Section headings, or leaks LaTeX math notation.
// These repairs run before react-markdown so the structured output renders
// even when the model's formatting drifts.
function repairLLMMarkdown(raw: string): string {
  let out = raw;

  // 1) Promote bare "Section N — Title" lines to H2 if not already prefixed.
  out = out.replace(/^(Section\s+\d+\s*[—\-:].*)$/gm, '## $1');

  // 2) Split inline-collapsed tables. The pattern "|<whitespace>|" only occurs
  //    at a ROW BOUNDARY in a markdown table (within a row, pipes always have
  //    cell content between them). So replacing every `|\s+|` with `|\n|`
  //    cleanly unspools "| h1 | h2 | |---|---|---| | r1c1 | r1c2 |" into
  //    proper line-per-row markdown.
  out = out.replace(/\|(\s+)\|/g, '|\n|');

  // 3) Ensure a blank line BEFORE a table starts (any pipe-line preceded by a
  //    non-pipe line), then collapse any blank line BETWEEN consecutive
  //    pipe-lines (GFM tables must be contiguous — header/separator/data rows
  //    cannot be split by blank lines or the table won't parse).
  out = out.replace(/([^\n|])\n(\|)/g, '$1\n\n$2');
  out = out.replace(/(\|[^\n]*\|)\n\n+(\|)/g, '$1\n$2');

  // 4) Strip LaTeX-style math markers ("$fT_{>MIC}$" → "fT>MIC").
  out = out.replace(/\$([^$]+)\$/g, (_m, expr) =>
    String(expr).replace(/[\{\}\\_]/g, '').replace(/\s+/g, ' ').trim()
  );

  // 5) Ensure each "## Section" is preceded by a blank line.
  out = out.replace(/([^\n])\n(## Section)/g, '$1\n\n$2');

  return out;
}

// ─── Markdown link rendering (same pattern as InfusionConsult) ────
const markdownComponents = {
  a: ({ href, children, ...props }: any) => (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/40 hover:decoration-blue-300 break-words inline-flex items-center gap-0.5"
    >
      {children}
      <ExternalLink size={11} strokeWidth={1.5} className="inline shrink-0 opacity-70" />
    </a>
  ),
};

// ─── Common diagnoses for the dropdown ────────────────────────────
const COMMON_DIAGNOSES = [
  '— Select diagnosis —',
  'Acute bacterial skin and skin-structure infection (ABSSSI / cellulitis)',
  'Complicated UTI / pyelonephritis',
  'Community-acquired pneumonia (CAP)',
  'Healthcare-associated pneumonia (HCAP)',
  'Aspiration pneumonia',
  'Diabetic foot infection (mild-moderate)',
  'Osteomyelitis (long bone)',
  'Vertebral osteomyelitis / discitis',
  'Septic arthritis (native joint)',
  'Prosthetic joint infection (PJI)',
  'Endocarditis (native valve, MSSA)',
  'Endocarditis (native valve, MRSA)',
  'Endocarditis (Enterococcus faecalis)',
  'Endocarditis (viridans Streptococcus)',
  'Bacteremia — MSSA',
  'Bacteremia — MRSA',
  'Bacteremia — Enterococcus',
  'Bacteremia — Gram-negative (ESBL)',
  'Bacteremia — Gram-negative (CRE)',
  'Intra-abdominal infection (mild-moderate)',
  'Lyme disease (early disseminated / neurologic)',
  'Other (specify in clinical context)',
];

const COMMON_ALLERGIES = [
  'Penicillin (rash)',
  'Penicillin (anaphylaxis)',
  'Cephalosporin',
  'Sulfa',
  'Vancomycin (red-man / DRESS)',
  'Macrolide',
  'Fluoroquinolone',
];

// ─── Input form ───────────────────────────────────────────────────
interface PatientInput {
  age: string;
  weight: string;
  sex: 'M' | 'F' | '';
  pregnant: boolean;
  scr: string;
  crcl: string;
  hepatic: 'Normal' | 'Child-Pugh A' | 'Child-Pugh B' | 'Child-Pugh C' | '';
  allergies: string[];
  allergyOther: string;
  diagnosis: string;
  diagnosisOther: string;
  cultures: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | '';
  clinicalNotes: string;
}

const emptyInput: PatientInput = {
  age: '',
  weight: '',
  sex: '',
  pregnant: false,
  scr: '',
  crcl: '',
  hepatic: '',
  allergies: [],
  allergyOther: '',
  diagnosis: '',
  diagnosisOther: '',
  cultures: '',
  severity: '',
  clinicalNotes: '',
};

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors';

const labelCls = 'block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5';

// ─── Build a structured user-facing prompt from the form values ────
function buildClinicalPrompt(p: PatientInput): string {
  const lines: string[] = ['# Patient Input', ''];

  // Demographics
  const demo: string[] = [];
  if (p.age) demo.push(`${p.age} yo`);
  if (p.sex) demo.push(p.sex === 'M' ? 'Male' : 'Female');
  if (p.weight) demo.push(`${p.weight} kg`);
  if (p.pregnant) demo.push('PREGNANT');
  if (demo.length) lines.push(`**Demographics:** ${demo.join(', ')}`);

  // Renal
  const renal: string[] = [];
  if (p.scr) renal.push(`SCr ${p.scr} mg/dL`);
  if (p.crcl) renal.push(`CrCl ${p.crcl} mL/min`);
  if (renal.length) lines.push(`**Renal function:** ${renal.join(', ')}`);
  else lines.push('**Renal function:** NOT PROVIDED — flag as missing data');

  // Hepatic
  if (p.hepatic && p.hepatic !== 'Normal') {
    lines.push(`**Hepatic function:** ${p.hepatic}`);
  } else if (p.hepatic === 'Normal') {
    lines.push('**Hepatic function:** Normal');
  }

  // Allergies
  const allergies = [...p.allergies, p.allergyOther].filter(Boolean);
  if (allergies.length) {
    lines.push(`**Allergies:** ${allergies.join('; ')}`);
  } else {
    lines.push('**Allergies:** None reported (NKDA)');
  }

  // Diagnosis
  const dx =
    p.diagnosis && p.diagnosis !== '— Select diagnosis —'
      ? p.diagnosis === 'Other (specify in clinical context)'
        ? p.diagnosisOther
        : p.diagnosis
      : p.diagnosisOther;
  if (dx) lines.push(`**Diagnosis:** ${dx}`);
  else lines.push('**Diagnosis:** NOT PROVIDED — flag as missing data');

  if (p.severity) lines.push(`**Severity:** ${p.severity}`);

  // Cultures
  if (p.cultures.trim()) {
    lines.push(`**Culture / sensitivity data:**\n${p.cultures.trim()}`);
  } else {
    lines.push('**Culture / sensitivity data:** NOT PROVIDED — empiric recommendation; flag confidence');
  }

  if (p.clinicalNotes.trim()) {
    lines.push(`**Additional clinical context:** ${p.clinicalNotes.trim()}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('Produce the full 4-section IDSA-aligned OPAT recommendation per your system instructions. Use web search to retrieve the most current IDSA guideline URL for this condition — verify the link before citing it.');

  return lines.join('\n');
}

// ─── Main component ──────────────────────────────────────────────
export function IDSAAntibioticAdvisor() {
  const [input, setInput] = useState<PatientInput>(emptyInput);
  const [output, setOutput] = useState('');
  const [thinking, setThinking] = useState('');
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  // ─── Follow-up clinical chat (seeded after a recommendation is generated) ──
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, isChatLoading]);

  const setField = <K extends keyof PatientInput>(field: K, value: PatientInput[K]) =>
    setInput(prev => ({ ...prev, [field]: value }));

  const toggleAllergy = (a: string) =>
    setInput(prev => ({
      ...prev,
      allergies: prev.allergies.includes(a)
        ? prev.allergies.filter(x => x !== a)
        : [...prev.allergies, a],
    }));

  const handleSubmit = async () => {
    const prompt = buildClinicalPrompt(input);
    setIsLoading(true);
    setError('');
    setOutput('');
    setThinking('');
    setSources([]);
    setIsThinkingExpanded(false);
    // Reset any prior follow-up conversation — it belonged to the last patient.
    setChat([]);
    setChatInput('');
    chatSessionRef.current = null;

    try {
      const client = makeClient();
      // Stream the recommendation with adaptive thinking + live web search so
      // every IDSA citation is backed by a real, verifiable URL.
      const { text: fullResponse } = await streamClaude({
        client,
        system: IDSA_SYSTEM_PROMPT,
        prompt,
        maxTokens: 8000,
        webSearch: true,
        cb: {
          onText: full => setOutput(full),
          onThinking: full => setThinking(full),
          onSources: srcs => setSources(srcs),
        },
      });

      // Seed the follow-up conversation history with the full patient context
      // and the recommendation, so the pharmacist can ask follow-up questions
      // without re-entering the case. With Claude this is simply an accumulating
      // messages array (each follow-up turn runs web search on its own), so no
      // separate grounding sidecar is needed.
      if (fullResponse.trim()) {
        chatSessionRef.current = [
          { role: 'user', content: prompt },
          { role: 'assistant', content: fullResponse },
        ] as Anthropic.MessageParam[];
      }
    } catch (err: any) {
      console.error('IDSA advisor error:', err);
      setError(err?.message ?? 'An error occurred generating the recommendation.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Follow-up chat send ──────────────────────────────────────────
  const handleChatSend = async () => {
    const question = chatInput.trim();
    if (!question || isChatLoading || !chatSessionRef.current) return;

    setChatInput('');
    setChat(prev => [...prev, { role: 'user', content: question }, { role: 'model', content: '' }]);
    setIsChatLoading(true);

    try {
      const client = makeClient();
      // Append this question to the running conversation history and stream the
      // reply with web search enabled, so follow-up answers carry their own
      // verifiable sources (no separate grounding sidecar needed).
      const history = (chatSessionRef.current as Anthropic.MessageParam[]) ?? [];
      const turn: Anthropic.MessageParam[] = [...history, { role: 'user', content: question }];

      const { text: full, sources: srcs } = await streamClaude({
        client,
        system: `${IDSA_SYSTEM_PROMPT}\n\n${FOLLOWUP_ADDENDUM}`,
        prompt: turn,
        maxTokens: 4000,
        webSearch: true,
        cb: {
          onText: t => setChat(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: t };
            return next;
          }),
          onSources: s => setChat(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], sources: s as GroundingSource[] };
            return next;
          }),
        },
      });

      // Persist the assistant turn so the next follow-up keeps full context.
      if (full.trim()) {
        chatSessionRef.current = [...turn, { role: 'assistant', content: full }] as Anthropic.MessageParam[];
      }
      void srcs;
    } catch (err: any) {
      console.error('IDSA follow-up chat error:', err);
      setChat(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'model' && !last.content) {
          next[next.length - 1] = { ...last, content: 'Error: unable to process the follow-up. Check API configuration and try again.' };
        }
        return next;
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const canSubmit =
    !!input.diagnosis && input.diagnosis !== '— Select diagnosis —' &&
    !isLoading;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
        <Stethoscope className="text-emerald-400 shrink-0 mt-1" size={16} strokeWidth={1.5} />
        <div>
          <h3 className="text-[15px] font-medium text-emerald-400">
            IDSA-Aligned OPAT Antibiotic Advisor
          </h3>
          <p className="text-[13px] text-emerald-200/80 mt-1 leading-relaxed">
            Patient-specific antibiotic regimens from an IDSA-certified outpatient parenteral
            antimicrobial therapy (OPAT) pharmacist persona. Every recommendation maps to a
            named IDSA guideline with a web-search-verified direct URL. Renal and allergy
            adjustments auto-apply when data is present.
          </p>
        </div>
      </div>

      {/* Input form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Age (yrs)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={input.age}
            onChange={e => setField('age', e.target.value)}
            className={inputCls}
            placeholder="e.g. 65"
          />
        </div>
        <div>
          <label className={labelCls}>Weight (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={input.weight}
            onChange={e => setField('weight', e.target.value)}
            className={inputCls}
            placeholder="e.g. 80"
          />
        </div>
        <div>
          <label className={labelCls}>Sex</label>
          <div className="flex gap-2">
            {(['M', 'F'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setField('sex', s)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  input.sex === s
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {s === 'M' ? 'Male' : 'Female'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>
            Pregnant? {input.sex !== 'F' && <span className="text-slate-600 normal-case font-normal">(female only)</span>}
          </label>
          <button
            type="button"
            disabled={input.sex !== 'F'}
            onClick={() => setField('pregnant', !input.pregnant)}
            className={`w-full py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              input.pregnant
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            {input.pregnant ? 'Yes — pregnant' : 'Not pregnant'}
          </button>
        </div>

        <div>
          <label className={labelCls}>SCr (mg/dL)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={input.scr}
            onChange={e => setField('scr', e.target.value)}
            className={inputCls}
            placeholder="e.g. 1.2"
          />
        </div>
        <div>
          <label className={labelCls}>CrCl (mL/min)</label>
          <input
            type="number"
            inputMode="decimal"
            value={input.crcl}
            onChange={e => setField('crcl', e.target.value)}
            className={inputCls}
            placeholder="e.g. 65"
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Hepatic function</label>
          <div className="grid grid-cols-4 gap-2">
            {(['Normal', 'Child-Pugh A', 'Child-Pugh B', 'Child-Pugh C'] as const).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setField('hepatic', h)}
                className={`py-2 rounded-xl text-[12px] font-medium border transition-colors ${
                  input.hepatic === h
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Allergies</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COMMON_ALLERGIES.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAllergy(a)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  input.allergies.includes(a)
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={input.allergyOther}
            onChange={e => setField('allergyOther', e.target.value)}
            className={inputCls}
            placeholder="Other allergies (free text)"
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>
            Diagnosis <span className="text-rose-400">*</span>
          </label>
          <select
            value={input.diagnosis}
            onChange={e => setField('diagnosis', e.target.value)}
            className={inputCls + ' cursor-pointer'}
          >
            {COMMON_DIAGNOSES.map(d => (
              <option key={d} value={d} className="bg-[#121212]">{d}</option>
            ))}
          </select>
          {(input.diagnosis === 'Other (specify in clinical context)' || !input.diagnosis) && (
            <input
              type="text"
              value={input.diagnosisOther}
              onChange={e => setField('diagnosisOther', e.target.value)}
              className={inputCls + ' mt-2'}
              placeholder="Specify diagnosis"
            />
          )}
        </div>

        <div>
          <label className={labelCls}>Severity</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Mild', 'Moderate', 'Severe'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setField('severity', s)}
                className={`py-2 rounded-xl text-[12px] font-medium border transition-colors ${
                  input.severity === s
                    ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>&nbsp;</label>
          <div className="text-[11px] text-slate-500 leading-snug pt-1">
            Severe disease may exceed outpatient OPAT scope — advisor will flag if inpatient
            management is more appropriate.
          </div>
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>
            <span className="inline-flex items-center gap-1"><Microscope size={11} /> Culture / sensitivity data</span>
          </label>
          <textarea
            value={input.cultures}
            onChange={e => setField('cultures', e.target.value)}
            className={inputCls + ' min-h-[80px] resize-y'}
            placeholder="e.g. Blood cx: MSSA, susceptible to cefazolin, oxacillin, vancomycin. MIC vancomycin 1 mg/L."
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Additional clinical context (optional)</label>
          <textarea
            value={input.clinicalNotes}
            onChange={e => setField('clinicalNotes', e.target.value)}
            className={inputCls + ' min-h-[60px] resize-y'}
            placeholder="e.g. HD-dependent, on warfarin, recent C. diff, prior IV access challenges"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="self-end bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating IDSA recommendation…
          </>
        ) : (
          <>
            <Send size={18} />
            Generate OPAT Recommendation
          </>
        )}
      </button>

      {/* Output */}
      {(output || isLoading || error) && (
        <div className="glass-panel overflow-hidden shadow-sm">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <h3 className="text-[15px] font-medium text-white flex items-center gap-2">
              <ClipboardCheck size={16} className="text-emerald-400" />
              IDSA-Aligned Recommendation
            </h3>
            {isLoading && !output && (
              <span className="text-[12px] text-emerald-400 animate-pulse flex items-center gap-1">
                <Network size={12} /> High Reasoning + Live IDSA Lookup
              </span>
            )}
          </div>

          {/* Thinking section */}
          {(thinking || isLoading) && (
            <div className="border-b border-white/10 bg-black/20">
              <button
                onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                className="w-full flex items-center justify-between p-4 text-[13px] text-slate-400 hover:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Network size={14} className={isLoading && !output ? 'animate-pulse text-emerald-400' : 'text-emerald-400'} />
                  <span className="font-medium">AI Reasoning Process</span>
                </div>
                {isThinkingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <AnimatePresence>
                {isThinkingExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 text-[13px] text-slate-500 font-mono whitespace-pre-wrap border-t border-white/5 bg-black/40 max-h-[300px] overflow-y-auto">
                      {thinking || 'Initializing reasoning engine…'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="p-6 overflow-y-auto bg-[#0a0a0a]">
            {error ? (
              <div className="text-red-400 text-[14px]">{error}</div>
            ) : output ? (
              <div className="flex flex-col">
                <div className="idsa-brief prose prose-sm prose-invert max-w-none
                                prose-headings:font-semibold prose-headings:text-white
                                prose-h2:text-[18px] prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2.5 prose-h2:border-b prose-h2:border-emerald-500/30 prose-h2:text-emerald-300 prose-h2:tracking-wide first:prose-h2:mt-0
                                prose-h3:text-[14px] prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-blue-300 prose-h3:uppercase prose-h3:tracking-wider first:prose-h3:mt-0
                                prose-h4:text-[12px] prose-h4:mt-4 prose-h4:mb-2 prose-h4:text-slate-300 prose-h4:uppercase prose-h4:tracking-wider
                                prose-p:my-3 prose-p:leading-7 prose-p:text-slate-300
                                prose-ul:my-3 prose-ol:my-3 prose-li:my-2 prose-li:leading-relaxed prose-li:text-slate-300
                                prose-strong:text-white
                                prose-hr:my-6 prose-hr:border-white/10
                                prose-blockquote:border-l-emerald-500/40 prose-blockquote:bg-emerald-500/5 prose-blockquote:py-1 prose-blockquote:not-italic
                                [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-emerald-500/20 [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:text-[12.5px]
                                [&_thead]:bg-emerald-500/10
                                [&_th]:text-emerald-200 [&_th]:font-bold [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-[11px] [&_th]:border-b [&_th]:border-emerald-500/20
                                [&_tbody_tr:nth-child(even)]:bg-white/[0.02]
                                [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_td]:border-t [&_td]:border-white/5 [&_td]:text-slate-300 [&_td]:leading-relaxed
                                [&_td:first-child]:font-semibold [&_td:first-child]:text-white [&_td:first-child]:whitespace-nowrap">
                  <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {repairLLMMarkdown(output)}
                  </Markdown>
                </div>

                {sources.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                      <LinkIcon size={11} strokeWidth={1.5} />
                      <span className="font-medium">Web-Search-Verified Sources ({sources.length})</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic mb-3">
                      Live URLs from Claude web search — every IDSA citation above is backed by one of the links below.
                    </p>
                    <ol className="space-y-2">
                      {sources.map((src, idx) => (
                        <li key={src.uri + idx} className="text-[12px] flex gap-2">
                          <span className="text-slate-500 shrink-0 tabular-nums">[{idx + 1}]</span>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/40 hover:decoration-blue-300 break-all inline-flex items-start gap-1 leading-snug"
                            title={src.uri}
                          >
                            <span>{src.title}</span>
                            <ExternalLink size={10} strokeWidth={1.5} className="inline shrink-0 mt-0.5 opacity-70" />
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-[14px] text-slate-500 text-center px-8">
                Your IDSA-aligned OPAT recommendation will appear here after generating.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Follow-up clinical chat — appears once a recommendation is generated */}
      {output && !isLoading && !error && (
        <div className="glass-panel overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
            <MessageSquare size={16} className="text-blue-400" />
            <h3 className="text-[15px] font-medium text-white">Follow-up Clinical Chat</h3>
            <span className="text-[11px] text-slate-500 ml-1">— same patient context, ask anything about this case</span>
          </div>

          <div className="max-h-[460px] overflow-y-auto p-5 space-y-5 bg-[#0a0a0a]">
            {chat.length === 0 && (
              <div className="flex items-start gap-3 text-[13px] text-slate-400">
                <CornerDownRight size={15} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  The recommendation above is loaded as context. Ask follow-ups like{' '}
                  <span className="text-slate-300">“why not cefazolin here?”</span>,{' '}
                  <span className="text-slate-300">“convert this to an oral step-down”</span>, or{' '}
                  <span className="text-slate-300">“adjust for CrCl 25”</span>.
                </p>
              </div>
            )}

            {chat.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-white/10 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {msg.role === 'user' ? <User size={14} strokeWidth={1.5} /> : <Bot size={14} strokeWidth={1.5} />}
                </div>
                <div className={`max-w-[85%] rounded-2xl p-4 text-[14px] ${msg.role === 'user' ? 'bg-white text-black rounded-tr-none' : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/5'}`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.content ? (
                    <div className="flex flex-col">
                      <div className="prose prose-sm prose-invert max-w-none
                                      prose-headings:font-semibold prose-headings:text-white
                                      prose-h2:text-[15px] prose-h2:mt-5 prose-h2:mb-2.5 prose-h2:pb-1.5 prose-h2:border-b prose-h2:border-emerald-500/30 prose-h2:text-emerald-300 first:prose-h2:mt-0
                                      prose-h3:text-[13px] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:text-blue-300 prose-h3:uppercase prose-h3:tracking-wider first:prose-h3:mt-0
                                      prose-p:my-2 prose-p:leading-7 prose-p:text-slate-300
                                      prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:leading-relaxed prose-li:text-slate-300
                                      prose-strong:text-white
                                      [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-emerald-500/20 [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:text-[12px]
                                      [&_thead]:bg-emerald-500/10
                                      [&_th]:text-emerald-200 [&_th]:font-bold [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-[10.5px] [&_th]:border-b [&_th]:border-emerald-500/20
                                      [&_tbody_tr:nth-child(even)]:bg-white/[0.02]
                                      [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top [&_td]:border-t [&_td]:border-white/5 [&_td]:text-slate-300
                                      [&_td:first-child]:font-semibold [&_td:first-child]:text-white">
                        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {repairLLMMarkdown(msg.content)}
                        </Markdown>
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-white/10">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                            <LinkIcon size={10} strokeWidth={1.5} />
                            <span className="font-medium">Verified Sources ({msg.sources.length})</span>
                          </div>
                          <ol className="space-y-1.5">
                            {msg.sources.map((src, idx) => (
                              <li key={src.uri + idx} className="text-[11.5px] flex gap-2">
                                <span className="text-slate-500 shrink-0 tabular-nums">[{idx + 1}]</span>
                                <a
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/40 hover:decoration-blue-300 break-all inline-flex items-start gap-1 leading-snug"
                                  title={src.uri}
                                >
                                  <span>{src.title}</span>
                                  <ExternalLink size={9} strokeWidth={1.5} className="inline shrink-0 mt-0.5 opacity-70" />
                                </a>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-slate-400">
                      <Loader2 size={14} className="animate-spin" /> Thinking…
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChatSend()}
              placeholder="Ask a follow-up about this case…"
              disabled={isChatLoading}
              className="flex-1 px-4 py-3 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50 outline-none bg-white/5 text-[14px] text-slate-200 placeholder:text-slate-500 disabled:opacity-50"
            />
            <button
              onClick={handleChatSend}
              disabled={isChatLoading || !chatInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-5 py-3 rounded-xl transition-colors flex items-center justify-center"
            >
              {isChatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={1.5} />}
            </button>
          </div>
          <p className="text-[12px] text-center text-slate-500 pb-3 -mt-1">
            AI-generated · IDSA-aligned · verify with primary literature before acting.
          </p>
        </div>
      )}
    </div>
  );
}
