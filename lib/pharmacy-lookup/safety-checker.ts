// Safety flag generator — runs locally over the extracted drug list and
// classification before any external API call. Adapted from PharmOracle.
// Returns critical / warning / info flags so the UI can stream them to the
// user immediately, ahead of the AI brief.

import type { QueryClassification, SafetyFlag } from './types';
import { isISMPHighAlert } from './constants/ismp-high-alert';
import { classifyVesicant } from './constants/vesicant-list';
import { isNioshHazardous } from './constants/niosh-hd-list';

const QT_PROLONGING = new Set([
  'amiodarone', 'sotalol', 'quinidine', 'azithromycin', 'clarithromycin',
  'moxifloxacin', 'levofloxacin', 'fluconazole', 'voriconazole',
  'ondansetron', 'haloperidol', 'droperidol', 'methadone',
]);

const SEROTONERGIC = new Set([
  'sertraline', 'fluoxetine', 'paroxetine', 'citalopram', 'escitalopram',
  'venlafaxine', 'duloxetine', 'tramadol', 'fentanyl', 'methadone',
  'ondansetron', 'sumatriptan',
]);

const titleCase = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const drugContains = (drugs: string[], needle: string): boolean =>
  drugs.some(d => d.toLowerCase().includes(needle));

export const generateSafetyFlags = (
  cls: QueryClassification
): SafetyFlag[] => {
  const flags: SafetyFlag[] = [];
  const drugs = cls.drug_names.map(d => d.toLowerCase());

  for (const drug of drugs) {
    const niceName = titleCase(drug);

    if (isISMPHighAlert(drug)) {
      flags.push({
        level: 'critical',
        category: 'high_alert',
        drug: niceName,
        message: `${niceName} is an ISMP High-Alert Medication. Verify dose, concentration, and administration parameters with an independent double-check before dispensing.`,
      });
    }

    const v = classifyVesicant(drug);
    if (v === 'dna_binding') {
      flags.push({
        level: 'critical',
        category: 'vesicant',
        drug: niceName,
        message: `${niceName} is a DNA-binding vesicant. Severe progressive tissue necrosis on extravasation. Central line strongly preferred. Antidote: dexrazoxane (Totect) for anthracyclines.`,
      });
    } else if (v === 'non_dna_binding') {
      flags.push({
        level: 'critical',
        category: 'vesicant',
        drug: niceName,
        message: `${niceName} is a non-DNA-binding vesicant. Administer via confirmed patent IV only. Antidote: hyaluronidase (especially for vinca alkaloids).`,
      });
    } else if (v === 'irritant') {
      flags.push({
        level: 'warning',
        category: 'vesicant',
        drug: niceName,
        message: `${niceName} is an IV irritant. Administer diluted per reference; monitor infusion site for phlebitis. Avoid prolonged peripheral infusion at high concentrations.`,
      });
    }

    const niosh = isNioshHazardous(drug);
    if (niosh.isHazardous) {
      flags.push({
        level: niosh.table === 1 ? 'critical' : 'warning',
        category: 'hazardous_drug',
        drug: niceName,
        message: `${niceName} is a NIOSH ${niosh.table === 1 ? 'Table 1 antineoplastic' : 'Table 2 non-antineoplastic'} hazardous drug. USP <800> handling required: closed-system transfer device (CSTD), C-PEC${niosh.table === 1 ? ', negative pressure room' : ''}, double gloving, gown, eye protection.`,
      });
    }
  }

  // Cross-drug rules
  if (drugContains(drugs, 'promethazine')) {
    flags.push({
      level: 'critical',
      category: 'high_alert',
      message: 'IV promethazine carries a Black Box Warning for severe tissue injury including gangrene. Use deep IM, oral, or rectal routes preferred. If IV must be used, dilute and slow-push only.',
    });
  }

  if (drugContains(drugs, 'vincristine') && /intrathecal|it dose|i\.t\./i.test(cls.notes ?? '')) {
    flags.push({
      level: 'critical',
      category: 'high_alert',
      message: '🛑 NEVER EVENT: Vincristine must NEVER be administered intrathecally — fatal neurotoxicity. IV route only; dispense in a minibag, never a syringe, to prevent wrong-route error.',
    });
  }

  if (
    drugContains(drugs, 'vancomycin') &&
    (drugContains(drugs, 'piperacillin') ||
      drugContains(drugs, 'tazobactam') ||
      drugContains(drugs, 'pip-tazo') ||
      drugContains(drugs, 'zosyn'))
  ) {
    flags.push({
      level: 'warning',
      category: 'interaction',
      message: 'Concurrent vancomycin + piperacillin-tazobactam increases AKI risk ~3× vs vancomycin alone (ASHP 2020 review). Monitor SCr q48–72h. Consider cefepime substitution if Pseudomonal coverage allows.',
    });
  }

  const qtCount = drugs.filter(d => [...QT_PROLONGING].some(q => d.includes(q))).length;
  if (qtCount >= 2) {
    flags.push({
      level: 'warning',
      category: 'interaction',
      message: 'Multiple QTc-prolonging agents detected. Check baseline ECG (avoid combination if QTc >500 ms), correct K⁺ and Mg²⁺ before initiation, and monitor ECG during therapy.',
    });
  }

  if (
    drugContains(drugs, 'linezolid') &&
    drugs.some(d => [...SEROTONERGIC].some(s => d.includes(s)))
  ) {
    flags.push({
      level: 'critical',
      category: 'interaction',
      message: 'CRITICAL: Serotonin syndrome risk. Linezolid has reversible non-selective MAOI activity. Concurrent serotonergic agents are generally contraindicated; monitor for clonus, hyperreflexia, agitation, hyperthermia.',
    });
  }

  return flags;
};
