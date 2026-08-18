// ─────────────────────────────────────────────────────────────────────────────
// Diluent volume / bag-preparation technique.
//
// The bedside question this answers: when I add the drug to the diluent bag, do
// I have to pull an equal volume OUT of the bag first, or can the drug volume
// just go in on top of a full bag?
//
// Two different things drive the answer, and conflating them is the usual source
// of error:
//
//   1. The label fixes a FINAL VOLUME ("dilute to a final volume of 100 mL") and
//      states no acceptable concentration window. The only way to land on that
//      number is to withdraw a volume of diluent equal to the drug volume before
//      adding the drug, and overfilling puts the bag out of spec. Actemra,
//      Simponi Aria, Orencia, Benlysta, Stelara IV, Saphnelo and Darzalex read
//      this way.
//
//   2. The label fixes a FINAL CONCENTRATION RANGE ("dilute to 1–4 mg/mL"), or
//      simply says to inject the drug into an N mL bag. Final volume is then
//      bag + drug, and the extra few mL are clinically irrelevant as long as the
//      concentration stays in range. Tysabri, Krystexxa, Herceptin, Ocrevus and
//      Keytruda read this way.
//
// A label can carry BOTH, and then the RANGE governs: Remicade directs
// withdrawal of an equal volume from the 250 mL bag *and* states an acceptable
// 0.4–4 mg/mL range. Adding directly to a full bag holds that range across the
// adult dose span (1200 mg still only reaches 3.2 mg/mL), so it is acceptable
// practice and the entry is classified `concentration-driven`. What separates it
// from Actemra is not the imperative sentence — both say "withdraw" — but
// whether the label gives a window that direct addition stays inside.
// `labelDirectsWithdrawal` records the wording so the UI never contradicts the
// label silently.
//
// Every entry quotes the preparation sentence verbatim from the manufacturer's
// US prescribing information so the technique can be checked at a glance rather
// than taken on trust. Labels are revised — `sourceUrl` points at the current
// label, and the UI tells the user to confirm against it.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchWithTimeout } from '@/lib/pharmacy-lookup/fetch-with-timeout';

export type PrepMethod =
  /** Label directs withdrawing a volume of diluent equal to the drug volume. Final volume is fixed. */
  | 'remove-from-bag'
  /** Drug is added to a full bag. Final volume = bag + drug. */
  | 'add-to-bag'
  /** Label specifies a target final concentration rather than a fixed volume; either technique lands in range. */
  | 'concentration-driven'
  /** Neither model applies — 1:1 admixture, undiluted push, drug-specific container. */
  | 'special';

export interface ConcentrationRange {
  min: number;
  max: number;
  unit: 'mg/mL';
}

export interface DiluentVolumeEntry {
  id: string;
  generic: string;
  brand: string;
  /** Biosimilars / alternate brands that search should match. Prep is verified for the reference product only. */
  biosimilars?: string[];
  method: PrepMethod;
  /** Bag volumes the label names, mL. First entry is the adult default. */
  bagSizes: number[];
  /** Acceptable diluents, in label order. */
  diluents: string[];
  /** Concentration of the solution actually drawn into the syringe (after reconstitution, if applicable), mg/mL. */
  vialConcentration?: number;
  /** True when the drug is supplied as a lyophilised powder needing reconstitution first. */
  reconstituted?: boolean;
  concentrationRange?: ConcentrationRange;
  /**
   * Set on `concentration-driven` entries whose label *also* describes withdrawing
   * an equal volume. The concentration range is what governs acceptability, so
   * direct addition is fine, but the UI still surfaces the label's own wording
   * rather than quietly contradicting it.
   */
  labelDirectsWithdrawal?: boolean;
  /** Verbatim preparation sentence from the US PI. */
  labelQuote: string;
  /** Why this one trips people up. */
  practicePoint?: string;
  pediatricNote?: string;
  sourceLabel: string;
  sourceUrl: string;
}

const dailyMed = (setid: string) =>
  `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}`;
const dailyMedSearch = (q: string) =>
  `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(q)}`;

