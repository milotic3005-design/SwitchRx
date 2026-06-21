// ─────────────────────────────────────────────────────────────────────────────
// Beyond-Use Dating (BUD) — container-specific chemical stability + USP <797>
// microbiological cross-check.
//
// Two independent limits govern the BUD a pharmacist may assign to a compounded
// sterile preparation (CSP):
//   1. CHEMICAL/PHYSICAL stability — how long the drug stays ≥90% potent in a
//      given container/diluent (source: ASHP Extended Stability for Parenteral
//      Drugs, 6th ed.). This is container- AND concentration-dependent, so it is
//      tabulated per container below.
//   2. MICROBIOLOGICAL limit — USP <797> caps the BUD by sterility risk,
//      independent of chemical stability.
//
// The ASSIGNED BUD is the *lesser* of the two. This module exposes both so the
// UI can show the cross-check explicitly.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContainerStability {
  container: string;     // e.g. "PVC bag", "Glass", "Syringe (plastic)", "Elastomeric pump"
  concentration: string; // e.g. "5 mg/mL", "10–40 mg/mL"
  diluent: string;       // e.g. "NS or D5W", "NS only", "D5W only"
  roomTemp: string;      // chemical stability at 20–25 °C; "—" if no data
  refrigerated: string;  // chemical stability at 2–8 °C; "—" if no data
  frozen?: string;       // chemical stability at ≤ –10 °C
}

export interface DrugStability {
  containers: ContainerStability[];
  note?: string;
  source: string;
}

// ── USP <797> (2023) BUD limits ────────────────────────────────────────────────
// Category 1 CSP (segregated compounding area; ≤12 h RT / ≤24 h refrigerated).
// Category 2 CSP (ISO-classified cleanroom) — limit depends on preparation method
// and whether a sterility test was performed and passed.
export interface USP797Row {
  storage: string;
  cat1: string;
  cat2AsepticNoTest: string;
  cat2AsepticTested: string;
  cat2TerminalNoTest: string;
  cat2TerminalTested: string;
}

export const USP797_BUD: USP797Row[] = [
  {
    storage: 'Controlled room temp (20–25 °C)',
    cat1: '12 hours',
    cat2AsepticNoTest: '4 days',
    cat2AsepticTested: '30 days',
    cat2TerminalNoTest: '14 days',
    cat2TerminalTested: '45 days',
  },
  {
    storage: 'Refrigerated (2–8 °C)',
    cat1: '24 hours',
    cat2AsepticNoTest: '10 days',
    cat2AsepticTested: '45 days',
    cat2TerminalNoTest: '28 days',
    cat2TerminalTested: '60 days',
  },
  {
    storage: 'Frozen (–25 to –10 °C)',
    cat1: '—',
    cat2AsepticNoTest: '45 days',
    cat2AsepticTested: '60 days',
    cat2TerminalNoTest: '45 days',
    cat2TerminalTested: '90 days',
  },
];

// Default scenario applied for the headline cross-check: the most common
// outpatient/home-infusion case — aseptically processed, NO sterility test.
// Values in hours.
export const USP797_LIMIT_HOURS = {
  cat1:      { roomTemp: 12,  refrigerated: 24,  frozen: null as number | null },
  cat2:      { roomTemp: 96,  refrigerated: 240, frozen: 1080 }, // aseptic, no sterility test
};

// ── Duration parsing helpers ───────────────────────────────────────────────────
// Convert a free-text duration ("17 days", "22 hours (NS)", "26 weeks",
// "Until Exp") to hours. Returns Infinity for "until expiration" and null for
// non-numeric ("Do not ref", "N/A").
export function parseDurationToHours(s?: string): number | null {
  if (!s) return null;
  const t = s.toLowerCase().trim();
  if (t.includes('until exp') || t.includes('expir')) return Number.POSITIVE_INFINITY;
  const m = t.match(/([\d.]+)\s*(minutes?|min|months?|mo|weeks?|wks?|wk|w|hours?|hrs?|hr|h|days?|d|m)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2];
  if (u.startsWith('min')) return n / 60;
  if (u.startsWith('month') || u === 'mo' || u === 'm') return n * 24 * 30;
  if (u.startsWith('w')) return n * 24 * 7;
  if (u.startsWith('h')) return n;
  if (u.startsWith('d')) return n * 24;
  return null;
}

