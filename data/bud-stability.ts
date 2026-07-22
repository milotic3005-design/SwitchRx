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

// ─────────────────────────────────────────────────────────────────────────────
// McKesson SMARTeZ®/EPIC Medical elastomeric infusion pump stability
// Source: McKesson Elastomeric Infusion Pump Drug Stability Data, AN-SM-24-04-001
// (effective 2024-04-29). Chemical stability only (not sterility). FTIR equivalency
// studies establish these values are reproducible in SMARTeZ®/EPIC Medical pumps.
// Keyed by lowercased generic name (matches DrugReference genericName).
// ─────────────────────────────────────────────────────────────────────────────
export const MCK_ELASTOMERIC_SOURCE =
  'McKesson SMARTeZ®/EPIC Medical Elastomeric Infusion Pump Drug Stability Data (AN-SM-24-04-001, eff. 2024-04-29)';

export interface ElastomericRow {
  concentration: string;
  diluent: string;
  refrigerated: string; // 2–8 °C; "—" if not tested
  roomTemp: string;     // 20–25 °C; "—" if not tested
}

export interface ElastomericStability {
  rows: ElastomericRow[];
  note?: string;
}

export const MCK_ELASTOMERIC: Record<string, ElastomericStability> = {
  'fluorouracil': {
    rows: [
      { concentration: '5 mg/mL', diluent: 'D5W or NS', refrigerated: '—', roomTemp: '45 d' },
      { concentration: '50 mg/mL', diluent: 'RTU', refrigerated: '—', roomTemp: '45 d' },
    ],
    note: 'Potential for precipitation (concentration/pH/diluent dependent). With sodium folinate (leucovorin) 5+2 or 36+8.8 mg/mL in NS: room temp 7 days.',
  },
  'acyclovir': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '5 d' },
    ],
  },
  'agalsidase beta': {
    rows: [
      { concentration: '0.05 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '24 h' },
      { concentration: '0.7 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '24 h' },
    ],
  },
  'amikacin': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '15 d', roomTemp: '48 h' },
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '15 d', roomTemp: '48 h' },
    ],
  },
  'amoxicillin': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '6 h', roomTemp: '2 h' },
      { concentration: '40 mg/mL', diluent: 'NS', refrigerated: '6 h', roomTemp: '2 h' },
    ],
  },
  'amoxicillin-clavulanate': {
    rows: [
      { concentration: '10+2 mg/mL', diluent: 'NS', refrigerated: '6 h', roomTemp: '—' },
      { concentration: '20+4 mg/mL', diluent: 'NS', refrigerated: '6 h', roomTemp: '—' },
    ],
  },
  'ampicillin': {
    rows: [
      { concentration: '12 mg/mL', diluent: 'NS', refrigerated: '4 d', roomTemp: '6 h' },
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '3 d', roomTemp: '24 h' },
    ],
  },
  'ampicillin-sulbactam': {
    rows: [
      { concentration: '30+15 mg/mL', diluent: 'NS', refrigerated: '2 d', roomTemp: '6 h' },
    ],
  },
  'amphotericin b': {
    rows: [
      { concentration: '0.1 mg/mL', diluent: 'D5W', refrigerated: '4 d', roomTemp: '24 h' },
      { concentration: '0.5 mg/mL', diluent: 'D5W', refrigerated: '4 d', roomTemp: '24 h' },
      { concentration: '2 mg/mL', diluent: 'D5W', refrigerated: '4 d', roomTemp: '24 h' },
    ],
    note: 'Conventional amphotericin B. Susceptible to crystallization when refrigerated.',
  },
  'azithromycin': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
    ],
  },
  'aztreonam': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
      { concentration: '30 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
    ],
  },
  'bupivacaine': {
    rows: [
      { concentration: '5 mg/mL (HCl)', diluent: 'RTU', refrigerated: '15 d', roomTemp: '2 d' },
      { concentration: '0.125%', diluent: 'NS', refrigerated: '—', roomTemp: '30 d' },
      { concentration: '0.750%', diluent: 'NS', refrigerated: '—', roomTemp: '30 d' },
    ],
  },
  'bumetanide': {
    rows: [
      { concentration: '0.016 mg/mL', diluent: 'D5W', refrigerated: '—', roomTemp: '24 h' },
      { concentration: '0.16 mg/mL', diluent: 'D5W', refrigerated: '—', roomTemp: '24 h' },
    ],
  },
  'caspofungin': {
    rows: [
      { concentration: '0.2 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '60 h' },
      { concentration: '0.5 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '60 h' },
    ],
  },
  'cefazolin': {
    rows: [
      { concentration: '16.7 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '2 d' },
    ],
  },
  'cefepime': {
    rows: [
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
    ],
  },
  'cefotaxime': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '15 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '16.66 mg/mL', diluent: 'NS', refrigerated: '3 d', roomTemp: '24 h' },
    ],
  },
  'cefotiam': {
    rows: [
      { concentration: '20 mg/mL', diluent: 'NS/D5W', refrigerated: '24 h', roomTemp: '6 h' },
    ],
  },
  'cefoxitin': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '48 h' },
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '48 h' },
    ],
  },
  'ceftazidime': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '2 d', roomTemp: '24 h' },
      { concentration: '40 mg/mL (combined test)', diluent: 'NS', refrigerated: '2 d', roomTemp: '12 h' },
      { concentration: '40 mg/mL (separate test)', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '9 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '—' },
      { concentration: '60 mg/mL', diluent: 'NS', refrigerated: '5 d', roomTemp: '—' },
    ],
    note: 'Pyridine determination applies to 9 and 60 mg/mL rows.',
  },
  'ceftolozane-tazobactam': {
    rows: [
      { concentration: '1+0.5 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '2+1 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '30+15 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
    ],
  },
  'ceftriaxone': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '48 h' },
      { concentration: '50 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '48 h' },
      { concentration: '10 mg/mL', diluent: 'D5W', refrigerated: '6 d', roomTemp: '24 h' },
    ],
    note: 'Susceptible to crystallization when refrigerated. Never co-infuse with calcium-containing solutions.',
  },
  'cefuroxime': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '3 d', roomTemp: '24 h' },
      { concentration: '30 mg/mL', diluent: 'NS', refrigerated: '3 d', roomTemp: '24 h' },
      { concentration: '1 mg/mL', diluent: 'D5W', refrigerated: '3 d', roomTemp: '12 h' },
      { concentration: '30 mg/mL', diluent: 'D5W', refrigerated: '3 d', roomTemp: '12 h' },
    ],
  },
  'cimetidine': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '7 d' },
      { concentration: '6 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '7 d' },
    ],
  },
  'ciprofloxacin': {
    rows: [
      { concentration: '2 mg/mL', diluent: 'D5W', refrigerated: '30 d', roomTemp: '10 d' },
    ],
  },
  'cisplatin': {
    rows: [
      { concentration: '0.2 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
      { concentration: '0.1 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '14 d' },
      { concentration: '0.5 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '14 d' },
    ],
    note: 'Potential for precipitation (concentration/pH/diluent dependent).',
  },
  'clindamycin': {
    rows: [
      { concentration: '6 mg/mL', diluent: 'NS', refrigerated: '30 d', roomTemp: '3 d' },
      { concentration: '12 mg/mL', diluent: 'NS', refrigerated: '30 d', roomTemp: '3 d' },
    ],
  },
  'colistimethate': {
    rows: [
      { concentration: '3 mg/mL', diluent: 'NS', refrigerated: '24 h', roomTemp: '2 h' },
    ],
  },
  'cloxacillin': {
    rows: [
      { concentration: '50 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
    ],
  },
  'cyclophosphamide': {
    rows: [
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '2 d' },
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '2 d' },
    ],
  },
  'daptomycin': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '10 d', roomTemp: '1 d' },
      { concentration: '5 mg/mL', diluent: 'NS', refrigerated: '10 d', roomTemp: '1 d' },
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '10 d', roomTemp: '1 d' },
    ],
  },
  'deferoxamine': {
    rows: [
      { concentration: '0.022 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '2 d' },
      { concentration: '5 mg/mL (mesylate)', diluent: 'NS', refrigerated: '14 d', roomTemp: '2 d' },
      { concentration: '100 mg/mL (mesylate)', diluent: 'NS', refrigerated: '14 d', roomTemp: '2 d' },
    ],
  },
  'doxorubicin': {
    rows: [
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '22 d', roomTemp: '14 d' },
    ],
  },
  'doxycycline': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS/D5W', refrigerated: '3 d', roomTemp: '12 h' },
      { concentration: '1.5 mg/mL', diluent: 'NS/D5W', refrigerated: '3 d', roomTemp: '12 h' },
    ],
  },
  'ertapenem': {
    rows: [
      { concentration: '5 mg/mL (combined test)', diluent: 'NS', refrigerated: '24 h', roomTemp: '6 h' },
      { concentration: '20 mg/mL (combined test)', diluent: 'NS', refrigerated: '24 h', roomTemp: '6 h' },
      { concentration: '5 mg/mL (separate test)', diluent: 'NS', refrigerated: '7 d', roomTemp: '—' },
      { concentration: '10 mg/mL (separate test)', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
      { concentration: '20 mg/mL (separate test)', diluent: 'NS', refrigerated: '5 d', roomTemp: '24 h' },
    ],
    note: 'NS only — do not use dextrose.',
  },
  'etoposide': {
    rows: [
      { concentration: '0.2 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '4 d' },
      { concentration: '0.4 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '24 h' },
    ],
  },
  'ferric carboxymaltose': {
    rows: [
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '3 d' },
      { concentration: '5 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '3 d' },
    ],
    note: 'PDF lists as Ferinject (iron(III) sucrose complex).',
  },
  'flucloxacillin': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '2 d', roomTemp: '24 h' },
      { concentration: '70 mg/mL', diluent: 'NS', refrigerated: '2 d', roomTemp: '24 h' },
    ],
  },
  'fluconazole': {
    rows: [
      { concentration: '2 mg/mL', diluent: 'RTU', refrigerated: '7 d', roomTemp: '2 d' },
    ],
  },
  'floxuridine': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '1 d' },
    ],
  },
  'folinic acid': {
    rows: [
      { concentration: '4 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '2 d' },
    ],
  },
  'foscarnet': {
    rows: [
      { concentration: '12 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '7 d' },
      { concentration: '24 mg/mL', diluent: 'RTU', refrigerated: '14 d', roomTemp: '7 d' },
    ],
  },
  'fosfomycin': {
    rows: [
      { concentration: '16.6 mg/mL', diluent: 'D5W', refrigerated: '—', roomTemp: '2 d' },
      { concentration: '40 mg/mL', diluent: 'D5W', refrigerated: '—', roomTemp: '2 d' },
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '24 h' },
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '1 h (37°C)' },
    ],
  },
  'furosemide': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '4 d' },
    ],
  },
  'ganciclovir': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '2 d' },
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '2 d' },
      { concentration: '1 mg/mL', diluent: 'D5W', refrigerated: '14 d', roomTemp: '2 d' },
      { concentration: '10 mg/mL', diluent: 'D5W', refrigerated: '14 d', roomTemp: '2 d' },
    ],
    note: 'Potential for precipitation (concentration/pH/diluent dependent).',
  },
  'gentamicin': {
    rows: [
      { concentration: '0.5 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '7 d' },
      { concentration: '5 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '7 d' },
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '28 d', roomTemp: '48 h' },
    ],
  },
  'ifosfamide': {
    rows: [
      { concentration: '0.6 mg/mL (combined test)', diluent: 'NS/D5W', refrigerated: '3 d', roomTemp: '24 h' },
      { concentration: '40 mg/mL (combined test)', diluent: 'NS/D5W', refrigerated: '3 d', roomTemp: '24 h' },
      { concentration: '0.6 mg/mL (separate test)', diluent: 'D5W', refrigerated: '—', roomTemp: '7 d' },
      { concentration: '40 mg/mL (separate test)', diluent: 'D5W', refrigerated: '—', roomTemp: '3 d' },
    ],
  },
  'imipenem': {
    rows: [
      { concentration: '5+5 mg/mL', diluent: 'NS', refrigerated: '3 d', roomTemp: '24 h' },
    ],
    note: 'PDF: imipenem + cilastatin (Primaxin).',
  },
  'ketamine': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '2 d' },
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '2 d' },
    ],
  },
  'levobupivacaine': {
    rows: [
      { concentration: '0.125%', diluent: 'NS', refrigerated: '—', roomTemp: '30 d' },
      { concentration: '0.750%', diluent: 'NS', refrigerated: '—', roomTemp: '30 d' },
    ],
  },
  'levofloxacin': {
    rows: [
      { concentration: '0.5 mg/mL', diluent: 'NS/D5W', refrigerated: '14 d', roomTemp: '7 d' },
      { concentration: '5 mg/mL', diluent: 'NS/D5W', refrigerated: '14 d', roomTemp: '7 d' },
    ],
  },
  'lincomycin': {
    rows: [
      { concentration: '1.2 mg/mL', diluent: 'NS', refrigerated: '1 d', roomTemp: '1 d' },
      { concentration: '10 mg/mL', diluent: 'NS/D5W', refrigerated: '1 d', roomTemp: '1 d' },
    ],
  },
  'lidocaine': {
    rows: [
      { concentration: '0.50%', diluent: 'NS', refrigerated: '—', roomTemp: '30 d' },
      { concentration: '2%', diluent: 'NS', refrigerated: '—', roomTemp: '30 d' },
    ],
  },
  'linezolid': {
    rows: [
      { concentration: '0.15 mg/mL', diluent: 'NS', refrigerated: '13 d', roomTemp: '24 h' },
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '13 d', roomTemp: '24 h' },
    ],
  },
  'magnesium sulfate': {
    rows: [
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '29 d', roomTemp: '24 h' },
    ],
  },
  'meropenem': {
    rows: [
      { concentration: '5 mg/mL (separate test)', diluent: 'NS', refrigerated: '10 d', roomTemp: '24 h' },
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '5 d', roomTemp: '21 h' },
      { concentration: '20 mg/mL (separate test)', diluent: 'NS', refrigerated: '4 d', roomTemp: '24 h' },
      { concentration: '2.5 mg/mL (combined test)', diluent: 'NS', refrigerated: '24 h', roomTemp: '6 h' },
      { concentration: '20 mg/mL (combined test)', diluent: 'NS', refrigerated: '24 h', roomTemp: '6 h' },
    ],
  },
  'methotrexate': {
    rows: [
      { concentration: '0.3 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '7 d' },
      { concentration: '25 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '7 d' },
    ],
  },
  'methylprednisolone': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '2 h' },
    ],
  },
  'metoclopramide': {
    rows: [
      { concentration: '5 mg/mL', diluent: 'NS', refrigerated: '2 d', roomTemp: '2 d' },
    ],
  },
  'metronidazole': {
    rows: [
      { concentration: '5 mg/mL', diluent: 'RTU', refrigerated: '10 d', roomTemp: '24 h' },
    ],
  },
  'micafungin': {
    rows: [
      { concentration: '0.5 mg/mL', diluent: 'NS', refrigerated: '4 d', roomTemp: '24 h' },
      { concentration: '1.5 mg/mL', diluent: 'NS', refrigerated: '9 d', roomTemp: '—' },
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '4 d', roomTemp: '24 h' },
    ],
  },
  'morphine': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '7 d' },
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '7 d' },
    ],
  },
  'nafcillin': {
    rows: [
      { concentration: '5 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '30 h' },
      { concentration: '50 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '48 h' },
    ],
  },
  'nefopam': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '1 d', roomTemp: '1 d' },
    ],
  },
  'ofloxacin': {
    rows: [
      { concentration: '0.4 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '7 d' },
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '7 d' },
    ],
  },
  'ondansetron': {
    rows: [
      { concentration: '0.03 mg/mL', diluent: 'NS/D5W', refrigerated: '21 d', roomTemp: '7 d' },
      { concentration: '0.7 mg/mL', diluent: 'NS/D5W', refrigerated: '10 d', roomTemp: '4 d' },
    ],
  },
  'oxacillin': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '8 d', roomTemp: '4 d' },
      { concentration: '100 mg/mL', diluent: 'NS', refrigerated: '8 d', roomTemp: '4 d' },
    ],
  },
  'paclitaxel': {
    rows: [
      { concentration: '0.3 mg/mL', diluent: 'NS/D5W', refrigerated: '7 d', roomTemp: '24 h' },
      { concentration: '1.2 mg/mL', diluent: 'NS/D5W', refrigerated: '7 d', roomTemp: '24 h' },
    ],
  },
  'pamidronate': {
    rows: [
      { concentration: '30 µg/mL', diluent: 'NS', refrigerated: '27 d', roomTemp: '2 d' },
      { concentration: '0.4 mg/mL', diluent: 'NS', refrigerated: '27 d', roomTemp: '2 d' },
      { concentration: '30 µg/mL', diluent: 'D5W', refrigerated: '27 d', roomTemp: '2 d' },
      { concentration: '30 µg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '29 d' },
    ],
  },
  'penicillin g': {
    rows: [
      { concentration: '20,000 units/mL (K)', diluent: 'NS', refrigerated: '4 d', roomTemp: '24 h' },
      { concentration: '2,000 units/mL (Na)', diluent: 'NS', refrigerated: '3 d', roomTemp: '2 h' },
      { concentration: '100,000 units/mL (Na, combined test)', diluent: 'NS', refrigerated: '1 d', roomTemp: '2 h' },
      { concentration: '100,000 units/mL (Na, separate test)', diluent: 'NS', refrigerated: '—', roomTemp: '6 h' },
    ],
  },
  'piperacillin': {
    rows: [
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '3 d' },
      { concentration: '80 mg/mL', diluent: 'NS', refrigerated: '5 d', roomTemp: '24 h' },
    ],
  },
  'piperacillin/tazobactam': {
    rows: [
      { concentration: '10+1.25 mg/mL (combined test)', diluent: 'NS', refrigerated: '21 d', roomTemp: '48 h' },
      { concentration: '80+10 mg/mL (combined test)', diluent: 'NS', refrigerated: '21 d', roomTemp: '48 h' },
      { concentration: '10+1.25 mg/mL (separate test)', diluent: 'NS', refrigerated: '28 d', roomTemp: '24 h' },
      { concentration: '80+10 mg/mL (separate test)', diluent: 'NS', refrigerated: '28 d', roomTemp: '24 h' },
    ],
  },
  'ranitidine': {
    rows: [
      { concentration: '0.5 mg/mL', diluent: 'NS', refrigerated: '21 d', roomTemp: '2 d' },
      { concentration: '2 mg/mL', diluent: 'NS', refrigerated: '21 d', roomTemp: '7 d' },
      { concentration: '0.5 mg/mL', diluent: 'D5W', refrigerated: '21 d', roomTemp: '2 d' },
      { concentration: '2 mg/mL', diluent: 'D5W', refrigerated: '21 d', roomTemp: '7 d' },
    ],
  },
  'rifampin': {
    rows: [
      { concentration: '0.5 mg/mL', diluent: 'NS', refrigerated: '6 d', roomTemp: '24 h' },
      { concentration: '3 mg/mL', diluent: 'NS', refrigerated: '6 d', roomTemp: '24 h' },
    ],
    note: 'PDF lists as rifampicin.',
  },
  'ropivacaine': {
    rows: [
      { concentration: '0.2 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '5 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '0.10%', diluent: 'NS', refrigerated: '—', roomTemp: '30 d' },
      { concentration: '0.75%', diluent: 'NS', refrigerated: '—', roomTemp: '30 d' },
    ],
  },
  'teicoplanin': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
      { concentration: '20 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '24 h' },
    ],
  },
  'temocillin': {
    rows: [
      { concentration: '10 mg/mL (combined test)', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '20 mg/mL (combined test)', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '10 mg/mL (separate test)', diluent: 'NS', refrigerated: '—', roomTemp: '24 h' },
      { concentration: '80 mg/mL (separate test)', diluent: 'NS', refrigerated: '—', roomTemp: '24 h' },
    ],
  },
  'ticarcillin-clavulanate': {
    rows: [
      { concentration: '31 mg/mL', diluent: 'NS', refrigerated: '7 d', roomTemp: '1 d' },
    ],
  },
  'tigecycline': {
    rows: [
      { concentration: '0.5 mg/mL', diluent: 'NS', refrigerated: '2 d', roomTemp: '24 h' },
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '2 d', roomTemp: '24 h' },
    ],
  },
  'tobramycin': {
    rows: [
      { concentration: '0.2 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
      { concentration: '10 mg/mL', diluent: 'NS', refrigerated: '14 d', roomTemp: '24 h' },
    ],
  },
  'vancomycin': {
    rows: [
      { concentration: '4 mg/mL (combined test)', diluent: 'NS/D5W', refrigerated: '21 d', roomTemp: '4 d' },
      { concentration: '15 mg/mL (combined test)', diluent: 'NS/D5W', refrigerated: '14 d', roomTemp: '2 d' },
      { concentration: '15 mg/mL (separate test)', diluent: 'NS', refrigerated: '30 d', roomTemp: '2 d' },
    ],
  },
  'vincristine': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '—', roomTemp: '21 d' },
    ],
  },
  'iron sucrose': {
    rows: [
      { concentration: '1 mg/mL', diluent: 'NS', refrigerated: '24 h', roomTemp: '24 h' },
    ],
    note: 'PDF lists as Venofer (iron(III) hydroxide sucrose).',
  },
};

