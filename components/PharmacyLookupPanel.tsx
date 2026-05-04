'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, ShieldAlert, Pill, Database, ChevronDown, ChevronUp,
  Activity, FileText, Loader2, ExternalLink, Beaker, Package,
} from 'lucide-react';
import type { LookupResult, SafetyFlag, DrugLookup } from '@/lib/pharmacy-lookup/types';

const LEVEL_STYLES: Record<SafetyFlag['level'], { bg: string; border: string; text: string; icon: string }> = {
  critical: {
    bg: 'bg-red-500/10', border: 'border-red-500/30',
    text: 'text-red-300', icon: 'text-red-400',
  },
  warning: {
    bg: 'bg-amber-500/10', border: 'border-amber-500/30',
    text: 'text-amber-300', icon: 'text-amber-400',
  },
  info: {
    bg: 'bg-blue-500/10', border: 'border-blue-500/30',
    text: 'text-blue-300', icon: 'text-blue-400',
  },
};

const CATEGORY_LABEL: Record<SafetyFlag['category'], string> = {
  vesicant: 'Vesicant',
  high_alert: 'ISMP High-Alert',
  hazardous_drug: 'NIOSH Hazardous',
  interaction: 'Interaction',
  shortage: 'Shortage',
  usp797: 'USP 797',
  monitoring: 'Monitoring',
  recall: 'Recall',
};

const SHORTAGE_STYLES: Record<string, string> = {
  'Currently in Shortage': 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  'Discontinued': 'bg-red-500/15 border-red-500/30 text-red-300',
  'Resolved Shortage': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  'Not Found': 'bg-white/5 border-white/10 text-slate-400',
};

