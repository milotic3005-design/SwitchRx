// ─────────────────────────────────────────────────────────────────────────────
// Mixing Guide — curated preparation technique notes.
//
// The Mixing Guide renders every drug from the core DRUG_DB fields
// (reconstitution, dilution, infusion, BUD, storage). This file layers on the
// hands-on technique that those terse fields can't carry — needle gauge,
// swirl-don't-shake, filter pore size, premedication, intact-vial storage
// exceptions — for the high-volume infusion-center drugs. Every line is taken
// from the US package insert (PI) named in `source`; keep it that way.
//
// Keyed by lowercased generic name (matches Drug.genericName).
// ─────────────────────────────────────────────────────────────────────────────

export interface MixingNotes {
  reconstitute?: string[];
  inspect?: string;
  dilute?: string[];
  administer?: string[];
  premed?: string;
  storageIntact?: string[];
  source: string;
}

export const MIXING_NOTES: Record<string, MixingNotes> = {
  'infliximab': {
    reconstitute: [
      'Use a 21-gauge or smaller needle; aim the SWFI stream at the glass wall of the vial.',
      'Swirl gently by rotating the vial — do not shake. Foaming is normal.',
      'Let stand 5 minutes before diluting.',
    ],
    inspect: 'Colorless to light yellow and opalescent; a few translucent protein particles are acceptable. Discard if opaque particles or discoloration.',
    dilute: [
      'From a 250 mL NS bag, withdraw a volume equal to the total reconstituted dose.',
      'Add infliximab slowly, then mix gently.',
    ],
    administer: [
      'Infuse over at least 2 hours.',
      'Use an in-line, sterile, non-pyrogenic, low-protein-binding filter (pore size ≤ 1.2 µm).',
      'Do not infuse in the same line with other agents. Discard any unused portion.',
    ],
    storageIntact: [
      'May be kept once at up to 30 °C for ≤ 6 months (not past original expiry) — write the new expiry on the carton. Cannot be returned to the refrigerator.',
    ],
    source: 'Remicade (infliximab) US PI',
  },

  'vedolizumab': {
    reconstitute: [
      'Use a 21–25 gauge needle; aim the SWFI stream at the vial wall.',
      'Swirl gently for at least 15 seconds — do not shake or invert.',
      'Let stand up to 20 minutes at room temperature for foam to settle (another 10 min if needed; discard if not dissolved by 30 min).',
    ],
    inspect: 'Clear to opalescent, colorless to light brownish-yellow, free of visible particles.',
    dilute: [
      'Gently invert the vial 3 times, then withdraw 5 mL (300 mg).',
      'Add to 250 mL NS or LR and mix gently.',
      'Do not add other medications to the bag or infusion set.',
    ],
    administer: [
      'Infuse over 30 minutes.',
      'After the infusion, flush the line with 30 mL NS or LR.',
    ],
    storageIntact: ['Keep in the original carton to protect from light.'],
    source: 'Entyvio (vedolizumab) US PI',
  },

  'rituximab': {
    dilute: [
      'Withdraw the dose and dilute to 1–4 mg/mL in NS or D5W.',
      'Gently invert the bag to mix — do not shake.',
      'Do not mix or dilute with other drugs.',
    ],
    administer: [
      'Never give as an IV push or bolus.',
      'Titrate the rate by infusion number (see ladder below).',
    ],
    premed: 'Acetaminophen + an antihistamine before each infusion. Add a glucocorticoid (e.g., methylprednisolone 100 mg IV 30 min prior) for RA, GPA/MPA, and PV.',
    storageIntact: ['Keep in the carton to protect from light. Do not freeze or shake.'],
    source: 'Rituxan (rituximab) US PI',
  },

  'ocrelizumab': {
    dilute: [
      '300 mg (10 mL) into 250 mL NS, or 600 mg (20 mL) into 500 mL NS → ~1.2 mg/mL.',
      'NS only — do not use other diluents.',
      'Let the bag reach room temperature before starting.',
    ],
    administer: [
      'Give through a dedicated line with a 0.2 or 0.22 µm in-line filter.',
      'Titrate per dose schedule (see ladder below).',
    ],
    premed: 'Methylprednisolone 100 mg IV ~30 min before, plus an antihistamine 30–60 min before each infusion. Consider an antipyretic.',
    storageIntact: ['Keep in the carton to protect from light. Do not freeze or shake.'],
    source: 'Ocrevus (ocrelizumab) US PI',
  },

  'natalizumab': {
    dilute: [
      'Withdraw 15 mL (300 mg) and inject into 100 mL NS — no other diluents.',
      'Gently invert to mix — do not shake.',
      'If not infused immediately, refrigerate and use within 8 hours; warm to room temperature first.',
    ],
    administer: [
      'Infuse over about 1 hour (~5 mg/min). Never IV push or bolus.',
      'Flush the line with NS after the infusion.',
      'REMS: confirm TOUCH Prescribing Program authorization before every infusion.',
    ],
    storageIntact: ['Protect from light. Do not freeze or shake.'],
    source: 'Tysabri (natalizumab) US PI',
  },

  'tocilizumab': {
    dilute: [
      'From a 100 mL NS bag (50 mL if < 30 kg), withdraw a volume equal to the dose volume.',
      'Add the drug slowly and mix by gentle inversion to avoid foaming.',
      'Let the bag reach room temperature before infusing.',
    ],
    administer: [
      'Infuse over 60 minutes. Never IV push or bolus.',
      'Do not infuse in the same line with other drugs.',
    ],
    storageIntact: ['Protect from light. Do not freeze.'],
    source: 'Actemra (tocilizumab) US PI',
  },

  'immune globulin iv': {
    dilute: [
      'Usually infused undiluted.',
      'If dilution is needed, many 10% liquids (e.g., Gammagard Liquid, Gamunex-C) allow D5W only — do not dilute with NS. Confirm in the specific product PI.',
      'Do not mix with other drugs.',
    ],
    inspect: 'Appearance is brand-specific; do not use if cloudy or if particles are present.',
    administer: [
      'Let refrigerated product reach room temperature before infusing.',
      'Use a dedicated line. Start slow and titrate per product PI (Clinical Calculators → IVIG Infusion Rate).',
      'Boxed warning: thrombosis and renal dysfunction — hydrate and use the minimum practical rate in at-risk patients.',
    ],
    storageIntact: ['Some brands are refrigerated, others room-temperature stable. Do not freeze.'],
    source: 'Gammagard Liquid / Gamunex-C US PIs (IVIG class)',
  },

  'vancomycin': {
    reconstitute: ['500 mg vial + 10 mL SWFI, or 1 g vial + 20 mL SWFI → 50 mg/mL.'],
    dilute: [
      'Dilute to ≤ 5 mg/mL in NS or D5W.',
      'Up to 10 mg/mL may be used if fluid-restricted (higher infusion-reaction risk).',
    ],
    administer: [
      'Infuse at ≤ 10 mg/min or over ≥ 60 min, whichever is longer — faster rates raise the risk of vancomycin infusion reaction (flushing, hypotension).',
    ],
    source: 'Vancomycin hydrochloride for injection US PI',
  },
};

export function getMixingNotes(genericName: string): MixingNotes | null {
  if (!genericName) return null;
  return MIXING_NOTES[genericName.trim().toLowerCase()] ?? null;
}
