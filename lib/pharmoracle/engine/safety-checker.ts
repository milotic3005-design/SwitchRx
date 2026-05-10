import type { SafetyFlag } from '../types/clinical';
import type { QueryClassification } from '../types/query';
import { isISMPHighAlert } from '@/lib/pharmacy-lookup/constants/ismp-high-alert';
import { classifyVesicant } from '@/lib/pharmacy-lookup/constants/vesicant-list';
import { isNioshHazardous } from '@/lib/pharmacy-lookup/constants/niosh-hd-list';

const QT_DRUGS = [
  'amiodarone', 'sotalol', 'quinidine', 'azithromycin', 'clarithromycin',
  'moxifloxacin', 'levofloxacin', 'fluconazole', 'voriconazole',
  'ondansetron', 'haloperidol', 'droperidol', 'methadone',
];

const SEROTONERGIC = [
  'sertraline', 'fluoxetine', 'paroxetine', 'citalopram', 'escitalopram',
  'venlafaxine', 'duloxetine', 'tramadol', 'fentanyl', 'methadone',
  'ondansetron', 'sumatriptan',
];

const has = (drugs: string[], name: string): boolean => {
  for (let i = 0; i < drugs.length; i++) {
    if (drugs[i].toLowerCase().includes(name.toLowerCase())) return true;
  }
  return false;
};

export const generateSafetyFlags = (cls: QueryClassification): SafetyFlag[] => {
  const flags: SafetyFlag[] = [];
  const drugs = cls.drug_names.map(d => d.toLowerCase());

  for (const drug of drugs) {
    if (isISMPHighAlert(drug)) {
      flags.push({
        level: 'critical',
        category: 'high_alert',
        message: `${drug} is an ISMP High-Alert Medication. Verify dose, concentration, and administration parameters independently before dispensing.`,
      });
    }

    const v = classifyVesicant(drug);
    if (v === 'dna_binding') {
      flags.push({
        level: 'critical',
        category: 'vesicant',
        message: `${drug} is a DNA-binding vesicant. Severe progressive tissue necrosis on extravasation. Central line preferred. Antidote: dexrazoxane (Totect) for anthracyclines.`,
      });
    } else if (v === 'non_dna_binding') {
      flags.push({
        level: 'critical',
        category: 'vesicant',
        message: `${drug} is a vesicant. Administer via confirmed patent IV only. Antidote: hyaluronidase for vinca alkaloids.`,
      });
    } else if (v === 'irritant') {
      flags.push({
        level: 'warning',
        category: 'vesicant',
        message: `${drug} is an IV irritant. Administer diluted per reference. Monitor infusion site for phlebitis.`,
      });
    }

    if (cls.query_domain === 'usp797_compounding' && isNioshHazardous(drug).isHazardous) {
      flags.push({
        level: 'critical',
        category: 'hazardous_drug',
        message: `${drug} is a USP 800 hazardous drug requiring: C-PEC, negative pressure room (if antineoplastic), double gloving, gown, respiratory protection.`,
      });
    }
  }

  if (has(drugs, 'promethazine')) {
    flags.push({
      level: 'critical',
      category: 'high_alert',
      message: 'IV promethazine is CONTRAINDICATED — Black Box Warning. Risk of irreversible tissue necrosis and gangrene. Use oral, deep IM, or rectal route ONLY.',
    });
  }

  if (has(drugs, 'vincristine') && /intrathecal/i.test(cls.notes)) {
    flags.push({
      level: 'critical',
      category: 'high_alert',
      message: 'NEVER EVENT: Vincristine must NEVER be administered intrathecally. IV route only. Fatal neurotoxicity.',
    });
  }

  if (has(drugs, 'vancomycin') && (has(drugs, 'piperacillin') || has(drugs, 'pip-tazo') || has(drugs, 'tazobactam'))) {
    flags.push({
      level: 'warning',
      category: 'interaction',
      message: 'Concurrent vancomycin + pip-tazo increases AKI risk ~3× vs vancomycin alone (ASHP 2020). Monitor SCr q48–72h. Consider cefepime substitution.',
    });
  }

  let qtCount = 0;
  for (let i = 0; i < drugs.length; i++) {
    for (let j = 0; j < QT_DRUGS.length; j++) {
      if (drugs[i].includes(QT_DRUGS[j])) {
        qtCount++;
        break;
      }
    }
  }
  if (qtCount >= 2) {
    flags.push({
      level: 'warning',
      category: 'interaction',
      message: 'Concurrent QTc-prolonging agents. Monitor ECG. Correct K⁺ and Mg²⁺. Avoid if baseline QTc >500 ms.',
    });
  }

  if (has(drugs, 'linezolid')) {
    let hasSerotonergic = false;
    for (let i = 0; i < drugs.length; i++) {
      for (let j = 0; j < SEROTONERGIC.length; j++) {
        if (drugs[i].includes(SEROTONERGIC[j])) {
          hasSerotonergic = true;
          break;
        }
      }
      if (hasSerotonergic) break;
    }

    if (hasSerotonergic) {
      flags.push({
        level: 'critical',
        category: 'interaction',
        message: 'CRITICAL: Serotonin syndrome risk. Linezolid has irreversible MAOI activity. Concurrent use with serotonergic drugs is generally contraindicated.',
      });
    }
  }

  return flags;
};
