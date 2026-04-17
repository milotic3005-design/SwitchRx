'use client';

import { useState, useMemo } from 'react';
import {
  Search, X, AlertTriangle, ShieldAlert, ExternalLink,
  ChevronDown, ChevronRight, Pill, Droplet, Thermometer, FlaskConical
} from 'lucide-react';
import { DRUG_DB } from '@/data/drug-database';
import type { Drug } from '@/lib/iv-reference-types';

/* ── Badge ────────────────────────────────────────────────────── */
function IVBadge({ type, children }: { type: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    vesicant:  'bg-red-500/10 text-red-300 border-red-500/20',
    highAlert: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    cat1:      'bg-blue-500/10 text-blue-300 border-blue-500/20',
    cat2:      'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    niosh:     'bg-purple-500/10 text-purple-300 border-purple-500/20',
    default:   'bg-white/5 text-slate-300 border-white/10',
  };
  return (
    <span className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border ${styles[type] || styles.default} flex items-center gap-1 w-fit leading-none`}>
      {children}
    </span>
  );
}

/* ── Collapsible section ──────────────────────────────────────── */
function Section({ title, icon, defaultOpen = true, children, accent }: {
  title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border ${accent || 'border-white/10 bg-white/[0.02]'} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-base">{icon}</span>
        <span className="text-sm font-bold text-white flex-1">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  );
}

/* ── Bullet ───────────────────────────────────────────────────── */
function Bullet({ label, value, warn }: { label: string; value?: string; warn?: boolean }) {
  if (!value || value === 'N/A' || value === 'None') return null;
  return (
    <li className="flex items-start gap-2 text-sm leading-relaxed">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${warn ? 'bg-amber-400' : 'bg-slate-500'}`} />
      <span>
        <span className="font-semibold text-slate-300">{label}:</span>{' '}
        <span className={warn ? 'text-amber-300 font-medium' : 'text-slate-400'}>{value}</span>
      </span>
    </li>
  );
}

/* ── Highlight text matching query ────────────────────────────── */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-300/20 text-yellow-200 rounded px-0.5">{part}</mark>
      : part
  );
}

