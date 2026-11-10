// The app's tools and calculators as data, shared by the top menu, the launcher, the search and the
// Calculators page so they can never list different things.

export type TabId = 'switching' | 'infusion' | 'calculators' | 'drugref' | 'mixing' | 'breakroom';

export interface Tool {
  tab: TabId;
  label: string;
  /** Shown in the top menu where the full label does not fit. */
  shortLabel: string;
}

export const TOOLS: readonly Tool[] = [
  { tab: 'switching', label: 'Switching Protocols', shortLabel: 'Switching' },
  { tab: 'infusion', label: 'Infusion Copilot', shortLabel: 'Copilot' },
  { tab: 'calculators', label: 'Clinical Calculators', shortLabel: 'Calculators' },
  { tab: 'drugref', label: 'Drug Reference', shortLabel: 'Reference' },
  { tab: 'mixing', label: 'Mixing Guide', shortLabel: 'Mixing' },
  { tab: 'breakroom', label: 'Break Room', shortLabel: 'Break Room' },
];

/** The one-line description on a tool's launcher card. The counts come from the data, never from typed numbers. */
export function toolLine(tab: TabId, counts: { drugs: number; calculators: number }): string {
  switch (tab) {
    case 'switching':
      return 'Find replacement therapies when a medication has to change.';
    case 'infusion':
      return 'Ask any infusion question and get a cited answer.';
    case 'calculators':
      return `${counts.calculators} dosing, rate and lab calculators.`;
    case 'drugref':
      return `Compounding, stability and safety data for ${counts.drugs} drugs.`;
    case 'mixing':
      return 'Mix, administer and store cards at a glance.';
    case 'breakroom':
      return 'Short games for a mental reset.';
  }
}

export type CalcGroupId = 'antimicrobials' | 'infusion' | 'patient' | 'anemia-labs';

export const CALC_GROUPS: readonly { id: CalcGroupId; label: string }[] = [
  { id: 'antimicrobials', label: 'Antimicrobials' },
  { id: 'infusion', label: 'Infusion prep & rates' },
  { id: 'patient', label: 'Patient measures' },
  { id: 'anemia-labs', label: 'Anemia & labs' },
];

export type CalcId =
  | 'idsa-abx'
  | 'vanco'
  | 'cadd'
  | 'diluent'
  | 'ivig'
  | 'biolrate'
  | 'crcl'
  | 'bodywt'
  | 'calcium'
  | 'iron'
  | 'esa'
  | 'hbv';

export interface CalculatorEntry {
  id: CalcId;
  label: string;
  group: CalcGroupId;
  /** Extra words the search matches besides the label. */
  keywords: readonly string[];
}

export const CALCULATORS: readonly CalculatorEntry[] = [
  { id: 'idsa-abx', label: 'IDSA Antibiotic Advisor', group: 'antimicrobials', keywords: ['antibiotic', 'idsa', 'infection', 'abx'] },
  { id: 'vanco', label: 'Vancomycin AUC Dosing', group: 'antimicrobials', keywords: ['vancomycin', 'auc', 'trough', 'kinetics'] },
  { id: 'cadd', label: 'CADD Bag Calculator', group: 'antimicrobials', keywords: ['cadd', 'pump', 'opat'] },
  { id: 'diluent', label: 'Diluent Volume / Bag Prep', group: 'infusion', keywords: ['diluent', 'bag prep', 'volume'] },
  { id: 'ivig', label: 'IVIG Infusion Rate', group: 'infusion', keywords: ['ivig', 'immune globulin', 'titration'] },
  { id: 'biolrate', label: 'Biologic Rate Titration', group: 'infusion', keywords: ['biologic', 'rate ladder', 'titration'] },
  { id: 'crcl', label: 'CrCl (Cockcroft-Gault)', group: 'patient', keywords: ['creatinine', 'clearance', 'cockcroft', 'gault', 'renal', 'kidney'] },
  { id: 'bodywt', label: 'Body Weight & BMI', group: 'patient', keywords: ['bmi', 'ibw', 'adjbw', 'ideal', 'adjusted', 'weight'] },
  { id: 'calcium', label: 'Corrected Calcium', group: 'patient', keywords: ['calcium', 'albumin', 'corrected'] },
  { id: 'iron', label: 'Iron Deficit (Ganzoni)', group: 'anemia-labs', keywords: ['iron', 'ganzoni', 'deficit', 'hemoglobin'] },
  { id: 'esa', label: 'ESA Dosing (CKD Anemia)', group: 'anemia-labs', keywords: ['esa', 'epoetin', 'darbepoetin', 'ckd', 'anemia'] },
  { id: 'hbv', label: 'HBV Serology Interpreter', group: 'anemia-labs', keywords: ['hbv', 'hepatitis b', 'serology', 'hbsag'] },
];

/** The calculator the page opens on when nothing is remembered. */
export const DEFAULT_CALC: CalcId = 'cadd';

/** Where the Calculators page remembers the calculator used last. */
export const LAST_CALC_KEY = 'switchrx.calculators.last.v1';

export function isCalcId(x: unknown): x is CalcId {
  return typeof x === 'string' && CALCULATORS.some(c => c.id === x);
}
