'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Mixing Guide — type a drug, get an at-a-glance prep card:
//   MIX        → vial → reconstitute → dilute → final, with technique tips
//   ADMINISTER → rate, duration, filter, light, tubing, premeds, titration
//   STORE      → intact-vial storage + assigned BUD (stability vs USP <797>)
//
// Everything renders from curated data — DRUG_DB, the PI technique notes in
// data/mixing-notes.ts, the PI titration ladders from the Biologic Rate
// Titration calculator, and the ASHP / McKesson container stability tables.
// Nothing here is AI-generated; unknown drugs route to Infusion Copilot.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Beaker, Search, X, TestTube, Syringe, FlaskConical, Droplets, CircleCheck, ArrowRight,
  Timer, Gauge, Filter, Sun, Cable, ShieldAlert, AlertTriangle, Biohazard, Snowflake,
  Thermometer, ThermometerSun, Hourglass, Package, Ban, RotateCw, Eye, Pill, ExternalLink,
  BookOpen, Network, TrendingUp, Layers, CheckCircle2, Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DRUG_DB } from '@/data/drug-database';
import type { Drug } from '@/lib/iv-reference-types';
import { getMixingNotes, type MixingNotes } from '@/data/mixing-notes';
import {
  getBudStability, getElastomericStability, getOpatStabilityRows,
  parseDurationToHours, USP797_LIMIT_HOURS,
} from '@/data/bud-stability';
import { PRESETS, type Preset } from '@/components/InfusionRateCalculator';
import { emitOpenDrug, emitAskCopilot } from '@/lib/cross-tab-events';

// ── Palette (remapped classes — render correctly in dark + light themes) ──────
type Tone = 'violet' | 'teal' | 'gold' | 'amber' | 'rose' | 'slate';
const TONE: Record<Tone, { box: string; icon: string }> = {
  violet: { box: 'bg-violet-500/10 border-violet-500/30', icon: 'text-violet-300' },
  teal:   { box: 'bg-emerald-500/10 border-emerald-500/30', icon: 'text-emerald-300' },
  gold:   { box: 'bg-blue-500/10 border-blue-500/30', icon: 'text-blue-300' },
  amber:  { box: 'bg-amber-500/10 border-amber-500/30', icon: 'text-amber-400' },
  rose:   { box: 'bg-rose-500/10 border-rose-500/30', icon: 'text-rose-400' },
  slate:  { box: 'bg-white/5 border-white/10', icon: 'text-slate-400' },
};

const QUICK_PICKS = [
  'Infliximab', 'Vedolizumab', 'Ocrelizumab', 'Rituximab', 'Natalizumab',
  'Tocilizumab', 'Immune Globulin IV', 'Vancomycin', 'Iron Sucrose', 'Ceftriaxone',
];

// ── Field helpers ────────────────────────────────────────────────────────────
// DB fields use "N/A", "Various", "Varies" as placeholders — treat as empty.
function val(v?: string): string | null {
  const t = (v || '').trim();
  if (!t || /^(n\/a|na|none|—|-|various|varies)$/i.test(t) || /^n\/a\b/i.test(t)) return null;
  return t;
}
// "N/A (Liquid)" → "Liquid"; "N/A (Administer undiluted)" → "Administer undiluted"
function naHint(v?: string): string | null {
  return /^n\/a\s*\(([^)]+)\)/i.exec((v || '').trim())?.[1] ?? null;
}
const yes = (v?: string) => /^yes/i.test((v || '').trim());
const poreOf = (v?: string) => /\(([\d.]+)\)/.exec(v || '')?.[1] ?? null;
const diluentLabel = (d: string) => (/^provided$/i.test(d) ? 'supplied diluent' : d);

type Route = 'iv' | 'oral' | 'subq';
function routeOf(d: Drug): Route {
  const r = (d.infusion?.rate || '').toLowerCase();
  if (r === 'oral') return 'oral';
  if (r.includes('subcut')) return 'subq';
  return 'iv';
}

const isProtein = (d: Drug) =>
  d.category === 'Biologic' &&
  /antibody|conjugate|bispecific|blood product|globulin|proteinase|enzyme|fusion/i.test(d.drugClass);
const isHazardous = (d: Drug) => /group 1/i.test(d.hazardous?.niosh || '');

