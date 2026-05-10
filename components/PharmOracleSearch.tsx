'use client';

import { useState } from 'react';
import {
  Send, Loader2, AlertTriangle, ShieldAlert, Info, ExternalLink,
  Sparkles, Database, FileText, Network, Pill,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { runPipeline } from '@/lib/pharmoracle/engine/router';
import type { PharmOracleAnswer, SafetyFlag, ShortageStatus } from '@/lib/pharmoracle/types/clinical';
import type { EvidenceItem } from '@/lib/pharmoracle/types/evidence';
import type { QueryDomain } from '@/lib/pharmoracle/types/query';
import { emitOpenDrug } from '@/lib/cross-tab-events';
import { resolveDrugByKey } from '@/components/DrugReference';

// ─── Sub-components (dark-themed, ported from PharmOracle) ─────────

const DOMAIN_LABELS: Record<QueryDomain, string> = {
  iv_drug_info: 'IV Drug Info',
  drug_interaction: 'Drug Interaction',
  usp797_compounding: 'USP 797',
  oncology_support: 'Oncology Support',
  iv_iron: 'IV Iron',
  renal_hepatic_dosing: 'Renal/Hepatic Dosing',
  tdm_monitoring: 'TDM',
  shortage_management: 'Shortage Management',
  lab_monitoring: 'Lab Monitoring',
  general_clinical: 'General Clinical',
};

const DESIGN_LABELS: Record<EvidenceItem['study_design'], string> = {
  meta_analysis: '🥇 Meta-analysis',
  guideline: '📋 Guideline',
  RCT: '🥈 RCT',
  cohort: '📊 Cohort',
  review: '📖 Review',
  case_series: '📝 Case Series',
  case_report: '📝 Case Report',
};

function DomainBadge({ domain }: { domain: QueryDomain }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 text-[11px] font-semibold text-blue-300 tracking-wide">
      {DOMAIN_LABELS[domain]}
    </span>
  );
}

function SafetyFlagBlock({ flag }: { flag: SafetyFlag }) {
  const tone =
    flag.level === 'critical' ? 'border-red-500/40 bg-red-500/[0.08] text-red-200'
    : flag.level === 'warning' ? 'border-amber-500/40 bg-amber-500/[0.08] text-amber-200'
    : 'border-blue-500/40 bg-blue-500/[0.08] text-blue-200';

  const Icon = flag.level === 'critical' ? AlertTriangle : flag.level === 'warning' ? ShieldAlert : Info;
  const label = flag.level === 'critical' ? 'CRITICAL' : flag.level === 'warning' ? 'WARNING' : 'INFO';

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm ${tone}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1">
        <Icon className="w-3 h-3" />
        {label} · {flag.category.replace('_', ' ')}
      </div>
      <div className="leading-snug">{flag.message}</div>
    </div>
  );
}

function ShortageBlock({ status }: { status: ShortageStatus }) {
  if (status.status === 'Not Found') return null;
  const tone =
    status.status === 'Currently in Shortage' ? 'border-red-500/40 bg-red-500/[0.08] text-red-200'
    : status.status === 'Discontinued' ? 'border-slate-500/40 bg-slate-500/[0.08] text-slate-200'
    : 'border-amber-500/40 bg-amber-500/[0.08] text-amber-200';
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm ${tone}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1">Shortage · {status.status}</div>
      <div>
        <strong>{status.generic_name}</strong>
        {status.reason ? ` — ${status.reason}` : ''}
        {status.update_date ? ` (updated ${status.update_date})` : ''}
      </div>
      <a
        href={status.verification_url}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] underline decoration-current/40 hover:decoration-current mt-1 inline-flex items-center gap-0.5"
      >
        Verify on ASHP Drug Shortage Database <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