// Resolve elastomeric (SMARTeZ/EPIC) stability by generic name (case-insensitive;
// tolerates "/" vs "-" in combination names).
export function getElastomericStability(genericName: string): ElastomericStability | null {
  if (!genericName) return null;
  const k = genericName.trim().toLowerCase();
  return (
    MCK_ELASTOMERIC[k] ||
    MCK_ELASTOMERIC[k.replace(/\s*\/\s*/g, '-')] ||
    MCK_ELASTOMERIC[k.replace(/\s*-\s*/g, '/')] ||
    null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPAT container stability — consolidated view across the container types that
// matter for home infusion (elastomeric pump, syringe, IV bag) at room temp and
// refrigerated. Elastomeric values prefer the McKesson SMARTeZ/EPIC dataset;
// syringe and bag values come from the ASHP per-container tables. Used by the
// IDSA OPAT Advisor to attach an authoritative stability panel to each answer.
// ─────────────────────────────────────────────────────────────────────────────
export interface OpatStabilityRow {
  container: string;
  concentration: string;
  diluent: string;
  roomTemp: string;
  refrigerated: string;
  source: 'McKesson SMARTeZ/EPIC' | 'ASHP ESPD 6th ed.';
}

export function getOpatStabilityRows(genericName: string): OpatStabilityRow[] {
  const rows: OpatStabilityRow[] = [];
  const elasto = getElastomericStability(genericName);
  const bud = getBudStability(genericName);

  // Elastomeric pump — McKesson SMARTeZ/EPIC preferred; fall back to ASHP row.
  if (elasto) {
    for (const r of elasto.rows) {
      rows.push({
        container: 'Elastomeric pump (SMARTeZ/EPIC)',
        concentration: r.concentration, diluent: r.diluent,
        roomTemp: r.roomTemp, refrigerated: r.refrigerated,
        source: 'McKesson SMARTeZ/EPIC',
      });
    }
  } else if (bud) {
    for (const c of bud.containers.filter(c => /elastomeric/i.test(c.container))) {
      rows.push({
        container: c.container, concentration: c.concentration, diluent: c.diluent,
        roomTemp: c.roomTemp, refrigerated: c.refrigerated, source: 'ASHP ESPD 6th ed.',
      });
    }
  }
  // Syringe and IV bag — ASHP per-container tables.
  if (bud) {
    for (const c of bud.containers.filter(c => /syringe/i.test(c.container))) {
      rows.push({
        container: c.container, concentration: c.concentration, diluent: c.diluent,
        roomTemp: c.roomTemp, refrigerated: c.refrigerated, source: 'ASHP ESPD 6th ed.',
      });
    }
    for (const c of bud.containers.filter(c => /bag/i.test(c.container))) {
      rows.push({
        container: c.container, concentration: c.concentration, diluent: c.diluent,
        roomTemp: c.roomTemp, refrigerated: c.refrigerated, source: 'ASHP ESPD 6th ed.',
      });
    }
  }
  return rows;
}

// Shorthand / brand aliases → canonical stability key, for detecting drugs named
// in the advisor's free-text recommendation.
const OPAT_ALIASES: Record<string, string> = {
  'pip-tazo': 'piperacillin/tazobactam', 'pip/tazo': 'piperacillin/tazobactam',
  'pip tazo': 'piperacillin/tazobactam', 'zosyn': 'piperacillin/tazobactam',
  'tazocin': 'piperacillin/tazobactam',
  'unasyn': 'ampicillin-sulbactam',
  'zerbaxa': 'ceftolozane-tazobactam',
  'augmentin': 'amoxicillin-clavulanate', 'co-amoxiclav': 'amoxicillin-clavulanate',
  'co amoxiclav': 'amoxicillin-clavulanate',
  'pen g': 'penicillin g', 'benzylpenicillin': 'penicillin g',
  'leucovorin': 'folinic acid',
  'rifampicin': 'rifampin',
};

export interface OpatDrugStability {
  name: string;
  rows: OpatStabilityRow[];
}

function opatDisplayName(key: string): string {
  return key.replace(/(^|[\/\- ])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// Detect drugs named in free text that have OPAT stability data, in order of
// first appearance. Longer names are matched (and masked) first so a combination
// like "piperacillin/tazobactam" is not also double-counted as "piperacillin".
export function detectOpatStability(text: string, max = 4): OpatDrugStability[] {
  if (!text) return [];
  let mask = text.toLowerCase();

  const keys = new Set<string>([...Object.keys(BUD_STABILITY), ...Object.keys(MCK_ELASTOMERIC)]);
  const patterns: { pat: string; key: string }[] = [];
  for (const k of keys) {
    patterns.push({ pat: k, key: k });
    const dash = k.replace(/\//g, '-'); if (dash !== k) patterns.push({ pat: dash, key: k });
    const slash = k.replace(/-/g, '/'); if (slash !== k) patterns.push({ pat: slash, key: k });
  }
  for (const [alias, key] of Object.entries(OPAT_ALIASES)) patterns.push({ pat: alias, key });
  patterns.sort((a, b) => b.pat.length - a.pat.length);

  const seen = new Set<string>();
  const found: { key: string; idx: number }[] = [];
  for (const { pat, key } of patterns) {
    let i = mask.indexOf(pat);
    while (i !== -1) {
      if (!seen.has(key)) { seen.add(key); found.push({ key, idx: i }); }
      mask = mask.slice(0, i) + ' '.repeat(pat.length) + mask.slice(i + pat.length);
      i = mask.indexOf(pat);
    }
  }
  found.sort((a, b) => a.idx - b.idx);

  const out: OpatDrugStability[] = [];
  for (const h of found) {
    const rows = getOpatStabilityRows(h.key);
    if (rows.length) out.push({ name: opatDisplayName(h.key), rows });
    if (out.length >= max) break;
  }
  return out;
}