export function formatHours(h: number | null): string {
  if (h === null) return '—';
  if (!isFinite(h)) return 'Until expiration';
  if (h < 24) return `${h % 1 === 0 ? h : h.toFixed(1)} h`;
  const d = h / 24;
  if (d % 1 === 0) return `${d} day${d === 1 ? '' : 's'}`;
  return `${d.toFixed(1)} days`;
}

export type LimitSource = 'stability' | 'usp797' | 'unknown';

export interface EffectiveBud {
  value: string;        // formatted assigned BUD
  limitedBy: LimitSource;
}

// Assigned BUD = min(chemical stability, USP <797> limit). Reports which limit governs.
export function effectiveBud(chemical: string | undefined, limitHours: number | null): EffectiveBud {
  const chem = parseDurationToHours(chemical);
  if (limitHours === null) {
    return { value: chem === null ? '—' : formatHours(chem), limitedBy: chem === null ? 'unknown' : 'stability' };
  }
  if (chem === null) return { value: '—', limitedBy: 'unknown' };
  if (chem <= limitHours) return { value: formatHours(chem), limitedBy: 'stability' };
  return { value: formatHours(limitHours), limitedBy: 'usp797' };
}

// ── Per-container stability data (ASHP ESPD 6th ed.) ────────────────────────────
// Keyed by lowercased generic name. Containers consolidated to the clinically
// meaningful types; the many elastomeric brands (AccuFlo, Dosi-Fuser, Easypump,
// Homepump, INTERMATE, SMARTeZ) are summarized as one "Elastomeric pump" range.
const ASHP = 'ASHP Extended Stability for Parenteral Drugs, 6th ed.';

