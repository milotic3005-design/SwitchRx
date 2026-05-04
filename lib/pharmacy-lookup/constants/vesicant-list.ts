// Vesicant / irritant classification — adapted from PharmOracle.
// Used by safety-checker to flag extravasation risk on every drug
// mentioned in the consult scenario.

export type VesicantClass = 'dna_binding' | 'non_dna_binding' | 'irritant';

export const DNA_BINDING_VESICANTS: ReadonlySet<string> = new Set([
  'doxorubicin', 'epirubicin', 'daunorubicin', 'idarubicin',
  'mitomycin c', 'mitomycin', 'mechlorethamine', 'dactinomycin',
]);

export const NON_DNA_BINDING_VESICANTS: ReadonlySet<string> = new Set([
  'vincristine', 'vinblastine', 'vinorelbine', 'vindesine',
  'paclitaxel', 'docetaxel', 'cabazitaxel', 'ixabepilone',
  'eribulin', 'trabectedin',
]);

export const IRRITANTS: ReadonlySet<string> = new Set([
  'vancomycin', 'etoposide', 'irinotecan', 'fluorouracil', '5-fu',
  'doxorubicin liposomal', 'cisplatin', 'oxaliplatin', 'carboplatin',
  'gemcitabine', 'topotecan', 'bendamustine',
  'amphotericin b', 'acyclovir', 'phenytoin', 'fosphenytoin',
  'potassium chloride', 'calcium chloride', 'calcium gluconate',
  'magnesium sulfate', 'dextrose 50%', 'parenteral nutrition',
]);

export const classifyVesicant = (genericName: string): VesicantClass | null => {
  const n = genericName.trim().toLowerCase();
  if (DNA_BINDING_VESICANTS.has(n)) return 'dna_binding';
  if (NON_DNA_BINDING_VESICANTS.has(n)) return 'non_dna_binding';
  if (IRRITANTS.has(n)) return 'irritant';
  // Partial match fallback (e.g. "doxorubicin hydrochloride")
  for (const v of DNA_BINDING_VESICANTS) if (n.includes(v)) return 'dna_binding';
  for (const v of NON_DNA_BINDING_VESICANTS) if (n.includes(v)) return 'non_dna_binding';
  for (const v of IRRITANTS) if (n.includes(v)) return 'irritant';
  return null;
};