// ── Curated dataset ───────────────────────────────────────────────────────────
export const DILUENT_VOLUME_DB: DiluentVolumeEntry[] = [
  // ═══════════ Label fixes the final volume — withdraw first ═══════════
  {
    id: 'tocilizumab',
    generic: 'Tocilizumab',
    brand: 'Actemra',
    biosimilars: ['Tofidence', 'Tyenne'],
    method: 'remove-from-bag',
    bagSizes: [100, 50],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 20,
    labelQuote:
      'From a 100 mL infusion bag or bottle, withdraw a volume of 0.9% Sodium Chloride Injection, USP, equal to the volume of the ACTEMRA solution required for the patient\'s dose. Slowly add ACTEMRA for intravenous infusion from each vial into the infusion bag or bottle.',
    practicePoint:
      'The final bag must read 100 mL. Adding the drug on top of a full bag overfills it and drops the concentration below what the label describes.',
    pediatricNote:
      'Patients under 30 kg use a 50 mL bag; at or above 30 kg use 100 mL. The withdraw-first step applies to both.',
    sourceLabel: 'ACTEMRA US PI, §2.4 Preparation for IV infusion',
    sourceUrl: dailyMed('2e5365ff-cb2a-4b16-b2c7-e35c6bf2de13'),
  },
  {
    id: 'golimumab-iv',
    generic: 'Golimumab (IV)',
    brand: 'Simponi Aria',
    method: 'remove-from-bag',
    bagSizes: [100],
    diluents: ['0.9% Sodium Chloride Injection, USP', '0.45% Sodium Chloride Injection, USP'],
    vialConcentration: 12.5,
    labelQuote:
      'Dilute the total volume of the SIMPONI ARIA solution with 0.9% Sodium Chloride Injection, USP to a final volume of 100 mL. For example, this can be accomplished by withdrawing a volume of the 0.9% Sodium Chloride Injection, USP from the 100-mL infusion bag or bottle equal to the total volume of SIMPONI ARIA.',
    practicePoint:
      'The label states a final volume of 100 mL as the requirement and withdrawal as the means of getting there.',
    sourceLabel: 'SIMPONI ARIA US PI, §2.3 Preparation and administration',
    sourceUrl: dailyMed('9e260a47-55af-4c92-8d88-a86ccc767fff'),
  },
  {
    id: 'ustekinumab-iv',
    generic: 'Ustekinumab (IV induction)',
    brand: 'Stelara',
    biosimilars: ['Wezlana', 'Selarsdi', 'Pyzchiva', 'Otulfi', 'Steqeyma', 'Imuldosa', 'Yesintek'],
    method: 'remove-from-bag',
    bagSizes: [250],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 5,
    labelQuote:
      'Withdraw, and then discard a volume of the 0.9% Sodium Chloride Injection, USP equal to the volume of STELARA to be added (discard 26 mL sodium chloride for one vial, 52 mL for two vials, 78 mL for three vials, 104 mL for four vials).',
    practicePoint:
      'Discard volume is 26 mL per vial — the whole vial goes in, so the arithmetic is per-vial rather than per-dose. Final bag reads 250 mL.',
    sourceLabel: 'STELARA US PI, §2.1 IV induction dosing preparation',
    sourceUrl: dailyMedSearch('STELARA ustekinumab'),
  },
  {
    id: 'abatacept-iv',
    generic: 'Abatacept (IV)',
    brand: 'Orencia',
    method: 'remove-from-bag',
    bagSizes: [100],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 25,
    reconstituted: true,
    concentrationRange: { min: 0, max: 10, unit: 'mg/mL' },
    labelQuote:
      'From a 100 mL infusion bag or bottle of 0.9% Sodium Chloride Injection, USP, withdraw a volume equal to the volume of the reconstituted ORENCIA solution required for the patient\'s dose. Slowly add the reconstituted ORENCIA solution(s) into the infusion bag or bottle.',
    practicePoint:
      'Reconstitute each 250 mg vial with 10 mL SWFI using the silicone-free syringe supplied — silicone from a standard syringe causes visible aggregates. Final concentration must not exceed 10 mg/mL.',
    sourceLabel: 'ORENCIA US PI, §2.6 Preparation and administration',
    sourceUrl: 'https://packageinserts.bms.com/pi/pi_orencia.pdf',
  },
  {
    id: 'belimumab-iv',
    generic: 'Belimumab (IV)',
    brand: 'Benlysta',
    method: 'remove-from-bag',
    bagSizes: [250, 100],
    diluents: [
      '0.9% Sodium Chloride Injection, USP',
      '0.45% Sodium Chloride Injection, USP',
      'Lactated Ringer\'s Injection, USP',
    ],
    vialConcentration: 80,
    reconstituted: true,
    labelQuote:
      'From a 250-mL (or 100-mL) infusion bag or bottle of normal saline, half-normal saline, or Lactated Ringer\'s Injection, withdraw and discard a volume equal to the volume of the reconstituted solution of BENLYSTA required for the patient\'s dose.',
    practicePoint:
      'Dextrose is incompatible — BENLYSTA must not be diluted in D5W. Reconstituted concentration is 80 mg/mL, so dose volumes are small and easy to under-withdraw.',
    sourceLabel: 'BENLYSTA US PI, §2.4 Preparation and administration',
    sourceUrl: dailyMed('2fa3c528-1777-4628-8a55-a69dae2381a3'),
  },
  {
    id: 'anifrolumab',
    generic: 'Anifrolumab-fnia',
    brand: 'Saphnelo',
    method: 'remove-from-bag',
    bagSizes: [100],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 150,
    labelQuote:
      'Withdraw and discard 2 mL of solution from a 100-mL 0.9% Sodium Chloride Injection, USP infusion bag, then withdraw 2 mL from the SAPHNELO vial and add to the infusion bag.',
    practicePoint:
      'Fixed 300 mg dose in a 2 mL vial — the discard volume is always 2 mL, no calculation required.',
    sourceLabel: 'SAPHNELO US PI, §2.2 Preparation',
    sourceUrl: dailyMed('d6203302-2128-41a7-b0b4-0e6c0704d4dc'),
  },
  {
    id: 'daratumumab-iv',
    generic: 'Daratumumab (IV)',
    brand: 'Darzalex',
    method: 'remove-from-bag',
    bagSizes: [500, 1000],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 20,
    labelQuote:
      'Using aseptic technique, remove a volume of 0.9% Sodium Chloride Injection, USP from the infusion bag/container that is equal to the required volume of DARZALEX solution.',
    practicePoint:
      'Bag size follows the infusion number, not the dose: 1000 mL for the first infusion, 500 mL for subsequent infusions. Darzalex Faspro (SC) is not diluted at all — confirm which product is ordered.',
    sourceLabel: 'DARZALEX US PI, §2.6 Preparation for administration',
    sourceUrl: dailyMed('a4d0efe9-5e54-467e-9eb4-56fa7d53b60b'),
  },

  // ═══════════ Drug added to a full bag ═══════════
  {
    id: 'vedolizumab',
    generic: 'Vedolizumab',
    brand: 'Entyvio',
    method: 'add-to-bag',
    bagSizes: [250],
    diluents: ['0.9% Sodium Chloride Injection, USP', 'Lactated Ringer\'s Injection, USP'],
    vialConcentration: 60,
    reconstituted: true,
    labelQuote:
      'Add the 5 mL (300 mg) of reconstituted ENTYVIO solution to 250 mL of 0.9% Sodium Chloride Injection, or Lactated Ringer\'s Injection, and gently mix the infusion bag.',
    practicePoint:
      'The "withdraw 5 mL" step in the label refers to drawing the reconstituted drug out of the vial, not to removing saline from the bag. Final volume is 255 mL.',
    sourceLabel: 'ENTYVIO US PI, §2.3 Reconstitution and preparation',
    sourceUrl: dailyMed('6e94621c-1a95-4af9-98d1-52b9e6f1949c'),
  },
  {
    id: 'natalizumab',
    generic: 'Natalizumab',
    brand: 'Tysabri',
    biosimilars: ['Tyruko'],
    method: 'add-to-bag',
    bagSizes: [100],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 20,
    labelQuote:
      'Inject TYSABRI into 100 mL of 0.9% Sodium Chloride Injection, USP. No other intravenous diluents may be used to prepare the TYSABRI diluted solution.',
    practicePoint:
      'The label\'s own stated final concentration of 2.6 mg/mL confirms the drug volume is additive: 300 mg ÷ 115 mL = 2.6 mg/mL. Withdrawing 15 mL first would give 3.0 mg/mL.',
    sourceLabel: 'TYSABRI US PI, §2.3 Dilution instructions',
    sourceUrl: dailyMed('c5fdde91-1989-4dd2-9129-4f3323ea2962'),
  },
  {
    id: 'ocrelizumab',
    generic: 'Ocrelizumab',
    brand: 'Ocrevus',
    method: 'add-to-bag',
    bagSizes: [250, 500],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 30,
    labelQuote:
      'Withdraw 10 mL (300 mg) of OCREVUS and inject into 250 mL of 0.9% sodium chloride injection to achieve the final concentration of 1.2 mg/mL. Do not use other diluents to dilute OCREVUS since their use has not been tested.',
    practicePoint:
      'The 600 mg dose goes into 500 mL (20 mL of drug), keeping the same ~1.2 mg/mL. Ocrevus Zunovo (SC, with hyaluronidase) is a different product and is not diluted.',
    sourceLabel: 'OCREVUS US PI, §2.4 Dilution and administration',
    sourceUrl: 'https://www.gene.com/download/pdf/ocrevus_prescribing.pdf',
  },
  {
    id: 'pegloticase',
    generic: 'Pegloticase',
    brand: 'Krystexxa',
    method: 'add-to-bag',
    bagSizes: [250],
    diluents: ['0.9% Sodium Chloride Injection, USP', '0.45% Sodium Chloride Injection, USP'],
    vialConcentration: 8,
    labelQuote:
      'Withdraw 1 mL of KRYSTEXXA from the vial into a sterile syringe. Discard any unused portion of product remaining in the vial. Inject into a single 250 mL bag of 0.45% or 0.9% Sodium Chloride Injection, USP for i.v. infusion.',
    practicePoint:
      'Fixed 8 mg dose in 1 mL — the added volume is trivial either way. Do not shake; use within 4 hours of dilution.',
    sourceLabel: 'KRYSTEXXA US PI, §2.2 Dose preparation',
    sourceUrl: dailyMed('5f4574d1-401f-4647-83e5-28c0f4a122a7'),
  },
  {
    id: 'trastuzumab',
    generic: 'Trastuzumab',
    brand: 'Herceptin',
    biosimilars: ['Kanjinti', 'Ogivri', 'Herzuma', 'Ontruzant', 'Trazimera'],
    method: 'add-to-bag',
    bagSizes: [250],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 21,
    reconstituted: true,
    labelQuote:
      'Withdraw the calculated amount from the vial using a sterile needle and syringe and add it to an infusion bag containing 250 mL of 0.9% Sodium Chloride Injection, USP. DO NOT USE DEXTROSE (5%) SOLUTION.',
    practicePoint:
      'Dextrose is contraindicated as a diluent. Herceptin Hylecta (SC) is a different product with no dilution step.',
    sourceLabel: 'HERCEPTIN US PI, §2.4 Preparation for administration',
    sourceUrl: dailyMedSearch('HERCEPTIN trastuzumab'),
  },

  // ═══════════ Concentration-driven — either technique is acceptable ═══════════
  {
    id: 'infliximab',
    generic: 'Infliximab',
    brand: 'Remicade',
    biosimilars: ['Inflectra', 'Renflexis', 'Avsola', 'Ixifi'],
    method: 'concentration-driven',
    labelDirectsWithdrawal: true,
    // 250 mL is the label figure; 500 mL is the practice bag for large doses,
    // where 100 mL+ of drug would otherwise be 40% of a 250 mL bag. Both land
    // inside the label's 0.4–4 mg/mL window. See BAG_STEP_UP_THRESHOLD_ML.
    bagSizes: [250, 500],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 10,
    reconstituted: true,
    concentrationRange: { min: 0.4, max: 4, unit: 'mg/mL' },
    labelQuote:
      'Dilute the total volume of the reconstituted REMICADE solution dose to 250 mL with sterile 0.9% Sodium Chloride Injection, USP, by withdrawing a volume from the 0.9% Sodium Chloride Injection, USP, 250 mL bottle or bag equal to the total volume of reconstituted REMICADE required for a dose. The resulting infusion concentration should range between 0.4 mg/mL and 4 mg/mL.',
    practicePoint:
      'Acceptability is set by the 0.4–4 mg/mL window, not by the 250 mL figure. Adding the drug straight to a full bag holds that window across the whole adult dose range — a 1200 mg dose still only reaches 3.2 mg/mL — so direct addition is fine and is what most sites do. At 1000 mg and above the drug volume itself reaches 100 mL, and the bag steps up to 500 mL so it is not 40% of the bag.',
    pediatricNote:
      'The floor is the one to watch: below roughly 105 mg, adding to a full 250 mL bag drops under 0.4 mg/mL. Small paediatric doses need a smaller bag. The volume check flags this automatically.',
    sourceLabel: 'REMICADE US PI, §2.7 Preparation and administration',
    sourceUrl: dailyMed('a0a046c1-056d-45a9-bfd9-13b47c24f257'),
  },
  {
    id: 'rituximab',
    generic: 'Rituximab',
    brand: 'Rituxan',
    biosimilars: ['Truxima', 'Ruxience', 'Riabni'],
    method: 'concentration-driven',
    bagSizes: [250, 500],
    diluents: ['0.9% Sodium Chloride Injection, USP', '5% Dextrose Injection, USP'],
    vialConcentration: 10,
    concentrationRange: { min: 1, max: 4, unit: 'mg/mL' },
    labelQuote:
      'Withdraw the necessary amount of RITUXAN and dilute to a final concentration of 1 mg/mL to 4 mg/mL in an infusion bag containing either 0.9% Sodium Chloride, USP, or 5% Dextrose Injection, USP. Gently invert the bag to mix the solution.',
    practicePoint:
      'The label sets a concentration target, not a volume, so bag size is chosen to land in range. Most sites add to a full bag and size the bag to the dose. Rituxan Hycela (SC) is not interchangeable with IV rituximab.',
    sourceLabel: 'RITUXAN US PI, §2.9 Preparation',
    sourceUrl: 'https://www.gene.com/download/pdf/rituxan_prescribing.pdf',
  },
  {
    id: 'pembrolizumab',
    generic: 'Pembrolizumab',
    brand: 'Keytruda',
    method: 'concentration-driven',
    bagSizes: [50, 100, 250],
    diluents: ['0.9% Sodium Chloride Injection, USP', '5% Dextrose Injection, USP'],
    vialConcentration: 25,
    concentrationRange: { min: 1, max: 10, unit: 'mg/mL' },
    labelQuote:
      'Withdraw the required volume from the vial(s) of KEYTRUDA and transfer into an intravenous (IV) bag containing 0.9% Sodium Chloride Injection, USP or 5% Dextrose Injection, USP. The final concentration of the diluted solution should be between 1 mg/mL to 10 mg/mL. Mix diluted solution by gentle inversion.',
    practicePoint:
      'The wide 1–10 mg/mL window means the added volume almost never pushes the bag out of range. Keytruda Qlex (SC) is a separate product.',
    sourceLabel: 'KEYTRUDA US PI, §2.8 Preparation and administration',
    sourceUrl: dailyMed('9333c79b-d487-4538-a9f0-71b91a02b287'),
  },
  {
    id: 'ferric-carboxymaltose',
    generic: 'Ferric carboxymaltose',
    brand: 'Injectafer',
    method: 'concentration-driven',
    bagSizes: [100, 250],
    diluents: ['0.9% Sodium Chloride Injection, USP'],
    vialConcentration: 50,
    concentrationRange: { min: 2, max: 4, unit: 'mg/mL' },
    labelQuote:
      'When administered via infusion, dilute up to 1,000 mg of iron in no more than 250 mL of sterile 0.9% Sodium Chloride Injection, USP, such that the concentration of the infusion is not less than 2 mg of iron per mL.',
    practicePoint:
      'The floor is a stability limit, not a tolerance target — below 2 mg iron/mL the product is no longer supported. May also be given undiluted as a slow IV push.',
    sourceLabel: 'INJECTAFER US PI, §2.3 Preparation and administration',
    sourceUrl: dailyMed('517b4a19-45b3-4286-9f6a-ced4e10447de'),
  },

  // ═══════════ Special handling ═══════════
  {
    id: 'eculizumab',
    generic: 'Eculizumab',
    brand: 'Soliris',
    biosimilars: ['Bkemv', 'Epysqli'],
    method: 'special',
    bagSizes: [],
    diluents: [
      '0.9% Sodium Chloride Injection, USP',
      '0.45% Sodium Chloride Injection, USP',
      '5% Dextrose in Water Injection, USP',
      'Ringer\'s Injection, USP',
    ],
    vialConcentration: 10,
    concentrationRange: { min: 5, max: 5, unit: 'mg/mL' },
    labelQuote:
      'Dilute SOLIRIS to a final concentration of 5 mg/mL by adding the appropriate amount (equal volume of diluent to drug volume) of 0.9% Sodium Chloride Injection, USP to the infusion bag. The final admixed SOLIRIS 5 mg/mL infusion volume is 60 mL for 300 mg doses, 120 mL for 600 mg doses, 180 mL for 900 mg doses or 1200 mg doses is 240 mL.',
    practicePoint:
      'Neither model applies — this is a 1:1 admixture built in an empty container, not an addition to a prefilled bag. Diluent volume equals drug volume, giving a fixed 5 mg/mL.',
    sourceLabel: 'SOLIRIS US PI, §2.6 Preparation and administration',
    sourceUrl: dailyMed('ebcd67fa-b4d1-4a22-b33d-ee8bf6b9c722'),
  },
];

