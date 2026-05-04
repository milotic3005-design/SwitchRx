// ISMP High-Alert Medications (acute care setting) — adapted from PharmOracle.
// Source: ISMP List of High-Alert Medications in Acute Care Settings (2024).
// These drugs bear a heightened risk of significant patient harm when used
// in error and warrant a critical-level safety flag in the consult.

export const ISMP_HIGH_ALERT_DRUGS: ReadonlySet<string> = new Set([
  // Anticoagulants
  'heparin', 'warfarin', 'enoxaparin', 'apixaban', 'rivaroxaban',
  'argatroban', 'bivalirudin', 'dalteparin', 'fondaparinux',
  // Insulin & hypoglycemics
  'insulin', 'insulin glargine', 'insulin aspart', 'insulin lispro',
  // Opioids (parenteral)
  'morphine', 'hydromorphone', 'fentanyl', 'sufentanil', 'remifentanil',
  // Neuromuscular blockers
  'vecuronium', 'rocuronium', 'succinylcholine', 'cisatracurium', 'pancuronium',
  // Chemotherapy & methotrexate
  'methotrexate',
  // Concentrated electrolytes
  'potassium chloride', 'potassium phosphate',
  'sodium chloride 3%', 'sodium chloride 23.4%',
  'magnesium sulfate 50%', 'calcium chloride',
  // Hypertonic dextrose
  'dextrose 20%', 'dextrose 50%', 'dextrose 70%',
  // Oxytocics
  'oxytocin',
  // Sedation
  'propofol', 'midazolam', 'dexmedetomidine', 'ketamine',
  // Vasoactives
  'norepinephrine', 'epinephrine', 'phenylephrine', 'vasopressin',
  'dopamine', 'dobutamine', 'nitroprusside', 'nicardipine',
  // Antiarrhythmics (parenteral)
  'amiodarone', 'lidocaine', 'procainamide',
]);

export const isISMPHighAlert = (genericName: string): boolean => {
  const n = genericName.trim().toLowerCase();
  if (ISMP_HIGH_ALERT_DRUGS.has(n)) return true;
  for (const drug of ISMP_HIGH_ALERT_DRUGS) {
    if (n.includes(drug)) return true;
  }
  return false;
};