export const BUD_STABILITY: Record<string, DrugStability> = {
  'vancomycin': {
    source: ASHP,
    containers: [
      { container: 'Glass', concentration: '5 mg/mL', diluent: 'NS or D5W', roomTemp: '17 d', refrigerated: '63 d', frozen: '63 d' },
      { container: 'PVC bag', concentration: '5–10 mg/mL', diluent: 'NS or D5W', roomTemp: '17 d', refrigerated: '58 d', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '8.3–16.7 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '17 d', frozen: '17 d' },
      { container: 'Syringe (polypropylene)', concentration: '5 mg/mL', diluent: 'NS or D5W', roomTemp: '14 d', refrigerated: '6 mo', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '5–15 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '14–30 d', frozen: '—' },
    ],
    note: 'Incompatible with heparin. Higher concentrations need a central line (irritation).',
  },
  'piperacillin/tazobactam': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '20–80 mg/mL', diluent: 'NS or D5W', roomTemp: '72 h', refrigerated: '28 d', frozen: '—' },
      { container: 'Polyolefin bag', concentration: '40 mg/mL', diluent: 'NS', roomTemp: '2.8 d', refrigerated: '17.7 d', frozen: '—' },
      { container: 'Syringe (polypropylene)', concentration: '150–200 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '7 d', frozen: '30 d' },
      { container: 'Elastomeric pump', concentration: '10–80 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '28 d', frozen: '—' },
    ],
    note: 'Generic (non-EDTA) formulations are incompatible with LR; Zosyn (EDTA) is compatible.',
  },
  'cefepime': {
    source: ASHP,
    containers: [
      { container: 'Glass', concentration: '1–40 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '7 d', frozen: '—' },
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'NS or D5W', roomTemp: '2 d', refrigerated: '23 d', frozen: '30 d' },
      { container: 'Syringe (polypropylene)', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '2 d', refrigerated: '21 d', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '14 d', frozen: '—' },
    ],
  },
  'meropenem': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '1 mg/mL', diluent: 'NS', roomTemp: '22 h', refrigerated: '7 d', frozen: '—' },
      { container: 'PVC bag', concentration: '10–20 mg/mL', diluent: 'NS', roomTemp: '13 h', refrigerated: '5 d', frozen: '—' },
      { container: 'Glass', concentration: '2.5 mg/mL', diluent: 'D5W', roomTemp: '4 h', refrigerated: '24 h', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '50 mg/mL', diluent: 'NS', roomTemp: '8 h', refrigerated: '40 h', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '5 mg/mL', diluent: 'NS', roomTemp: '21–26 h', refrigerated: '10 d', frozen: '—' },
    ],
    note: 'D5W is markedly less stable than NS — prepare fresh and use promptly when D5W is used.',
  },
  'levofloxacin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '0.5–5 mg/mL', diluent: 'NS or D5W', roomTemp: '3 d', refrigerated: '14 d', frozen: '26 w' },
      { container: 'Elastomeric pump', concentration: '5 mg/mL', diluent: 'NS or D5W', roomTemp: '72 h', refrigerated: '14 d', frozen: '6 mo' },
    ],
    note: 'Protect from light and freezing.',
  },
  'dalbavancin': {
    source: ASHP,
    containers: [
      { container: 'IV bag (unspecified)', concentration: '1–5 mg/mL', diluent: 'D5W only', roomTemp: '48 h', refrigerated: '48 h', frozen: '—' },
    ],
    note: 'D5W only — incompatible with saline; flush line with D5W. Combined RT + refrigerated storage ≤48 h total.',
  },
  'ampicillin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '4 d', frozen: '—' },
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'D5W', roomTemp: '2 h', refrigerated: '—', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '2.1–33 mg/mL', diluent: 'NS', roomTemp: '8 h', refrigerated: '48 h', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '2.1–33 mg/mL', diluent: 'D5W', roomTemp: '2 h', refrigerated: '4 h', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '8 h', refrigerated: '3 d', frozen: '—' },
    ],
    note: 'Stability falls sharply in dextrose and as concentration rises. NS strongly preferred.',
  },
  'nafcillin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '3 d', refrigerated: '24 d', frozen: '—' },
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'D5W', roomTemp: '7 d', refrigerated: '15 d', frozen: '30 d' },
      { container: 'Syringe (plastic)', concentration: '8.3–33 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '96 h', frozen: '30 d' },
      { container: 'Elastomeric pump', concentration: '5–50 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '3 d', frozen: '—' },
    ],
    note: 'Limit to ≤20 mg/mL in NS; precipitation seen ≥40 mg/mL at body temperature.',
  },
  'oxacillin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '10 mg/mL', diluent: 'D5W', roomTemp: '24 h', refrigerated: '—', frozen: '30 d' },
      { container: 'Syringe (plastic)', concentration: '8.3–33 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '8 d', frozen: '30 d' },
      { container: 'Unspecified', concentration: '10–100 mg/mL', diluent: 'NS', roomTemp: '4 d', refrigerated: '7 d', frozen: '30 d' },
      { container: 'Elastomeric pump', concentration: '10–100 mg/mL', diluent: 'NS', roomTemp: '4 d', refrigerated: '10 d', frozen: '—' },
    ],
  },
  'cefazolin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '7 d', refrigerated: '15 d', frozen: '—' },
      { container: 'PVC bag', concentration: '10 mg/mL', diluent: 'D5W', roomTemp: '24 h', refrigerated: '30 d', frozen: '30 d' },
      { container: 'Syringe (plastic)', concentration: '8.3–33 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '96 h', frozen: '26 w' },
      { container: 'Elastomeric pump', concentration: '5–40 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '10 d', frozen: '30 d' },
    ],
  },
  'ceftriaxone': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '10–40 mg/mL', diluent: 'NS or D5W', roomTemp: '2 d', refrigerated: '10 d', frozen: '—' },
      { container: 'PVC bag', concentration: '40 mg/mL', diluent: 'NS', roomTemp: '3 d', refrigerated: '30 d', frozen: '—' },
      { container: 'Polyolefin bag', concentration: '10–40 mg/mL', diluent: 'NS or D5W', roomTemp: '—', refrigerated: '—', frozen: '26 w' },
      { container: 'Syringe (plastic)', concentration: '8.3–33 mg/mL', diluent: 'NS', roomTemp: '72 h', refrigerated: '10 d', frozen: '26 w' },
      { container: 'Elastomeric pump', concentration: '5–40 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '14–28 d', frozen: '—' },
    ],
    note: 'Never mix or co-infuse with calcium-containing solutions (ceftriaxone–calcium precipitation; fatal in neonates).',
  },
  'ciprofloxacin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '2.86 mg/mL', diluent: 'NS or D5W', roomTemp: '90 d', refrigerated: '90 d', frozen: '—' },
      { container: 'Unspecified', concentration: '0.5–2 mg/mL', diluent: 'NS, D5W, LR', roomTemp: '14 d', refrigerated: '14 d', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '0.5–6 mg/mL', diluent: 'NS or D5W', roomTemp: '10–30 d', refrigerated: '30–90 d', frozen: '—' },
    ],
    note: 'Protect from light. White precipitate forms immediately with heparin.',
  },
  'penicillin g': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '20,000 units/mL', diluent: 'NS', roomTemp: '4 d', refrigerated: '4 d', frozen: '25 d' },
      { container: 'PVC bag', concentration: '2,500–50,000 units/mL', diluent: 'NS or D5W', roomTemp: '—', refrigerated: '21 d', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '16,667–33,333 units/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '24 h', frozen: '30 d' },
      { container: 'Elastomeric pump', concentration: '20,000–100,000 units/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '4–10 d', frozen: '30 d' },
    ],
  },
  'ceftazidime': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '40 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '14 d', frozen: '—' },
      { container: 'PVC bag', concentration: '40 mg/mL', diluent: 'D5W', roomTemp: '24 h', refrigerated: '10 d', frozen: '—' },
      { container: 'Glass', concentration: '40 mg/mL', diluent: 'NS', roomTemp: '2 d', refrigerated: '28 d', frozen: '90 d' },
      { container: 'Syringe (plastic)', concentration: '8.3–33 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '7 d', frozen: '12 w' },
      { container: 'Elastomeric pump', concentration: '40 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '14 d', frozen: '—' },
    ],
  },
  'ceftaroline': {
    source: ASHP,
    containers: [
      { container: 'IV bag (unspecified)', concentration: '8–12 mg/mL', diluent: 'NS, D5W, ½NS, LR', roomTemp: '6 h', refrigerated: '24 h', frozen: '—' },
      { container: 'Mini-Bag Plus', concentration: '4–12 mg/mL', diluent: 'NS', roomTemp: '6 h', refrigerated: '24 h', frozen: '—' },
    ],
    note: 'Dilute total dose in 50–250 mL; infusion concentration ≤12 mg/mL.',
  },
  'ertapenem': {
    source: ASHP,
    containers: [
      { container: 'Syringe (plastic)', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '17 h', refrigerated: '110 h', frozen: '—' },
      { container: 'Syringe (polypropylene)', concentration: '100 mg/mL', diluent: 'NS', roomTemp: '30 min', refrigerated: '24 h', frozen: '28 d' },
      { container: 'Elastomeric pump', concentration: '10 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '7 d', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '5 d', frozen: '—' },
    ],
    note: 'NS only — do not reconstitute or dilute with dextrose. Do not freeze.',
  },
  'imipenem': {
    source: ASHP,
    containers: [
      { container: 'Glass', concentration: '2.5 mg/mL', diluent: 'NS', roomTemp: '9 h', refrigerated: '72 h', frozen: '—' },
      { container: 'Glass', concentration: '2.5 mg/mL', diluent: 'D5W', roomTemp: '6 h', refrigerated: '24 h', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '5 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '3 d', frozen: '—' },
    ],
    note: 'Max solubility 5 mg/mL. Shake and equilibrate refrigerated solutions to RT before use.',
  },
  'daptomycin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '2.5–20 mg/mL', diluent: 'NS', roomTemp: '12 h', refrigerated: '10 d', frozen: '—' },
      { container: 'Vial', concentration: '50 mg/mL', diluent: 'NS', roomTemp: '12 h', refrigerated: '48 h', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '—', refrigerated: '10 d', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '10 d', frozen: '—' },
    ],
    note: 'NS only — incompatible with dextrose. Package insert labels 12 h RT / 48 h refrigerated.',
  },
  'aztreonam': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '10–20 mg/mL', diluent: 'NS or D5W', roomTemp: '48 h', refrigerated: '7 d', frozen: '—' },
      { container: 'Unspecified', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '37 d', refrigerated: '120 d', frozen: '120 d' },
      { container: 'Syringe (plastic)', concentration: '0.83–33 mg/mL', diluent: 'NS', roomTemp: '48 h', refrigerated: '7 d', frozen: '90 d' },
      { container: 'Elastomeric pump', concentration: '10–30 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '7–28 d', frozen: '—' },
    ],
  },
  'cefoxitin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '13 d', frozen: '—' },
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'D5W', roomTemp: '24 h', refrigerated: '13 d', frozen: '30 d' },
      { container: 'Glass', concentration: '20 mg/mL', diluent: 'D5W', roomTemp: '24 h', refrigerated: '7 d', frozen: '13 w' },
      { container: 'Syringe (plastic)', concentration: '16.7–33 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '7 d', frozen: '30 w' },
      { container: 'Elastomeric pump', concentration: '5–60 mg/mL', diluent: 'NS or D5W', roomTemp: '—', refrigerated: '10 d', frozen: '30 d' },
    ],
  },
  'linezolid': {
    source: ASHP,
    containers: [
      { container: 'RTU premix bag', concentration: '2 mg/mL', diluent: 'Ready-to-use', roomTemp: 'Until Exp', refrigerated: '—', frozen: 'Do not freeze' },
    ],
    note: 'Commercial RTU only — store at RT; use within 30 d of removing foil overwrap. Protect from light. Yellow color may intensify without affecting potency.',
  },
  'tigecycline': {
    source: ASHP,
    containers: [
      { container: 'IV bag (unspecified)', concentration: '≤1 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '48 h', frozen: '—' },
    ],
    note: 'RT total ≤24 h includes ≤6 h reconstituted in the vial. Solution must be yellow–orange; discard otherwise.',
  },
  'amikacin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'D5W', roomTemp: '—', refrigerated: '30 d', frozen: '—' },
      { container: 'Glass', concentration: '50 mg/mL', diluent: 'NS', roomTemp: '—', refrigerated: '—', frozen: '6 mo' },
      { container: 'Unspecified', concentration: '0.25–5 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '60 d', frozen: '30 d' },
      { container: 'Elastomeric pump', concentration: '10 mg/mL', diluent: 'NS', roomTemp: '24–48 h', refrigerated: '7–28 d', frozen: '—' },
    ],
    note: 'Incompatible with heparin (immediate precipitation).',
  },
  'gentamicin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '1 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '24 h', frozen: '30 d' },
      { container: 'Syringe (plastic)', concentration: '1.3 mg/mL', diluent: 'NS or D5W', roomTemp: '30 d', refrigerated: '30 d', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '1 mg/mL', diluent: 'NS', roomTemp: '2 d', refrigerated: '14 d', frozen: '—' },
    ],
    note: 'Incompatible with heparin.',
  },
  'tobramycin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '0.2–1 mg/mL', diluent: 'NS or D5W', roomTemp: '48 h', refrigerated: '—', frozen: '28 d' },
      { container: 'Syringe (plastic)', concentration: '12.5 mg/mL', diluent: 'NS or W', roomTemp: '14 d', refrigerated: '14 d', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '40 mg/mL', diluent: 'Unspecified', roomTemp: '60 d', refrigerated: '60 d', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '0.2–10 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '14 d', frozen: '—' },
    ],
    note: 'Incompatible with heparin.',
  },
  'clindamycin': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '6–12 mg/mL', diluent: 'NS, D5W, LR', roomTemp: '16 d', refrigerated: '32 d', frozen: '8 w' },
      { container: 'Glass', concentration: '6–12 mg/mL', diluent: 'NS, D5W, LR', roomTemp: '16 d', refrigerated: '32 d', frozen: '8 w' },
      { container: 'Syringe (plastic)', concentration: '5–10 mg/mL', diluent: 'NS or D5W', roomTemp: '48 h', refrigerated: '30 d', frozen: '60 d' },
      { container: 'Elastomeric pump', concentration: '6–12 mg/mL', diluent: 'NS', roomTemp: '3 d', refrigerated: '10 d', frozen: '—' },
    ],
    note: '≤18 mg/mL. Crystals form when refrigerated — redissolve at RT before administration.',
  },
  'metronidazole': {
    source: ASHP,
    containers: [
      { container: 'RTU premix bag', concentration: '5 mg/mL', diluent: 'Ready-to-use', roomTemp: 'Until Exp', refrigerated: 'Do not ref', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '5 mg/mL', diluent: 'NS', roomTemp: '24 h', refrigerated: '10 d', frozen: '—' },
    ],
    note: 'Susceptible to crystallization when refrigerated (redissolves at RT). Avoid direct sunlight.',
  },
  'micafungin': {
    source: ASHP,
    containers: [
      { container: 'IV bag', concentration: '0.25–4 mg/mL', diluent: 'NS or D5W', roomTemp: '4 d', refrigerated: '7 d', frozen: '—' },
      { container: 'Syringe (polypropylene)', concentration: '0.5–1 mg/mL', diluent: 'NS', roomTemp: '15 d', refrigerated: '—', frozen: '—' },
      { container: 'Vial', concentration: '10 mg/mL', diluent: 'NS', roomTemp: '2 d', refrigerated: '14 d', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '0.2–1 mg/mL', diluent: 'NS or D5W', roomTemp: '—', refrigerated: '10 d', frozen: '—' },
    ],
    note: 'Protect the diluted solution from light.',
  },
  'ampicillin-sulbactam': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '20 mg/mL', diluent: 'NS', roomTemp: '8 h', refrigerated: '72 h', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '8.3–33 mg/mL', diluent: 'NS', roomTemp: '8 h', refrigerated: '48 h', frozen: '—' },
      { container: 'Syringe (plastic)', concentration: '8.3–33 mg/mL', diluent: 'D5W', roomTemp: '2 h', refrigerated: '4 h', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '30 mg/mL', diluent: 'NS', roomTemp: '6 h', refrigerated: '4 d', frozen: '—' },
    ],
    note: 'NS preferred — D5W markedly less stable. Concentrations expressed as ampicillin (2:1 ampicillin:sulbactam).',
  },
  'ceftolozane-tazobactam': {
    source: ASHP,
    containers: [
      { container: 'PVC bag', concentration: '1–10 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '7 d', frozen: '—' },
      { container: 'Elastomeric pump', concentration: '1–10 mg/mL', diluent: 'NS or D5W', roomTemp: '24 h', refrigerated: '7 d', frozen: '—' },
    ],
    note: 'Refrigerate intact vials, protect from light. Do not freeze. Concentrations as ceftolozane (2:1 ceftolozane:tazobactam).',
  },
};

// Resolve container-level stability by generic name (case-insensitive; tolerates
// "/" vs "-" in combination names).
export function getBudStability(genericName: string): DrugStability | null {
  if (!genericName) return null;
  const k = genericName.trim().toLowerCase();
  return (
    BUD_STABILITY[k] ||
    BUD_STABILITY[k.replace(/\s*\/\s*/g, '-')] ||
    BUD_STABILITY[k.replace(/\s*-\s*/g, '/')] ||
    null
  );
}