// ── Presentation metadata ─────────────────────────────────────────────────────
export interface MethodMeta {
  /** Short verdict shown in the headline badge. */
  verdict: string;
  /** One-line plain-English answer. */
  answer: string;
  /**
   * Colour encodes the ACTION, not the reasoning: amber = draw the bag down
   * first, emerald = add it in, violet = neither model applies. So
   * `concentration-driven` shares emerald with `add-to-bag` — the pharmacist does
   * the same thing at the bench, and the headline carries the difference in why.
   * Blue is deliberately unused: globals.css retones blue to gold app-wide, which
   * would render it near-identical to the amber warning tone.
   */
  tone: 'amber' | 'emerald' | 'violet';
}

export const METHOD_META: Record<PrepMethod, MethodMeta> = {
  'remove-from-bag': {
    verdict: 'Remove volume from the bag',
    answer:
      'Withdraw a volume of diluent equal to the drug volume before adding the drug. The final volume is fixed by the label.',
    tone: 'amber',
  },
  'add-to-bag': {
    verdict: 'Add drug to a full bag',
    answer:
      'Add the drug directly to the full bag. The final volume is the bag plus the drug — no withdrawal step.',
    tone: 'emerald',
  },
  'concentration-driven': {
    verdict: 'Add to the bag — concentration is the constraint',
    answer:
      'The label sets an acceptable final concentration rather than a fixed volume. Add the drug to a bag sized to land in range — no withdrawal step is needed, because the added volume is not itself the constraint.',
    tone: 'emerald',
  },
  special: {
    verdict: 'Special handling',
    answer: 'This product does not follow either model — read the preparation note below.',
    tone: 'violet',
  },
};