// PI titration ladders, matched on the preset label's leading generic name
// ("Rituximab — 1st infusion" ↔ Rituximab; not "Ado-trastuzumab" ↔ Trastuzumab).
function titrationFor(generic: string): Preset[] {
  const g = generic.toLowerCase();
  return PRESETS.filter(p => {
    const l = p.label.toLowerCase();
    return l.startsWith(g) && (l.length === g.length || /[\s—(]/.test(l[g.length]));
  });
}

// ── Reconstitution volume ↔ vial attribution ─────────────────────────────────
// DRUG_DB stores ONE reconstitution volume even for multi-vial products, and it
// only fits one of them (vancomycin 10 mL suits the 500 mg vial; 1 g needs
// 20 mL). volume × target concentration ≈ vial strength identifies that vial
// (0.75–1.25 tolerates powder displacement and overfill). If no vial matches,
// the volume is not shown as if it applied to every vial size.
function amountOf(s: string): { v: number; u: 'mg' | 'units' } | null {
  const m = /([\d.,]+)\s*(mcg|mg|g|mu|units|u)\b/i.exec(s);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  const u = m[2].toLowerCase();
  if (u === 'g') return { v: v * 1000, u: 'mg' };
  if (u === 'mcg') return { v: v / 1000, u: 'mg' };
  if (u === 'mg') return { v, u: 'mg' };
  if (u === 'mu') return { v: v * 1e6, u: 'units' };
  return { v, u: 'units' };
}
function concOf(s: string): { v: number; u: 'mg' | 'units' } | null {
  const m = /^~?\s*([\d.,]+)\s*(mcg|mg|g|units|u)\s*\/\s*ml\b/i.exec(s.trim());
  return m ? amountOf(`${m[1]} ${m[2]}`) : null;
}
interface ReconPlan { volume: string | null; perVial: string | null; unverified: boolean }
function reconPlan(d: Drug): ReconPlan {
  const volume = val(d.reconstitution.volume);
  const strict = volume && /^([\d.]+)\s*ml$/i.exec(volume);
  if (!strict || d.vialSizes.length <= 1) return { volume, perVial: null, unverified: false };
  const conc = concOf(d.reconstitution.concentration || '');
  if (conc) {
    const yielded = parseFloat(strict[1]) * conc.v;
    let best: { vial: string; off: number } | null = null;
    for (const vial of d.vialSizes) {
      const a = amountOf(vial);
      if (!a || a.u !== conc.u) continue;
      const ratio = yielded / a.v;
      if (ratio < 0.75 || ratio > 1.25) continue;
      const off = Math.abs(1 - ratio);
      if (!best || off < best.off) best = { vial, off };
    }
    if (best) return { volume, perVial: best.vial, unverified: false };
  }
  return { volume, perVial: null, unverified: true };
}

// ── Search ───────────────────────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Common abbreviations clinicians type that match neither generic nor brand.
const SEARCH_ALIASES: Record<string, string> = {
  ivig: 'Immune Globulin IV', igiv: 'Immune Globulin IV',
  '5fu': 'Fluorouracil', mtx: 'Methotrexate', piptazo: 'Piperacillin/Tazobactam',
  tpa: 'Alteplase', pcc: '4-Factor PCC', '4fpcc': '4-Factor PCC', tmpsmx: 'Trimethoprim-Sulfamethoxazole',
};
function searchDrugs(q: string, limit = 8): Drug[] {
  const n = norm(q);
  if (!n) return [];
  const aliased = new Set(Object.entries(SEARCH_ALIASES).filter(([a]) => a.startsWith(n)).map(([, g]) => g));
  const hits: { d: Drug; s: number }[] = [];
  for (const d of DRUG_DB) {
    const g = norm(d.genericName);
    const brands = d.brandName.split(/[\/,]/).map(norm).filter(Boolean);
    let s = -1;
    if (g === n || brands.includes(n) || aliased.has(d.genericName)) s = 0;
    else if (g.startsWith(n)) s = 1;
    else if (brands.some(b => b.startsWith(n))) s = 2;
    else if (g.includes(n)) s = 3;
    else if (brands.some(b => b.includes(n))) s = 4;
    if (s >= 0) hits.push({ d, s });
  }
  hits.sort((a, b) => a.s - b.s || a.d.genericName.localeCompare(b.d.genericName));
  return hits.slice(0, limit).map(h => h.d);
}

// ── BUD: assigned value = lesser of chemical stability and USP <797> ─────────
function limitsFor(cat?: string) {
  if (/category\s*1/i.test(cat || '')) return USP797_LIMIT_HOURS.cat1;
  if (/category\s*2/i.test(cat || '')) return USP797_LIMIT_HOURS.cat2;
  return null;
}
function prettyBud(raw?: string): string {
  const t = (raw || '').trim();
  if (!t || /^n\/a$/i.test(t)) return '—';
  if (/^do\s*not\s*ref/i.test(t)) return 'Do not refrigerate';
  if (/^not rec/i.test(t)) return 'Not recommended';
  if (/^until exp/i.test(t)) return 'Until expiration';
  if (/^do not freeze/i.test(t)) return 'Do not freeze';
  return t;
}
// Prepared-dose convention: hours up to 48 h, then days (months when exact).
function fmtHours(h: number): string {
  const trim = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h <= 48) return `${trim(h)} h`;
  if (h >= 24 * 60 && h % (24 * 30) === 0) return `${h / (24 * 30)} mo`;
  return `${trim(h / 24)} days`;
}
interface BudCell { big: string; sub: string | null; uspCapped: boolean }
function budCell(raw: string | undefined, limit: number | null, cat1Frozen = false): BudCell {
  const hours = parseDurationToHours(raw);
  if (hours === null) return { big: prettyBud(raw), sub: null, uspCapped: false };
  if (!isFinite(hours)) return { big: 'Until expiration', sub: null, uspCapped: false };
  if (cat1Frozen) return { big: '—', sub: 'Cat 1 CSPs are not assigned a frozen BUD', uspCapped: false };
  const uspCapped = limit !== null && hours > limit;
  const qualifier = /\(([^)]+)\)/.exec(raw || '')?.[1];
  const basis = uspCapped ? `USP <797> limit · stability ${raw}` : limit !== null ? 'Chemical stability' : null;
  const sub = [basis, !uspCapped && qualifier ? qualifier : null].filter(Boolean).join(' · ') || null;
  return { big: fmtHours(uspCapped ? limit : hours), sub, uspCapped };
}

