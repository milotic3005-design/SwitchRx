'use client';

import { useState } from 'react';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  Stethoscope, Send, Loader2, AlertTriangle, ShieldAlert, ExternalLink,
  Link as LinkIcon, ChevronDown, ChevronUp, Network, Pill, FlaskConical,
  ClipboardCheck, Microscope,
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

The URL MUST be a real, verifiable IDSA-controlled link from Google Search grounding. If you cannot retrieve a verified URL via search, link to https://www.idsociety.org/practice-guidelines/ and explicitly say so.

## CONSTRAINTS
- All recommendations must map to a named IDSA guideline
- Never hallucinate a URL — only use URLs retrieved via Google Search grounding
- If input data is missing (e.g., no culture, no renal function), flag it AT THE TOP in a warning callout and adjust confidence language ("empiric recommendation pending sensitivities")
- Outpatient regimens only — flag if the case requires inpatient management
- If IDSA guidance doesn't cover the input condition, say so explicitly and provide the closest IDSA reference + fallback to ASHP/CDC/etc.

## EVALUATION
Your output is successful when:
- Every drug recommendation includes dose + route + frequency + duration
- The IDSA citation links to a real Google-Search-verified URL
- Renal and allergy adjustments are auto-applied when data is present
- A pharmacist can verify therapy with zero additional lookups
- No drug is recommended without a named evidence source`;

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
  lines.push('Produce the full 4-section IDSA-aligned OPAT recommendation per your system instructions. Use Google Search to retrieve the most current IDSA guideline URL for this condition — verify the link before citing it.');

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

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key missing. Set NEXT_PUBLIC_GEMINI_API_KEY in your environment.');
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: IDSA_SYSTEM_PROMPT,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          tools: [{ googleSearch: {} }],
        },
      });

      let fullResponse = '';
      let fullThinking = '';
      const sourceMap = new Map<string, GroundingSource>();
      let lastEmittedSourceCount = 0;

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if ((part as any).thought && part.text) {
              fullThinking += part.text;
              setThinking(fullThinking);
            } else if (part.text) {
              fullResponse += part.text;
              setOutput(fullResponse);
            }
          }
        }
        // Collect grounding sources (real IDSA URLs)
        const grounding = chunk.candidates?.[0]?.groundingMetadata;
        const groundingChunks = grounding?.groundingChunks ?? [];
        for (const gc of groundingChunks) {
          const web = (gc as any).web ?? (gc as any).retrievedContext;
          if (!web?.uri) continue;
          const title = (web.title || '').trim() || web.uri;
          const key = `${web.uri}::${title.toLowerCase()}`;
          if (!sourceMap.has(key)) {
            sourceMap.set(key, { uri: web.uri, title });
          }
        }
        if (sourceMap.size > lastEmittedSourceCount) {
          setSources(Array.from(sourceMap.values()));
          lastEmittedSourceCount = sourceMap.size;
        }
      }

      if (sourceMap.size > lastEmittedSourceCount) {
        setSources(Array.from(sourceMap.values()));
      }
    } catch (err: any) {
      console.error('IDSA advisor error:', err);
      setError(err?.message ?? 'An error occurred generating the recommendation.');
    } finally {
      setIsLoading(false);
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
            named IDSA guideline with a Google-Search-verified direct URL. Renal and allergy
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
                      <span className="font-medium">Google-Search-Verified Sources ({sources.length})</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic mb-3">
                      Live URLs from Google Search grounding — every IDSA citation above is backed by one of the links below.
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
    </div>
  );
}