// ── Lookup ────────────────────────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

/** All names an entry answers to, for search and exact resolution. */
export const entryNames = (e: DiluentVolumeEntry): string[] => [
  e.generic,
  e.brand,
  ...(e.biosimilars ?? []),
];

/**
 * Resolve a typed drug name to a curated entry. Matches generic, brand and
 * biosimilar names; falls back to a prefix match so "toci" and "actemra 400"
 * both land on tocilizumab. Suffixed biologic names (-fnia, -abcd) are matched
 * on their stem so "anifrolumab" finds "Anifrolumab-fnia".
 */
export function resolveDiluentEntry(input: string): DiluentVolumeEntry | null {
  const q = norm(input);
  if (!q) return null;

  const stem = (s: string) => norm(s).split(/[\s(]/)[0].replace(/-[a-z]{4}$/, '');

  // Exact name match first.
  for (const e of DILUENT_VOLUME_DB) {
    if (entryNames(e).some(n => norm(n) === q || stem(n) === q)) return e;
  }
  // Then a containment match in either direction.
  for (const e of DILUENT_VOLUME_DB) {
    if (entryNames(e).some(n => q.includes(stem(n)) || norm(n).includes(q))) return e;
  }
  return null;
}

/** Ranked search for the type-ahead list. */
export function searchDiluentEntries(input: string, limit = 8): DiluentVolumeEntry[] {
  const q = norm(input);
  if (!q) return [];
  const scored: { e: DiluentVolumeEntry; score: number }[] = [];
  for (const e of DILUENT_VOLUME_DB) {
    let best = 0;
    for (const name of entryNames(e)) {
      const n = norm(name);
      if (n === q) best = Math.max(best, 4);
      else if (n.startsWith(q)) best = Math.max(best, 3);
      else if (n.includes(q)) best = Math.max(best, 2);
    }
    if (best > 0) scored.push({ e, score: best });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.e.generic.localeCompare(b.e.generic))
    .slice(0, limit)
    .map(s => s.e);
}

// ── Preparation arithmetic ────────────────────────────────────────────────────
export interface PrepMath {
  /** Volume of diluent to withdraw and discard before adding the drug, mL. */
  discardVolume: number;
  /** Volume in the bag once the drug is in, mL. */
  finalVolume: number;
  /** Final concentration, mg/mL — only when the dose is known. */
  finalConcentration: number | null;
  /** Final volume/concentration had the other technique been used, for comparison. */
  alternateFinalVolume: number;
  alternateConcentration: number | null;
  /** Whether finalConcentration sits inside the label's stated range. */
  inRange: boolean | null;
  alternateInRange: boolean | null;
}

const within = (v: number | null, r?: ConcentrationRange): boolean | null => {
  if (v === null || !r) return null;
  // A single-value range (min === max) is a target, not a window — allow ±5%.
  if (r.min === r.max) return Math.abs(v - r.min) <= r.min * 0.05;
  return v >= r.min && v <= r.max;
};

/**
 * Work out the bag arithmetic for a given technique.
 *
 * `remove-from-bag` lands on the labeled bag volume exactly; every other method
 * is additive. The alternate figures let the UI show what the other technique
 * would have produced, which is the whole point of the comparison for
 * concentration-driven drugs.
 */
export function computePrep(
  method: PrepMethod,
  bagVolume: number,
  drugVolume: number,
  doseMg: number | null,
  range?: ConcentrationRange,
): PrepMath {
  const removes = method === 'remove-from-bag';
  const finalVolume = removes ? bagVolume : bagVolume + drugVolume;
  const alternateFinalVolume = removes ? bagVolume + drugVolume : bagVolume;

  const conc = doseMg !== null && finalVolume > 0 ? doseMg / finalVolume : null;
  const altConc = doseMg !== null && alternateFinalVolume > 0 ? doseMg / alternateFinalVolume : null;

  return {
    discardVolume: removes ? drugVolume : 0,
    finalVolume,
    finalConcentration: conc,
    alternateFinalVolume,
    alternateConcentration: altConc,
    inRange: within(conc, range),
    alternateInRange: within(altConc, range),
  };
}

// ── Bag step-up rule ──────────────────────────────────────────────────────────
// Practice standard, not label text: once the drug volume reaches 100 mL it is
// 40% of a 250 mL bag. That is too much to add on top — headroom gets tight and
// mixing is poor — so the bag steps up to 500 mL, where the same 100 mL is 20%.
// Infliximab 1000 mg is the case that drives it: 100 mL of reconstituted drug,
// which belongs in 500 mL (600 mL final, 1.67 mg/mL) rather than 250 mL
// (350 mL final, 2.86 mg/mL). Both sit inside the label's concentration window,
// so the range check alone will not catch this — it needs its own rule.
//
// Applies to additive preparation only. A `remove-from-bag` drug takes an equal
// volume out first, so the bag never carries more than its labeled volume no
// matter how large the dose.
export const BAG_STEP_UP_THRESHOLD_ML = 100;
export const BAG_STEP_UP_TARGET_ML = 500;

export interface BagRecommendation {
  /** Bag volume to use, mL. */
  bag: number;
  /** True when the threshold pushed this above the default bag. */
  steppedUp: boolean;
  /** Set when the rule fired but no large-enough bag is listed for the drug. */
  unavailable?: boolean;
}

/**
 * Choose the bag for a given drug volume. Returns the drug's default bag until
 * the added volume reaches the threshold, then the smallest listed bag at or
 * above the step-up target.
 */
export function recommendBagSize(
  method: PrepMethod,
  bagSizes: number[],
  drugVolume: number | null,
): BagRecommendation {
  const fallback = bagSizes[0] ?? 0;
  if (method === 'remove-from-bag' || drugVolume === null) return { bag: fallback, steppedUp: false };
  if (drugVolume < BAG_STEP_UP_THRESHOLD_ML) return { bag: fallback, steppedUp: false };
  // Already on a bag big enough to absorb the volume — nothing to advise.
  if (fallback >= BAG_STEP_UP_TARGET_ML) return { bag: fallback, steppedUp: false };

  const larger = bagSizes.filter(b => b >= BAG_STEP_UP_TARGET_ML).sort((a, b) => a - b);
  if (!larger.length) return { bag: fallback, steppedUp: false, unavailable: true };
  return { bag: larger[0], steppedUp: true };
}

// ── openFDA label scan (fallback for drugs not in the curated set) ────────────
// The curated table is deliberately narrow. For anything else we pull the
// label's own Dosage & Administration text and look for the phrases that
// distinguish the two techniques, then show the matched sentence so the user
// reads the label wording rather than trusting a classification.

export interface LabelScan {
  method: PrepMethod | 'unknown';
  /** The sentence that drove the classification, verbatim from the label. */
  matchedSentence?: string;
  concentrationRange?: ConcentrationRange;
  /** Bag volumes mentioned anywhere in the preparation text, mL. */
  bagSizes: number[];
  brandName?: string;
  genericName?: string;
}

// Ordered by specificity: an explicit withdrawal instruction outranks a bare
// "add to N mL", which outranks a concentration target. A label often carries
// more than one of these — Remicade has all three — and the directed technique
// has to win, so the first match in this order decides.
//
// Gaps are `[\s\S]{0,n}`, not `[^.]{0,n}`. Label text is dense with periods that
// are not sentence ends ("0.9% Sodium Chloride", "i.v.", "21-25 gauge"), so a
// negated-period gap cannot span the very phrases being matched — it silently
// fails on exactly the sentences that matter. Sentence boundaries are handled by
// splitting before matching instead.
const PATTERNS: { method: PrepMethod; re: RegExp }[] = [
  { method: 'remove-from-bag', re: /(?:withdraw|remove)[\s\S]{0,60}\bvolume\b[\s\S]{0,140}\bequal to\b[\s\S]{0,80}\bvolume\b/i },
  { method: 'remove-from-bag', re: /(?:withdraw|remove)\s*,?\s*and\s+(?:then\s+)?discard[\s\S]{0,160}\b(?:bag|bottle|container)\b/i },
  { method: 'remove-from-bag', re: /(?:withdraw|remove|discard)[\s\S]{0,60}\d+(?:\.\d+)?\s*-?\s*mL[\s\S]{0,80}\bfrom\b[\s\S]{0,80}\b(?:bag|bottle|container)\b/i },
  { method: 'remove-from-bag', re: /\bto a final volume of\b\s*\d+/i },
  { method: 'add-to-bag', re: /\b(?:inject|add|transfer)\b[\s\S]{0,120}\b(?:into|in to|to)\b[\s\S]{0,80}?\b\d+\s*mL\b/i },
  { method: 'concentration-driven', re: /\b(?:final|resulting)\s+(?:infusion\s+)?concentration\b[\s\S]{0,140}\d+(?:\.\d+)?\s*mg\/mL/i },
  { method: 'concentration-driven', re: /\bdilute\b[\s\S]{0,60}\bto a (?:final )?concentration\b/i },
];

// Sentences that could plausibly carry a preparation instruction. Deliberately
// broad — its only job is to keep dosing tables, monitoring and storage text away
// from the patterns; anything naming a volume or a transfer verb stays in.
const PREP_CUE =
  /\b(?:dilut\w*|reconstitut\w*|admix\w*|diluent|bag|bottle|container|withdraw|remove|discard|inject\w*|add|transfer|mL)\b/i;

const splitSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.;:])\s+(?=[A-Z0-9(\u2022•])/)
    .map(s => s.trim())
    .filter(Boolean);