/* ── Drug detail modal ────────────────────────────────────────── */
function DrugDetailModal({ drug, onClose }: { drug: Drug; onClose: () => void }) {
  const [modalSearch, setModalSearch] = useState('');
  const q = modalSearch.toLowerCase();

  const matches = (text?: string) => !q || (text || '').toLowerCase().includes(q);
  const hl = (text?: string) => (text ? highlightText(text, modalSearch) : 'N/A');

  const showPrep = useMemo(() => !q || [
    drug.vialSizes?.join(', '), drug.storageIntact,
    drug.reconstitution?.diluent, drug.reconstitution?.volume, drug.reconstitution?.concentration,
    drug.dilution?.preferredDiluent, drug.dilution?.volumeRange, drug.dilution?.finalConcentrationRange,
  ].some(v => matches(v)), [q, drug]);

  const showInfusion = useMemo(() => !q || [
    drug.infusion?.rate, drug.infusion?.duration, drug.infusion?.filterRequired,
    drug.infusion?.lightProtection, drug.infusion?.pvtFreeLinRequired,
  ].some(v => matches(v)), [q, drug]);

  const showBUD = useMemo(() => !q || [
    drug.bud?.roomTemp, drug.bud?.refrigerated, drug.bud?.frozen,
    drug.bud?.usp797Category, drug.bud?.basisNote,
  ].some(v => matches(v)), [q, drug]);

  const showClinical = useMemo(() => !q || [
    drug.summary?.pearls, drug.summary?.dosing, drug.summary?.monitoring,
    drug.emetogenic?.risk, drug.emetogenic?.premeds,
    drug.toxicities?.limits, drug.toxicities?.adjustments,
    drug.sequencing?.order, drug.sequencing?.ySite,
  ].some(v => matches(v)), [q, drug]);

  const showSafety = useMemo(() => !q || [
    drug.hazardous?.niosh, drug.hazardous?.cstd, drug.hazardous?.disposal,
    drug.extravasation?.risk, drug.extravasation?.compress,
    drug.extravasation?.antidote, drug.extravasation?.management,
  ].some(v => matches(v)), [q, drug]);

  const hasFilter = drug.infusion?.filterRequired && drug.infusion.filterRequired !== 'No' && drug.infusion.filterRequired !== 'N/A';
  const hasLight = drug.infusion?.lightProtection && drug.infusion.lightProtection !== 'No' && drug.infusion.lightProtection !== 'N/A';
  const hasPVC = drug.infusion?.pvtFreeLinRequired && drug.infusion.pvtFreeLinRequired !== 'No' && drug.infusion.pvtFreeLinRequired !== 'N/A';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#0f0f10] rounded-[24px] w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white/[0.03] px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-white tracking-tight truncate">{drug.genericName}</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {drug.brandName} <span className="text-slate-600 px-1">·</span> {drug.drugClass}
              </p>
            </div>
            <button
              onClick={onClose}
              className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white p-2 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Alert badges */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {drug.vesicant && <IVBadge type="vesicant"><AlertTriangle className="w-3 h-3" /> Vesicant</IVBadge>}
            {drug.highAlert && <IVBadge type="highAlert"><ShieldAlert className="w-3 h-3" /> High-Alert</IVBadge>}
            {drug.hazardous?.niosh?.includes('Group 1') && <IVBadge type="niosh">NIOSH G1</IVBadge>}
            <IVBadge type={drug.bud?.usp797Category === 'Category 1' ? 'cat1' : 'cat2'}>
              {drug.bud?.usp797Category || 'N/A'}
            </IVBadge>
          </div>

          {/* In-modal search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search within this drug..."
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {showPrep && (
            <Section title="Preparation" icon="💉">
              <ul className="space-y-1.5">
                <Bullet label="Vials" value={drug.vialSizes?.join(', ')} />
                <Bullet label="Storage (intact)" value={drug.storageIntact} />
                <Bullet label="Reconstitute with" value={drug.reconstitution?.diluent} />
                <Bullet label="Recon volume" value={drug.reconstitution?.volume} />
                <Bullet label="Recon conc" value={drug.reconstitution?.concentration} />
                <Bullet label="Diluent" value={drug.dilution?.preferredDiluent} />
                <Bullet label="Volume range" value={drug.dilution?.volumeRange} />
                <Bullet label="Final conc range" value={drug.dilution?.finalConcentrationRange} />
              </ul>
            </Section>
          )}

          {showInfusion && (
            <Section title="Infusion" icon="⏱️">
              <ul className="space-y-1.5">
                <Bullet label="Rate" value={drug.infusion?.rate} />
                <Bullet label="Duration" value={drug.infusion?.duration} />
                <Bullet label="In-line filter" value={drug.infusion?.filterRequired} warn={!!hasFilter} />
                <Bullet label="Light protection" value={drug.infusion?.lightProtection} warn={!!hasLight} />
                <Bullet label="PVC/DEHP-free" value={drug.infusion?.pvtFreeLinRequired} warn={!!hasPVC} />
              </ul>
            </Section>
          )}

          {showBUD && (
            <Section title="Beyond-Use Dating" icon="🌡️">
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: 'Room Temp', val: drug.bud?.roomTemp },
                  { label: 'Refrigerated', val: drug.bud?.refrigerated },
                  { label: 'Frozen', val: drug.bud?.frozen },
                ].map(b => (
                  <div key={b.label} className="bg-white/5 border border-white/5 rounded-xl p-2.5 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">{b.label}</p>
                    <p className="text-sm font-bold text-white mt-0.5">{b.val || 'N/A'}</p>
                  </div>
                ))}
              </div>
              {drug.bud?.basisNote && drug.bud.basisNote !== 'N/A' && (
                <p className="text-xs text-slate-400 flex items-start gap-1.5 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  {hl(drug.bud.basisNote)}
                </p>
              )}
            </Section>
          )}

          {showClinical && (
            <Section title="Clinical Notes" icon="📋">
              <ul className="space-y-1.5">
                <Bullet label="Pearls" value={drug.summary?.pearls} />
                <Bullet label="Dosing" value={drug.summary?.dosing} />
                <Bullet label="Monitoring" value={drug.summary?.monitoring} />
                <Bullet label="Emetogenic risk" value={drug.emetogenic?.risk} warn={drug.emetogenic?.risk?.includes('High')} />
                <Bullet label="Pre-meds" value={drug.emetogenic?.premeds} />
                <Bullet label="Dose limits" value={drug.toxicities?.limits} warn />
                <Bullet label="Organ adjustments" value={drug.toxicities?.adjustments} />
                <Bullet label="Sequencing" value={drug.sequencing?.order} />
                <Bullet label="Y-site warnings" value={drug.sequencing?.ySite} warn />
              </ul>
            </Section>
          )}

          {showSafety && (
            <Section
              title="Safety & Handling"
              icon="🛡️"
              accent={drug.vesicant ? 'border-red-500/20 bg-red-500/[0.04]' : undefined}
            >
              <ul className="space-y-1.5">
                <Bullet label="NIOSH" value={drug.hazardous?.niosh} warn={drug.hazardous?.niosh?.includes('Group 1')} />
                <Bullet label="CSTD" value={drug.hazardous?.cstd} warn={drug.hazardous?.cstd?.includes('Required')} />
                <Bullet label="Waste" value={drug.hazardous?.disposal} />
                <Bullet label="Extravasation risk" value={drug.extravasation?.risk} warn={drug.extravasation?.risk?.includes('Vesicant')} />
                <Bullet label="Compress" value={drug.extravasation?.compress} warn={drug.extravasation?.compress?.includes('WARM')} />
                <Bullet
                  label="Antidote"
                  value={drug.extravasation?.antidote}
                  warn={drug.extravasation?.antidote !== 'None required' && drug.extravasation?.antidote !== 'None' && drug.extravasation?.antidote !== 'N/A'}
                />
              </ul>
              {drug.extravasation?.management && drug.extravasation.management !== 'N/A' && (
                <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-300 mb-1">⚠️ Extravasation Protocol</p>
                  <p className="text-xs text-red-200/80 leading-relaxed">{hl(drug.extravasation.management)}</p>
                </div>
              )}
            </Section>
          )}

          {modalSearch && !showPrep && !showInfusion && !showBUD && !showClinical && !showSafety && (
            <div className="text-center py-8 text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm">No matching content for &ldquo;{modalSearch}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white/[0.03] px-5 py-3 border-t border-white/10 flex justify-between items-center flex-shrink-0">
          <a
            href={drug.sourceUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium text-xs transition-colors"
          >
            DailyMed <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white text-black rounded-full text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Drug card ────────────────────────────────────────────────── */
function DrugCard({ drug, onClick }: { drug: Drug; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-blue-500/30 rounded-2xl p-5 transition-all group"
    >
      <div className="flex justify-between items-start gap-2 mb-1">
        <h3 className="text-lg font-bold text-white tracking-tight leading-tight group-hover:text-blue-300 transition-colors">
          {drug.genericName}
        </h3>
        <IVBadge type={drug.bud?.usp797Category === 'Category 1' ? 'cat1' : 'cat2'}>
          {drug.bud?.usp797Category === 'Category 1'
            ? 'Cat 1'
            : drug.bud?.usp797Category === 'N/A'
            ? 'N/A'
            : 'Cat 2'}
        </IVBadge>
      </div>
      <p className="text-xs font-medium text-slate-400 mb-4">
        {drug.brandName} <span className="text-slate-600 px-1">·</span> {drug.category}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {drug.vesicant && <IVBadge type="vesicant"><AlertTriangle className="w-3 h-3" /> Vesicant</IVBadge>}
        {drug.highAlert && <IVBadge type="highAlert"><ShieldAlert className="w-3 h-3" /> High-Alert</IVBadge>}
        {drug.hazardous?.niosh?.includes('Group 1') && <IVBadge type="niosh">NIOSH G1</IVBadge>}
      </div>

      <div className="space-y-2">
        <div className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
          <Droplet className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-slate-300 font-medium truncate">
            {drug.dilution?.preferredDiluent || 'N/A'}
          </span>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
          <Thermometer className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-slate-300 font-medium truncate">
            BUD: {drug.bud?.roomTemp || 'N/A'} (RT)
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── Main Drug Reference component ────────────────────────────── */
export function DrugReference() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [selected, setSelected] = useState<Drug | null>(null);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set(DRUG_DB.map(d => d.category));
    return ['All', ...Array.from(set).sort()];
  }, []);

  // Filter drugs
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DRUG_DB.filter(d => {
      if (category !== 'All' && d.category !== category) return false;
      if (!q) return true;
      return (
        d.genericName.toLowerCase().includes(q) ||
        d.brandName.toLowerCase().includes(q) ||
        d.drugClass.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    }).sort((a, b) => a.genericName.localeCompare(b.genericName));
  }, [query, category]);

  return (
    <div className="pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20">
            <FlaskConical className="text-blue-400" size={20} strokeWidth={2} />
          </div>
          Drug Reference
        </h1>
        <p className="text-[15px] text-slate-400 mt-2">
          IV compounding, infusion parameters, BUDs, and safety data for {DRUG_DB.length} medications.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by generic name, brand name, or drug class..."
          className="w-full pl-11 pr-11 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 backdrop-blur-sm"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${
              category === cat
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {cat}
            {cat !== 'All' && (
              <span className="ml-1.5 text-slate-500 text-[10px]">
                {DRUG_DB.filter(d => d.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <span className="text-slate-300 font-semibold">{filtered.length}</span> of {DRUG_DB.length} drugs
        </span>
        {(query || category !== 'All') && (
          <button
            onClick={() => { setQuery(''); setCategory('All'); }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Drug grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(drug => (
            <DrugCard key={drug.id} drug={drug} onClick={() => setSelected(drug)} />
          ))}
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-12 text-center">
          <Pill className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 text-sm font-medium">No drugs match your search.</p>
          <p className="text-slate-500 text-xs mt-1">Try a different name or clear the filters.</p>
        </div>
      )}

      {/* Modal */}
      {selected && <DrugDetailModal drug={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