// ── Tip iconography: pick an icon from the instruction's verb ────────────────
function tipIcon(t: string): { Icon: LucideIcon; warn: boolean } {
  const s = t.toLowerCase();
  if (/(not|never)\s+(vigorously\s+)?shake|do not shake/.test(s)) return { Icon: Ban, warn: true };
  if (/rems|boxed warning|never |do not |don't|discard/.test(s)) return { Icon: AlertTriangle, warn: true };
  if (/swirl|invert|rotat/.test(s)) return { Icon: RotateCw, warn: false };
  if (/filter/.test(s)) return { Icon: Filter, warn: false };
  if (/light/.test(s)) return { Icon: Sun, warn: false };
  if (/needle|withdraw|inject|vial \+/.test(s)) return { Icon: Syringe, warn: false };
  if (/stand|minute|hour|warm|room temperature/.test(s)) return { Icon: Hourglass, warn: false };
  if (/flush|line|set\b/.test(s)) return { Icon: Cable, warn: false };
  return { Icon: CheckCircle2, warn: false };
}

// ═════════════════════════════════════════════════════════════════════════════
// Presentational building blocks
// ═════════════════════════════════════════════════════════════════════════════

function IconBox({ Icon, tone, size = 'md' }: { Icon: LucideIcon; tone: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-11 h-11 rounded-xl' : size === 'sm' ? 'w-7 h-7 rounded-lg' : 'w-9 h-9 rounded-xl';
  const icon = size === 'lg' ? 20 : size === 'sm' ? 14 : 17;
  return (
    <div className={`${dims} ${TONE[tone].box} border flex items-center justify-center shrink-0`}>
      <Icon size={icon} className={TONE[tone].icon} strokeWidth={2} />
    </div>
  );
}

function Badge({ Icon, tone, children }: { Icon: LucideIcon; tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-semibold ${TONE[tone].box}`}>
      <Icon size={12.5} className={TONE[tone].icon} strokeWidth={2.25} />
      <span className="text-slate-200">{children}</span>
    </span>
  );
}

function SectionCard({ Icon, tone, title, subtitle, children, className = '' }: {
  Icon: LucideIcon; tone: Tone; title: string; subtitle: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={`glass-panel p-5 md:p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
        <IconBox Icon={Icon} tone={tone} size="lg" />
        <div>
          <h3 className="text-[17px] font-bold text-white tracking-wide uppercase">{title}</h3>
          <p className="text-[12.5px] text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Tips({ items, tone }: { items: string[]; tone: Tone }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2.5 space-y-1.5">
      {items.map((t, i) => {
        const { Icon, warn } = tipIcon(t);
        return (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
            <Icon size={14} strokeWidth={2.25} className={`mt-[3px] shrink-0 ${warn ? 'text-amber-400' : TONE[tone].icon}`} />
            <span>{t}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Step({ n, title, headline, children }: { n: number; title: string; headline: ReactNode; children?: ReactNode }) {
  return (
    <li className="relative pl-11">
      <span className="absolute left-0 top-0 w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/40 flex items-center justify-center text-[13px] font-bold text-violet-300">
        {n}
      </span>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 pt-0.5">{title}</p>
      <div className="text-[15px] font-semibold text-white mt-0.5 leading-snug">{headline}</div>
      {children}
    </li>
  );
}

function DetailRow({ Icon, tone, label, value, emphasis = false }: {
  Icon: LucideIcon; tone: Tone; label: string; value: ReactNode; emphasis?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <IconBox Icon={Icon} tone={tone} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className={`text-[14px] leading-snug mt-0.5 ${emphasis ? 'font-semibold text-white' : 'text-slate-200'}`}>{value}</p>
      </div>
    </div>
  );
}

function Callout({ tone, Icon, title, children }: { tone: Tone; Icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className={`mt-4 rounded-xl border p-3.5 ${TONE[tone].box}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">
        <Icon size={13} className={TONE[tone].icon} strokeWidth={2.25} />
        <span className={TONE[tone].icon}>{title}</span>
      </p>
      <div className="text-[13px] text-slate-300 leading-relaxed mt-1.5">{children}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Drug card
// ═════════════════════════════════════════════════════════════════════════════

function MixingCard({ drug }: { drug: Drug }) {
  const route = routeOf(drug);
  const notes: MixingNotes | null = getMixingNotes(drug.genericName);
  const stab = getBudStability(drug.genericName);
  const elasto = getElastomericStability(drug.genericName);
  const containers = getOpatStabilityRows(drug.genericName);
  const titration = route === 'iv' ? titrationFor(drug.genericName) : [];
  const protein = isProtein(drug);
  const hazardous = isHazardous(drug);

  const r = drug.reconstitution;
  const dl = drug.dilution;
  const inf = drug.infusion;

  const reconDiluent = val(r.diluent);
  const reconApplies = route === 'iv' && !!reconDiluent;
  const plan = reconPlan(drug);
  const concentrate = val(r.concentration);
  const diluent = val(dl.preferredDiluent);
  const diluteApplies = route === 'iv' && !!diluent && !/premix|undiluted|ready/i.test(diluent);
  const bagVolume = val(dl.volumeRange);
  const finalConc = val(dl.finalConcentrationRange);
  const filterReq = yes(inf.filterRequired);
  const pore = poreOf(inf.filterRequired);
  const lightReq = yes(inf.lightProtection);
  const nonPvc = yes(inf.pvtFreeLinRequired);

  // BUD cells
  const limits = limitsFor(drug.bud?.usp797Category);
  const isCat1 = /category\s*1/i.test(drug.bud?.usp797Category || '');
  const room = budCell(drug.bud?.roomTemp, limits?.roomTemp ?? null);
  const fridge = budCell(drug.bud?.refrigerated, limits?.refrigerated ?? null);
  const frozen = budCell(drug.bud?.frozen, limits?.frozen ?? null, isCat1 && parseDurationToHours(drug.bud?.frozen) !== null);
  const catLabel = /category\s*[12]/i.test(drug.bud?.usp797Category || '') ? drug.bud.usp797Category.replace(/category/i, 'Cat') : null;
  const basis = val(drug.bud?.basisNote);
  const basisUseful = basis && !/^usp\s*<797>\.?(\s*limits\.?)?$/i.test(basis) && !/^single use\.?$/i.test(basis);

  // Derived technique tips (used when no curated PI notes cover the step)
  const reconTips = [
    ...(notes?.reconstitute
      ?? (protein ? ['Swirl gently to dissolve — do not shake (agitation foams and denatures protein).'] : [])),
    ...(!notes?.reconstitute && plan.perVial && concentrate
      ? [`Other vial sizes: use the PI volume that yields ${concentrate} (powder displacement varies).`] : []),
    ...(plan.unverified
      ? [`Listed volume ${plan.volume} — confirm the volume for your vial size in the PI.`] : []),
  ];
  const addVolume = plan.unverified ? null : plan.volume;
  const addSuffix = plan.perVial ? ` per ${plan.perVial} vial` : '';
  const diluteTips = notes?.dilute ?? [
    ...(diluent && /only/i.test(diluent) ? [`Use ${diluent.replace(/\s*only/i, '')} only — do not substitute another diluent.`] : []),
    ...(protein ? ['Mix by gentle inversion — do not shake.'] : []),
  ];

  // At-a-glance tiles
  const tiles: { Icon: LucideIcon; tone: Tone; label: string; value: string }[] = route === 'iv'
    ? [
        { Icon: Droplets, tone: 'violet', label: 'Mix in', value: diluent || naHint(dl.preferredDiluent) || 'See PI' },
        { Icon: Beaker, tone: 'violet', label: 'Final conc.', value: finalConc || concentrate || 'Per protocol' },
        { Icon: Timer, tone: 'teal', label: 'Infuse over', value: val(inf.duration) || val(inf.rate) || 'Per protocol' },
        { Icon: Hourglass, tone: 'gold', label: 'Use within', value: `${room.big} room · ${fridge.big} fridge` },
      ]
    : [
        { Icon: route === 'oral' ? Pill : Syringe, tone: 'violet', label: 'Route', value: route === 'oral' ? 'Oral' : 'Subcutaneous' },
        { Icon: Package, tone: 'violet', label: 'Strengths', value: drug.vialSizes.join(' · ') || '—' },
        { Icon: drug.storageIntact.toLowerCase().includes('refrig') ? Snowflake : Thermometer, tone: 'gold', label: 'Store', value: drug.storageIntact || '—' },
        { Icon: Hourglass, tone: 'gold', label: 'Use within', value: room.big },
      ];

  // Flow strip nodes (IV only)
  const flow: { Icon: LucideIcon; label: string; value: string }[] = [];
  if (route === 'iv') {
    flow.push({ Icon: TestTube, label: drug.vialSizes.length > 1 ? 'Vials' : 'Vial', value: drug.vialSizes.join(' · ') || '—' });
    if (reconApplies) {
      flow.push({ Icon: Syringe, label: 'Add', value: [addVolume, diluentLabel(reconDiluent!)].filter(Boolean).join(' ') + (plan.perVial ? ` / ${plan.perVial}` : '') });
      if (concentrate) flow.push({ Icon: FlaskConical, label: 'Makes', value: concentrate });
    } else if (concentrate) {
      flow.push({ Icon: FlaskConical, label: naHint(r.diluent) === 'Liquid' ? 'Solution' : 'Concentrate', value: concentrate });
    }
    if (diluteApplies) flow.push({ Icon: Droplets, label: 'Dilute in', value: [bagVolume, diluent].filter(Boolean).join(' ') });
    if (finalConc && finalConc !== concentrate) flow.push({ Icon: CircleCheck, label: diluteApplies ? 'Final' : 'Give at', value: finalConc });
  }

  const storeIntact = drug.storageIntact || '';
  const intactIcon: LucideIcon = /refrig/i.test(storeIntact) ? Snowflake : /room/i.test(storeIntact) ? Thermometer : Package;
  const intactText = /refrig/i.test(storeIntact)
    ? 'Refrigerate 2–8 °C'
    : /room/i.test(storeIntact) ? 'Room temperature 20–25 °C' : storeIntact && !/varies/i.test(storeIntact) ? storeIntact : 'Varies by product — check carton';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── Identity + safety badges + at-a-glance tiles ── */}
      <div className="glass-panel p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {drug.category} · {drug.drugClass}
            </p>
            <h2 className="text-3xl md:text-[38px] font-bold tracking-tight text-white mt-1 leading-tight">{drug.genericName}</h2>
            <p className="text-[15px] text-slate-400 mt-1">{drug.brandName}</p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end md:max-w-[50%]">
            {drug.highAlert && <Badge Icon={ShieldAlert} tone="amber">High-alert</Badge>}
            {drug.vesicant && <Badge Icon={AlertTriangle} tone="rose">Vesicant</Badge>}
            {hazardous && <Badge Icon={Biohazard} tone="rose">Hazardous · NIOSH G1</Badge>}
            {catLabel && <Badge Icon={Layers} tone="violet">USP &lt;797&gt; {catLabel}</Badge>}
            {lightReq && <Badge Icon={Sun} tone="gold">Protect from light</Badge>}
            {filterReq && <Badge Icon={Filter} tone="gold">In-line filter{pore ? ` ${pore} µm` : ''}</Badge>}
            {nonPvc && <Badge Icon={Cable} tone="gold">Non-PVC set</Badge>}
            {route !== 'iv' && <Badge Icon={route === 'oral' ? Pill : Syringe} tone="slate">{route === 'oral' ? 'Oral' : 'Subcutaneous'}</Badge>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map(t => (
            <div key={t.label} className="rounded-2xl border border-white/10 bg-white/5 p-3.5 md:p-4">
              <div className="flex items-center gap-2">
                <t.Icon size={15} className={TONE[t.tone].icon} strokeWidth={2.25} />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{t.label}</span>
              </div>
              <p className="text-[16px] md:text-[17px] font-bold text-white mt-1.5 leading-snug break-words">{t.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── MIX ── */}
      <SectionCard
        Icon={FlaskConical}
        tone="violet"
        title="Mix"
        subtitle={route === 'iv' ? 'Reconstitute and dilute, step by step' : 'No compounding required'}
      >
        {route === 'iv' ? (
          <>
            {flow.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 mb-6">
                {flow.map((node, i) => (
                  <div key={i} className="contents">
                    {i > 0 && (
                      <div className="flex items-center justify-center text-slate-600 shrink-0" aria-hidden>
                        <ArrowRight size={18} className="rotate-90 sm:rotate-0" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-3 text-center">
                      <node.Icon size={22} className="mx-auto text-violet-300" strokeWidth={1.75} />
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 mt-1.5">{node.label}</p>
                      <p className="text-[13.5px] font-semibold text-white leading-snug mt-0.5 break-words">{node.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ol className="space-y-6">
              <Step n={1} title="Gather" headline={<>{drug.vialSizes.length ? `${drug.vialSizes.join(' · ')} ${drug.vialSizes.length > 1 ? 'vials' : 'vial'}` : 'See package'}</>}>
                {hazardous && (
                  <Tips tone="violet" items={[`Hazardous drug — prepare in a C-PEC${/^required/i.test(drug.hazardous?.cstd || '') ? ' with a CSTD' : ''}; wear chemo-rated gloves and gown (USP <800>).`]} />
                )}
              </Step>

              <Step
                n={2}
                title="Reconstitute"
                headline={reconApplies
                  ? <>Add {addVolume ? `${addVolume} ` : ''}{diluentLabel(reconDiluent!)}{addSuffix}{concentrate && <span className="text-violet-300"> → {concentrate}</span>}</>
                  : <span className="text-slate-300">No reconstitution — {(naHint(r.diluent) || 'supplied as a solution').toLowerCase()}{concentrate ? ` (${concentrate})` : ''}</span>}
              >
                {reconApplies && <Tips tone="violet" items={reconTips} />}
              </Step>

              <Step
                n={3}
                title={diluteApplies ? 'Dilute' : 'Prepare to give'}
                headline={diluteApplies
                  ? <>{[bagVolume, diluent].filter(Boolean).join(' ')}{finalConc && <span className="text-violet-300"> → {finalConc}</span>}</>
                  : <span className="text-slate-300">{diluent || naHint(dl.preferredDiluent) || 'No further dilution'}</span>}
              >
                <Tips tone="violet" items={diluteTips} />
              </Step>

              <Step n={4} title="Inspect" headline={<span className="text-slate-300 font-medium text-[14px]">{notes?.inspect ?? 'Check for particles and discoloration before use; discard if present.'}</span>}>
                {null}
              </Step>
            </ol>

            {stab?.note && (
              <Callout tone="amber" Icon={AlertTriangle} title="Compatibility">{stab.note}</Callout>
            )}
          </>
        ) : (
          <div className="flex items-start gap-3">
            <IconBox Icon={route === 'oral' ? Pill : Syringe} tone="violet" />
            <div>
              <p className="text-[15px] font-semibold text-white">
                {route === 'oral' ? 'Oral dosage form — dispense as supplied.' : 'Ready-to-use subcutaneous product — no mixing.'}
              </p>
              <p className="text-[13px] text-slate-400 mt-1">Strengths: {drug.vialSizes.join(' · ') || '—'}</p>
              {hazardous && <Tips tone="violet" items={['Hazardous drug — handle per USP <800> (no crushing or splitting outside containment).']} />}
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* ── ADMINISTER ── */}
        <SectionCard Icon={Syringe} tone="teal" title="Administer" subtitle="Rate, line set-up, and precautions">
          {route === 'iv' ? (
            <div>
              {val(inf.rate) && (
                <DetailRow Icon={Gauge} tone="teal" label="Rate" emphasis
                  value={/^titrated$/i.test(inf.rate)
                    ? (titration.length ? 'Titrated — see ladder below' : 'Titrated — per product PI')
                    : inf.rate} />
              )}
              {val(inf.duration) && <DetailRow Icon={Timer} tone="teal" label="Infuse over" value={inf.duration} emphasis />}
              <DetailRow Icon={Filter} tone={filterReq ? 'amber' : 'slate'} label="In-line filter"
                value={filterReq ? `Required${pore ? ` · ${pore} µm` : ''}` : 'Not required'} emphasis={filterReq} />
              <DetailRow Icon={Sun} tone={lightReq ? 'amber' : 'slate'} label="Light"
                value={lightReq ? 'Protect from light (cover bag)' : 'No protection needed'} emphasis={lightReq} />
              <DetailRow Icon={Cable} tone={nonPvc ? 'amber' : 'slate'} label="Bag & tubing"
                value={nonPvc ? 'Non-PVC / DEHP-free bag and set' : 'No special tubing'} emphasis={nonPvc} />
            </div>
          ) : (
            <DetailRow Icon={route === 'oral' ? Pill : Syringe} tone="teal" label={route === 'oral' ? 'How to take' : 'Technique'}
              value={drug.sequencing?.order || '—'} />
          )}

          {notes?.premed && (
            <Callout tone="teal" Icon={Pill} title="Premedicate">{notes.premed}</Callout>
          )}

          {notes?.administer && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Technique</p>
              <Tips tone="teal" items={notes.administer} />
            </div>
          )}

          {titration.length > 0 && (
            <div className="mt-5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <TrendingUp size={13} className="text-emerald-300" /> Rate ladder (per PI)
              </p>
              <div className="mt-2 space-y-2">
                {titration.map(p => (
                  <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-white">{p.label}</p>
                    <p className="text-[12.5px] text-slate-400 leading-relaxed mt-0.5">{p.notes}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Step-by-step rate table: Clinical Calculators → Biologic Rate Titration.</p>
            </div>
          )}

          {drug.vesicant && (
            <Callout tone="rose" Icon={AlertTriangle} title="Vesicant — extravasation">
              {drug.extravasation?.management}
              {val(drug.extravasation?.antidote) && <> Antidote: {drug.extravasation.antidote}.</>}
            </Callout>
          )}
          {drug.highAlert && (
            <Callout tone="amber" Icon={ShieldAlert} title="High-alert medication">
              Independent double-check of drug, dose, rate, and pump programming before starting.
            </Callout>
          )}
        </SectionCard>

        {/* ── STORE ── */}
        <SectionCard Icon={Snowflake} tone="gold" title="Store" subtitle="Unopened product and prepared doses">
          <DetailRow Icon={intactIcon} tone="gold" label="Unopened product" value={intactText} emphasis />
          {notes?.storageIntact && <Tips tone="gold" items={notes.storageIntact} />}

          {route === 'oral' ? (
            <DetailRow Icon={Hourglass} tone="gold" label="Dating" value={prettyBud(drug.bud?.roomTemp) === '—' ? 'Manufacturer expiration' : prettyBud(drug.bud?.roomTemp)} />
          ) : (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {route === 'subq' ? 'Allowable storage time' : 'After preparation — use within'}
              </p>
              {catLabel && (
                <span className="text-[10.5px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded-full px-2 py-0.5">
                  USP &lt;797&gt; {catLabel}
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { Icon: ThermometerSun, label: 'Room', cell: room },
                { Icon: Snowflake, label: 'Fridge', cell: fridge },
                { Icon: Snowflake, label: 'Frozen', cell: frozen },
              ].map(({ Icon, label, cell }) => (
                <div key={label} className={`rounded-xl border p-3 text-center ${cell.uspCapped ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
                  <Icon size={18} strokeWidth={1.9} className={`mx-auto ${label === 'Room' ? 'text-blue-300' : 'text-emerald-300'}`} />
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 mt-1">{label}</p>
                  <p className="text-[15px] font-bold text-white leading-tight mt-0.5">{cell.big}</p>
                  {cell.sub && <p className={`text-[10.5px] leading-snug mt-1 ${cell.uspCapped ? 'text-amber-400' : 'text-slate-500'}`}>{cell.sub}</p>}
                </div>
              ))}
            </div>
            {limits && (
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Assigned BUD = shorter of chemical stability and the USP &lt;797&gt; limit (aseptic, no sterility test). Amber = USP limit governs.
              </p>
            )}
          </div>
          )}

          {basisUseful && (
            <Callout tone="slate" Icon={Info} title="Stability note">{basis}</Callout>
          )}
          {elasto?.note && (
            <Callout tone="amber" Icon={AlertTriangle} title="Elastomeric pump note">{elasto.note}</Callout>
          )}

          {containers.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Home-infusion containers</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-[12px] min-w-[360px]">
                  <thead>
                    <tr className="bg-white/5 text-left">
                      <th className="px-2.5 py-2 font-semibold text-slate-200">Container</th>
                      <th className="px-2.5 py-2 font-semibold text-slate-200">Conc · Diluent</th>
                      <th className="px-2.5 py-2 font-semibold text-blue-300 text-center">Room</th>
                      <th className="px-2.5 py-2 font-semibold text-emerald-300 text-center">Fridge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.slice(0, 6).map((c, i) => (
                      <tr key={i} className={`border-t border-white/5 align-top ${i % 2 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="px-2.5 py-2 text-slate-200 font-medium">{c.container}</td>
                        <td className="px-2.5 py-2 text-slate-400">{c.concentration} · {c.diluent}</td>
                        <td className="px-2.5 py-2 text-center text-slate-200 tabular-nums whitespace-nowrap">{c.roomTemp}</td>
                        <td className="px-2.5 py-2 text-center text-slate-200 tabular-nums whitespace-nowrap">{c.refrigerated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {containers.length > 6 && (
                <p className="text-[11px] text-slate-500 mt-1.5">+{containers.length - 6} more in Drug Reference.</p>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Sources + next actions ── */}
      <div className="glass-panel p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <p className="text-[11.5px] text-slate-500 leading-relaxed md:max-w-[55%]">
          {notes ? <>Technique notes: {notes.source}. </> : null}
          Core prep data from the ClinicalRx drug database. Always verify against the current package insert and your institution&rsquo;s policies.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => emitOpenDrug({ drugKey: drug.id })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
          >
            <BookOpen size={13} /> Full monograph
          </button>
          <button
            type="button"
            onClick={() => emitAskCopilot({
              scenario: `Mixing Guide follow-up for ${drug.genericName} (${drug.brandName}): `,
            })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
          >
            <Network size={13} /> Ask Copilot
          </button>
          <a
            href={drug.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
          >
            <ExternalLink size={13} /> DailyMed PI
          </a>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab
// ═════════════════════════════════════════════════════════════════════════════

export function MixingGuide() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchDrugs(query), [query]);
  const drug = useMemo(() => DRUG_DB.find(d => d.id === selectedId) ?? null, [selectedId]);
  const quickPicks = useMemo(
    () => QUICK_PICKS.map(g => DRUG_DB.find(d => d.genericName === g)).filter((d): d is Drug => !!d),
    [],
  );

  const choose = (d: Drug) => {
    setSelectedId(d.id);
    setQuery(d.genericName);
    setOpen(false);
    inputRef.current?.blur();
  };

  const askCopilot = (name: string) => emitAskCopilot({
    scenario: `How do I reconstitute, dilute, administer, and store ${name}? Include diluent and volume, final concentration range, infusion rate/duration, filter and light requirements, and beyond-use dating.`,
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, Math.max(results.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div className="mixing-guide pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <div className="bg-violet-500/10 p-2.5 rounded-xl border border-violet-500/20">
            <Beaker className="text-violet-400" size={20} strokeWidth={2} />
          </div>
          Mixing Guide
        </h1>
        <p className="text-[15px] text-slate-400 mt-2">
          Type a drug to see how to mix it, give it, and store it — at a glance.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="mixing-guide-results"
          aria-autocomplete="list"
          aria-label="Search a drug"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Search a drug — e.g. infliximab, Remicade, vancomycin"
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 py-4 text-[16px] font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { setQuery(''); setSelectedId(null); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        )}

        {showDropdown && (
          <div
            id="mixing-guide-results"
            role="listbox"
            className="absolute z-30 left-0 right-0 mt-2 rounded-2xl border border-white/10 bg-[#121212] shadow-2xl overflow-hidden"
          >
            {results.length > 0 ? results.map((d, i) => (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(d)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${i === active ? 'bg-white/10' : ''}`}
              >
                <span className="min-w-0">
                  <span className="text-[14.5px] font-semibold text-white">{d.genericName}</span>
                  <span className="text-[13px] text-slate-400"> · {d.brandName}</span>
                </span>
                <span className="text-[11px] text-slate-500 shrink-0">{d.category}</span>
              </button>
            )) : (
              <div className="px-4 py-4">
                <p className="text-[14px] text-slate-300">No drug in the guide matches &ldquo;{query.trim()}&rdquo;.</p>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => askCopilot(query.trim())}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-colors"
                >
                  <Network size={13} /> Ask Infusion Copilot how to mix it
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick picks */}
      <div className="flex flex-wrap items-center gap-2 mb-7">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mr-1">Common</span>
        {quickPicks.map(d => (
          <button
            key={d.id}
            type="button"
            onClick={() => choose(d)}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
              selectedId === d.id
                ? 'bg-violet-500/20 border-violet-500/40 text-white'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {d.genericName === 'Immune Globulin IV' ? 'IVIG' : d.genericName}
          </button>
        ))}
      </div>

      {drug ? (
        <MixingCard key={drug.id} drug={drug} />
      ) : (
        <div className="glass-panel p-6 md:p-8">
          <p className="text-[15px] text-slate-300 mb-6">Pick a drug above. Every card reads in the same three blocks:</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { Icon: FlaskConical, tone: 'violet' as Tone, title: 'Mix', body: 'Vial → diluent → bag, with swirl/shake and diluent cautions.' },
              { Icon: Syringe, tone: 'teal' as Tone, title: 'Administer', body: 'Rate, duration, filter, light, tubing, premeds, and rate ladder.' },
              { Icon: Snowflake, tone: 'gold' as Tone, title: 'Store', body: 'Unopened storage and the BUD to assign once prepared.' },
            ].map(b => (
              <div key={b.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <IconBox Icon={b.Icon} tone={b.tone} />
                <p className="text-[15px] font-bold text-white mt-3 uppercase tracking-wide">{b.title}</p>
                <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-slate-500 mt-6 flex items-center gap-1.5">
            <Eye size={13} /> {DRUG_DB.length} drugs available. Not listed? Search it anyway — you can hand it to Infusion Copilot.
          </p>
        </div>
      )}
    </div>
  );
}