/** Pull a mg/mL range out of label text, e.g. "1 mg/mL to 4 mg/mL", "0.4 to 4 mg/mL". */
function extractRange(text: string): ConcentrationRange | undefined {
  const pair = text.match(
    /(\d+(?:\.\d+)?)\s*(?:mg\/mL)?\s*(?:to|–|-|and)\s*(\d+(?:\.\d+)?)\s*mg\/mL/i,
  );
  if (pair) {
    const min = parseFloat(pair[1]);
    const max = parseFloat(pair[2]);
    if (isFinite(min) && isFinite(max) && max > min) return { min, max, unit: 'mg/mL' };
  }
  return undefined;
}

function extractBagSizes(text: string): number[] {
  const sizes = new Set<number>();
  const re = /(\d{2,4})\s*mL\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const v = parseInt(m[1], 10);
    // Standard small-volume parenteral bag sizes only — filters out dose volumes.
    if ([50, 100, 150, 200, 250, 500, 1000].includes(v)) sizes.add(v);
  }
  return Array.from(sizes).sort((a, b) => a - b);
}

/** Classify preparation technique from raw label text. Exported for testability. */
export function scanLabelText(text: string): LabelScan {
  const sentences = splitSentences(text);
  const prep = sentences.filter(s => PREP_CUE.test(s));
  const pool = prep.length ? prep : sentences;

  // Concentration range and bag sizes come from the whole section: a label
  // routinely states the acceptable range in a sentence that carries none of the
  // preparation cues ("The resulting infusion concentration should range
  // between 0.4 mg/mL and 4 mg/mL"), so restricting to the pool loses it.
  const concentrationRange = extractRange(text);
  const bagSizes = extractBagSizes(pool.join(' '));

  for (const { method, re } of PATTERNS) {
    const hit = pool.find(s => re.test(s));
    if (hit) return { method, matchedSentence: hit, concentrationRange, bagSizes };
  }
  return { method: 'unknown', concentrationRange, bagSizes };
}