function EvidenceTable({ evidence }: { evidence: EvidenceItem[] }) {
  if (evidence.length === 0) {
    return (
      <p className="text-[11px] italic text-slate-500 border-t border-white/10 pt-3">
        Answer based on established pharmacy practice — no primary literature search performed for this query type.
      </p>
    );
  }
  return (
    <div className="border-t border-white/10 pt-4">
      <h4 className="text-[12px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
        <Database className="w-3 h-3" /> Evidence Sources ({evidence.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-white/10">
              <th className="py-1.5 pr-2 font-semibold w-6">#</th>
              <th className="py-1.5 pr-2 font-semibold">Study</th>
              <th className="py-1.5 pr-2 font-semibold whitespace-nowrap">Design</th>
              <th className="py-1.5 pr-2 font-semibold w-12">Year</th>
              <th className="py-1.5 font-semibold">Key Finding</th>
            </tr>
          </thead>
          <tbody>
            {evidence.slice(0, 5).map((e, i) => (
              <tr key={e.pmid} className="border-b border-white/5 align-top">
                <td className="py-2 pr-2 text-slate-500 tabular-nums">{i + 1}</td>
                <td className="py-2 pr-2">
                  <a
                    className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/40"
                    href={e.pubmed_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {e.title}
                  </a>
                  <div className="text-slate-500 italic text-[11px] mt-0.5">{e.journal}</div>
                </td>
                <td className="py-2 pr-2 whitespace-nowrap text-slate-300">{DESIGN_LABELS[e.study_design]}</td>
                <td className="py-2 pr-2 text-slate-400 tabular-nums">{e.year || '—'}</td>
                <td className="py-2 text-slate-300 leading-snug">{e.key_finding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BottomLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 text-sm text-emerald-200">
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1">📋 Clinical Bottom Line</div>
      <div className="leading-snug">{text}</div>
    </div>
  );
}

// Render markdown links with cross-tab drug linking
const markdownComponents = {
  a: ({ href, children, ...props }: any) => (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/40 break-words inline-flex items-center gap-0.5"
    >
      {children}
      <ExternalLink size={11} strokeWidth={1.5} className="inline shrink-0 opacity-70" />
    </a>
  ),
};

function AnswerCard({ answer }: { answer: PharmOracleAnswer }) {
  // Surface "open in Drug Reference" chips for drugs the SwitchRx monograph
  // database has entries for. We scan the first ~4 lines of the synthesized
  // answer (where the model puts the drug name in the H2/intro), grab tokens
  // ≥4 chars, and resolve each via the DrugReference key resolver. Capped at
  // 3 chips so the header doesn't bloat.
  const candidateLines = answer.clinical_content.split('\n').slice(0, 4).join(' ');
  const drugMatches: string[] = [];
  for (const word of candidateLines.split(/\s+/).slice(0, 80)) {
    const cleaned = word.replace(/[^A-Za-z\-/]/g, '');
    if (cleaned.length < 4) continue;
    const drug = resolveDrugByKey(cleaned);
    if (drug && !drugMatches.includes(drug.id)) drugMatches.push(drug.id);
    if (drugMatches.length >= 3) break;
  }

  return (
    <article className="glass-panel p-5 flex flex-col gap-4 shadow-sm">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <DomainBadge domain={answer.query_domain} />
        <div className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
          <FileText className="w-3 h-3" /> Sources: {answer.data_sources_used.join(', ')}
        </div>
      </header>

      {answer.safety_flags.length > 0 && (
        <div className="flex flex-col gap-2">
          {answer.safety_flags.map((f, i) => <SafetyFlagBlock key={i} flag={f} />)}
        </div>
      )}

      {answer.shortage_status && <ShortageBlock status={answer.shortage_status} />}

      {drugMatches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="uppercase tracking-widest text-[10px] text-slate-500">Open in Drug Reference:</span>
          {drugMatches.map(id => {
            const drug = resolveDrugByKey(id);
            if (!drug) return null;
            return (
              <button
                key={id}
                onClick={() => emitOpenDrug({ drugKey: id })}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-400/60 rounded-md px-1.5 py-0.5 transition-colors"
              >
                <Pill size={10} strokeWidth={2} className="shrink-0 opacity-80" />
                {drug.genericName}
              </button>
            );
          })}
        </div>
      )}

      <div className="prose prose-sm prose-invert max-w-none
                      prose-headings:font-semibold prose-headings:text-white
                      prose-h2:text-[17px] prose-h2:mt-5 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/10 first:prose-h2:mt-0
                      prose-h3:text-[14px] prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-blue-300
                      prose-p:my-2.5 prose-p:leading-7 prose-p:text-slate-300
                      prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1.5 prose-li:leading-relaxed prose-li:text-slate-300
                      prose-strong:text-white prose-table:my-4 prose-table:text-[12px]
                      prose-th:bg-white/5 prose-th:text-slate-200 prose-th:font-semibold prose-th:px-3 prose-th:py-2
                      prose-td:px-3 prose-td:py-2 prose-td:border-white/10
                      prose-blockquote:border-l-blue-500/40 prose-blockquote:bg-blue-500/5 prose-blockquote:py-1 prose-blockquote:not-italic">
        <Markdown components={markdownComponents}>{answer.clinical_content}</Markdown>
      </div>

      {answer.bottom_line && <BottomLine text={answer.bottom_line} />}

      {answer.fda_label_sections.length > 0 && (
        <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px]">
          <summary className="cursor-pointer text-slate-300 font-medium hover:text-white transition-colors">
            FDA Label Sections ({answer.fda_label_sections.length})
          </summary>
          <div className="mt-2 space-y-2">
            {answer.fda_label_sections.map(s => (
              <div key={s.loinc_code} className="border-t border-white/5 pt-2">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{s.section_name} · LOINC {s.loinc_code}</div>
                <div className="text-slate-300 leading-snug">{s.content_summary}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      <EvidenceTable evidence={answer.evidence} />

      <p className="text-[10px] text-slate-500 border-t border-white/10 pt-3 leading-snug italic">
        {answer.disclaimer}
      </p>
    </article>
  );
}

// ─── Main exported component ─────────────────────────────────────

interface Turn {
  role: 'user' | 'assistant';
  text?: string;
  answer?: PharmOracleAnswer;
}

export function PharmOracleSearch() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;
    setError(null);
    setTurns(prev => [...prev, { role: 'user', text: query }]);
    setInput('');
    setLoading(true);

    try {
      // Pull the Gemini key from the same env vars Infusion Copilot uses
      const apiKey =
        process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
        (process.env as any).GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is missing. Set NEXT_PUBLIC_GEMINI_API_KEY in your environment.');
      }
      const answer = await runPipeline(query, apiKey);
      setTurns(prev => [...prev, { role: 'assistant', answer }]);
    } catch (err: any) {
      console.error('PharmOracle pipeline error:', err);
      setError(err?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
      <div className="flex items-start gap-4 bg-purple-500/10 p-4 rounded-xl border border-purple-500/20">
        <Sparkles className="text-purple-400 shrink-0 mt-1" size={16} strokeWidth={1.5} />
        <div>
          <h2 className="text-[16px] font-medium text-purple-400">PharmOracle Clinical Engine</h2>
          <p className="text-[14px] text-purple-200/80 mt-1">
            Pharmacy-specialized decision support: query is classified by domain (IV drug info, USP 797, drug interaction, TDM, etc.), then fans out in parallel to <strong>DailyMed</strong> (FDA labels), <strong>PubMed</strong> (ranked evidence), and <strong>openFDA shortages</strong>. Safety flags from local <strong>NIOSH / ISMP / vesicant</strong> registries surface before the synthesized answer.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {turns.length === 0 && !loading && (
          <div className="glass-panel p-6 text-[14px] text-slate-400 leading-relaxed">
            <p className="mb-3 text-slate-300 font-medium">Try a pharmacy question:</p>
            <ul className="space-y-1.5 text-[13px] list-disc list-inside marker:text-slate-600">
              <li>BUD for vancomycin 5g/100mL ISO 5 cleanroom refrigerated?</li>
              <li>Can I run vancomycin and pip-tazo Y-site?</li>
              <li>Latest evidence for IV iron vs oral iron in IBD anemia</li>
              <li>How do I dose meropenem for CrCl 25 mL/min?</li>
              <li>Is amiodarone in shortage right now?</li>
            </ul>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="self-end max-w-[85%] rounded-2xl bg-purple-500/15 border border-purple-500/25 text-purple-100 px-4 py-2.5 text-[14px]">
              {t.text}
            </div>
          ) : (
            t.answer && <AnswerCard key={i} answer={t.answer} />
          )
        )}

        {loading && (
          <div className="glass-panel p-4 text-[13px] text-purple-300 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Running pipeline — classifying query, fanning out to DailyMed / PubMed / openFDA…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] p-3 text-[13px] text-red-200">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 sticky bottom-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a pharmacy question…"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 text-white px-5 rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Ask
        </button>
      </form>
    </div>
  );
}