function SafetyFlagCard({ flag }: { flag: SafetyFlag }) {
  const styles = LEVEL_STYLES[flag.level];
  return (
    <div className={`rounded-xl border ${styles.bg} ${styles.border} p-3 flex gap-3`}>
      {flag.level === 'critical' ? (
        <ShieldAlert size={16} className={`${styles.icon} shrink-0 mt-0.5`} strokeWidth={1.75} />
      ) : (
        <AlertTriangle size={16} className={`${styles.icon} shrink-0 mt-0.5`} strokeWidth={1.75} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${styles.text}`}>
            {flag.level}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">·</span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            {CATEGORY_LABEL[flag.category]}
          </span>
          {flag.drug && (
            <>
              <span className="text-[10px] text-slate-500 font-medium">·</span>
              <span className="text-[11px] text-white font-medium">{flag.drug}</span>
            </>
          )}
        </div>
        <p className={`text-[12px] leading-relaxed ${styles.text}`}>{flag.message}</p>
      </div>
    </div>
  );
}

function DrugLookupCard({ drug }: { drug: DrugLookup }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const niceName = drug.generic_name.charAt(0).toUpperCase() + drug.generic_name.slice(1);

  const toggle = (field: string) =>
    setExpanded(prev => ({ ...prev, [field]: !prev[field] }));

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3 bg-white/[0.02]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20 shrink-0">
            <Pill size={13} className="text-blue-400" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-white truncate">{niceName}</div>
            <div className="text-[10px] text-slate-500 truncate">
              {drug.manufacturer || 'openFDA label lookup'}
              {drug.rxcui && <span> · RxCUI {drug.rxcui}</span>}
            </div>
          </div>
        </div>
        {drug.shortage && drug.shortage.status !== 'Not Found' && (
          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${SHORTAGE_STYLES[drug.shortage.status]}`}>
            {drug.shortage.status}
          </span>
        )}
      </div>

      {drug.not_found ? (
        <div className="p-4 text-[12px] text-slate-500 italic">
          openFDA returned no IV/parenteral label match for this drug. The brief below uses the AI's grounded search results.
        </div>
      ) : drug.label_sections.length === 0 ? (
        <div className="p-4 text-[12px] text-slate-500 italic">
          Lookup completed; no extractable label sections returned.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {drug.label_sections.map(section => {
            const isOpen = expanded[section.field] ?? false;
            const isWarning = section.field === 'boxed_warning';
            return (
              <div key={section.field}>
                <button
                  onClick={() => toggle(section.field)}
                  className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isWarning ? (
                      <AlertTriangle size={11} className="text-red-400 shrink-0" strokeWidth={2} />
                    ) : (
                      <FileText size={11} className="text-slate-500 shrink-0" strokeWidth={1.75} />
                    )}
                    <span className={`text-[12px] font-medium truncate ${isWarning ? 'text-red-300' : 'text-slate-300'}`}>
                      {section.label}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={12} className="text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown size={12} className="text-slate-500 shrink-0" />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 pt-1 text-[12px] text-slate-400 leading-relaxed whitespace-pre-wrap">
                        {section.content}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PharmacyLookupPanel({
  lookup,
  isLoading,
}: {
  lookup: LookupResult | null;
  isLoading: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (!lookup && !isLoading) return null;

  const hasContent =
    lookup &&
    (lookup.drug_lookups.length > 0 || lookup.safety_flags.length > 0);

  return (
    <div className="flex flex-col glass-panel overflow-hidden shadow-sm">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between hover:bg-white/[0.07] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-violet-500/10 p-1.5 rounded-lg border border-violet-500/20">
            <Database size={14} className="text-violet-400" strokeWidth={1.75} />
          </div>
          <div className="text-left">
            <h3 className="text-[14px] font-semibold text-white">Pharmacy Lookup</h3>
            <p className="text-[11px] text-slate-500">
              {isLoading
                ? 'Querying openFDA, NIOSH, ISMP…'
                : lookup
                ? `${lookup.drug_lookups.length} drug${lookup.drug_lookups.length === 1 ? '' : 's'} · ${lookup.safety_flags.length} safety flag${lookup.safety_flags.length === 1 ? '' : 's'} · sources: ${lookup.data_sources_used.join(', ') || 'none'}`
                : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 size={14} className="animate-spin text-violet-400" />}
          {!isLoading && lookup && (
            collapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 bg-[#0a0a0a]">
              {isLoading && !lookup && (
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <Loader2 size={14} className="animate-spin text-violet-400" />
                  Extracting drugs and querying authoritative sources…
                </div>
              )}

              {lookup && (
                <>
                  {/* Domain badge + urgency */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium">
                      <Activity size={10} className="inline mr-1 -mt-0.5" />
                      {lookup.classification.query_domain.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded-md border font-medium ${
                      lookup.classification.urgency === 'critical'
                        ? 'bg-red-500/10 border-red-500/20 text-red-300'
                        : lookup.classification.urgency === 'urgent'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}>
                      {lookup.classification.urgency}
                    </span>
                    {lookup.classification.drug_names.length === 0 && (
                      <span className="text-slate-500 italic">No drugs extracted from scenario.</span>
                    )}
                  </div>

                  {/* Safety flags */}
                  {lookup.safety_flags.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        <ShieldAlert size={11} />
                        Safety Flags ({lookup.safety_flags.length})
                      </div>
                      {lookup.safety_flags.map((flag, idx) => (
                        <SafetyFlagCard key={idx} flag={flag} />
                      ))}
                    </div>
                  )}

                  {/* Drug lookups (label sections + shortage) */}
                  {lookup.drug_lookups.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        <Beaker size={11} />
                        FDA Label Lookups ({lookup.drug_lookups.length})
                      </div>
                      {lookup.drug_lookups.map(drug => (
                        <DrugLookupCard key={drug.generic_name} drug={drug} />
                      ))}
                    </div>
                  )}

                  {!hasContent && !isLoading && (
                    <div className="text-[12px] text-slate-500 italic py-2">
                      No drugs were extracted from the scenario. The consult brief below relies on the AI&apos;s general grounding.
                    </div>
                  )}

                  {/* Citation footer */}
                  <div className="pt-3 border-t border-white/5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <Package size={11} className="text-slate-500" />
                    <span>Sources:</span>
                    <a
                      href="https://api.fda.gov/drug/label.json"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5"
                    >
                      openFDA labels <ExternalLink size={9} />
                    </a>
                    <span>·</span>
                    <a
                      href="https://www.ashp.org/drug-shortages"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5"
                    >
                      ASHP shortages <ExternalLink size={9} />
                    </a>
                    <span>·</span>
                    <a
                      href="https://www.cdc.gov/niosh/docs/2025-103/default.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5"
                    >
                      NIOSH HD list <ExternalLink size={9} />
                    </a>
                    <span>·</span>
                    <a
                      href="https://www.ismp.org/recommendations/high-alert-medications-acute-list"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5"
                    >
                      ISMP high-alert <ExternalLink size={9} />
                    </a>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