const OPENFDA_BASE = 'https://api.fda.gov/drug/label.json';

/**
 * Look up an uncurated drug's preparation technique from its FDA label.
 * Returns null when the label cannot be reached or has no dosage section —
 * callers should fall back to "not found" rather than guessing.
 */
export async function scanFdaLabelForPrep(drugName: string): Promise<LabelScan | null> {
  const escaped = drugName.toLowerCase().replace(/["\\]/g, '').trim();
  if (!escaped) return null;

  const queries = [
    `openfda.generic_name:"${escaped}"+AND+openfda.route:"INTRAVENOUS"`,
    `openfda.brand_name:"${escaped}"+AND+openfda.route:"INTRAVENOUS"`,
    `openfda.generic_name:"${escaped}"`,
    `openfda.brand_name:"${escaped}"`,
  ];

  for (const q of queries) {
    try {
      const resp = await fetchWithTimeout(`${OPENFDA_BASE}?search=${encodeURIComponent(q)}&limit=1`);
      if (!resp.ok) continue;
      const data = await resp.json();
      const top = data?.results?.[0];
      if (!top) continue;

      const text: string = [
        ...(top.dosage_and_administration ?? []),
        ...(top.dosage_forms_and_strengths ?? []),
      ].join('\n');
      if (!text.trim()) continue;

      const scan = scanLabelText(text);
      return {
        ...scan,
        brandName: top.openfda?.brand_name?.[0],
        genericName: top.openfda?.generic_name?.[0],
      };
    } catch {
      // Network error / timeout / abort — try the next query shape.
    }
  }
  return null;
}
