import { getDrugProfile, drugClasses, biologicIndications } from './drug-db';
import { monographs } from './drug-monographs';

export type SwitchRequest = {
  fromDrug: string;
  currentDose: string;
  duration: string;
  toDrug: string;
  reason: string;
};

export type SwitchResponse = {
  fromDrug: string;
  toDrug: string;
  rationale: string;
  protocol: string;
  monitoring: string[];
  references: string[];
};

// --- DRUG CLASS EQUIVALENCY DICTIONARIES ---

// Statin equivalent doses (relative to Atorvastatin 10mg)
const statinEquivalents: Record<string, number> = {
  'pitavastatin': 2,
  'rosuvastatin': 5,
  'atorvastatin': 10,
  'simvastatin': 20,
  'lovastatin': 40,
  'pravastatin': 40,
  'fluvastatin': 80
};

// Opioid Morphine Milligram Equivalents (MME) conversion factors
const opioidMME: Record<string, number> = {
  'morphine po': 1,
  'morphine iv': 3,
  'oxycodone po': 1.5,
  'hydrocodone po': 1,
  'hydromorphone po': 4,
  'hydromorphone iv': 20,
  'oxymorphone po': 3,
  'codeine po': 0.15
};

// SSRI equivalent doses (relative to Fluoxetine 20mg)
const ssriEquivalents: Record<string, number> = {
  'escitalopram': 10,
  'citalopram': 20,
  'fluoxetine': 20,
  'paroxetine': 20,
  'sertraline': 50
};

// SNRI equivalent doses (relative to Venlafaxine 75mg)
const snriEquivalents: Record<string, number> = {
  'venlafaxine': 75,
  'duloxetine': 30,
  'desvenlafaxine': 50,
  'levomilnacipran': 40
};

// MAOIs
const maois = ['phenelzine', 'tranylcypromine', 'isocarboxazid', 'moclobemide', 'selegiline'];

// TCAs
const tcas = ['amitriptyline', 'nortriptyline', 'imipramine', 'desipramine', 'clomipramine', 'doxepin', 'protriptyline', 'trimipramine', 'amoxapine', 'maprotiline'];

// Antipsychotic equivalent doses (relative to Risperidone 1mg)
const antipsychoticEquivalents: Record<string, number> = {
  'risperidone': 1,
  'olanzapine': 2.5,
  'quetiapine': 75,
  'aripiprazole': 2,
  'ziprasidone': 20,
  'lurasidone': 20,
  'paliperidone': 1.5,
  'haloperidol': 1
};

export function getSwitchingProtocol(req: SwitchRequest): SwitchResponse | null {
  const from = req.fromDrug.trim().toLowerCase();
  const to = req.toDrug.trim().toLowerCase();
  const reason = req.reason;
  const dose = parseFloat(req.currentDose);

  // --- ANTICHOLINERGIC BURDEN SWITCHES ---
  const fromProfile = getDrugProfile(from);
  const toProfile = getDrugProfile(to);

  if (fromProfile && toProfile && reason.toLowerCase().includes('anticholinergic')) {
    const fromHighAntiChol = fromProfile.anticholinergic === 'High' || fromProfile.anticholinergic === 'Moderate';
    const toHighAntiChol = toProfile.anticholinergic === 'High' || toProfile.anticholinergic === 'Moderate';

    if (fromHighAntiChol && !toHighAntiChol) {
       return {
          fromDrug: req.fromDrug,
          toDrug: req.toDrug,
          rationale: `Switching from ${req.fromDrug} (which has a ${fromProfile.anticholinergic.toLowerCase()} anticholinergic burden) to ${req.toDrug} (which has a ${toProfile.anticholinergic.toLowerCase()} burden) is appropriate to alleviate anticholinergic side effects like dry mouth, constipation, or cognitive impairment.`,
          protocol: `Cross-taper recommended to avoid cholinergic rebound. \n\n1. Gradually reduce ${req.fromDrug} over 2-4 weeks (slower if the patient has been on it long-term).\n2. Initiate ${req.toDrug} at a low starting dose and titrate up as ${req.fromDrug} is tapered.`,
          monitoring: [
            "Cholinergic rebound (nausea, vomiting, sweating, diarrhea) if tapered too quickly",
            "Resolution of anticholinergic side effects",
            "Emergence of new side effects from the new agent"
          ],
          references: [
            "Maudsley Prescribing Guidelines in Psychiatry",
            "Clinical Pharmacokinetics of Antidepressants"
          ]
       };
    } else if (!fromHighAntiChol && toHighAntiChol) {
       return {
          fromDrug: req.fromDrug,
          toDrug: req.toDrug,
          rationale: `Switching to ${req.toDrug} introduces a ${toProfile.anticholinergic.toLowerCase()} anticholinergic burden. Caution is advised, especially in elderly patients or those with pre-existing cognitive impairment, BPH, or narrow-angle glaucoma.`,
          protocol: `1. Taper ${req.fromDrug} as clinically appropriate.\n2. Initiate ${req.toDrug} at the lowest possible dose.\n3. Titrate slowly, monitoring closely for anticholinergic adverse effects.`,
          monitoring: [
            "Anticholinergic side effects (dry mouth, constipation, urinary retention, blurred vision, tachycardia)",
            "Cognitive changes or delirium (especially in older adults)",
            "Worsening of underlying conditions (e.g., BPH, glaucoma)"
          ],
          references: [
            "Maudsley Prescribing Guidelines in Psychiatry",
            "American Geriatrics Society Beers Criteria"
          ]
       };
    } else if (fromHighAntiChol && toHighAntiChol) {
       return {
          fromDrug: req.fromDrug,
          toDrug: req.toDrug,
          rationale: `Switching between two medications with significant anticholinergic burden (${req.fromDrug} and ${req.toDrug}). Concurrent use during a cross-taper increases the risk of severe anticholinergic toxicity.`,
          protocol: `Conservative cross-taper or washout recommended. \n\n1. Taper ${req.fromDrug} to a low dose before initiating ${req.toDrug}.\n2. Avoid overlapping high doses of both agents.\n3. Consider a brief washout if clinically feasible to minimize cumulative anticholinergic load.`,
          monitoring: [
            "Anticholinergic toxicity (delirium, hyperthermia, paralytic ileus, urinary retention)",
            "Cholinergic rebound from tapering the first agent"
          ],
          references: [
            "Maudsley Prescribing Guidelines in Psychiatry"
          ]
       };
    }
  }

  // --- CROSS-CLASS SWITCHES ---

  // 0. SSRI/SNRI to MAOI
  if ((from in ssriEquivalents || from in snriEquivalents) && maois.includes(to)) {
    const washoutDays = from === 'fluoxetine' ? 35 : 14;
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Switching from a serotonergic agent to an MAOI carries a severe risk of serotonin toxicity. A strict washout period is mandatory per clinical guidelines.`,
      protocol: `1. Discontinue ${req.fromDrug}.\n2. MANDATORY WASHOUT: Wait at least ${washoutDays} days before initiating ${req.toDrug}. (Fluoxetine requires a 5-week washout due to its long half-life; other SSRIs/SNRIs require 2 weeks).\n3. Initiate ${req.toDrug} at the lowest starting dose and titrate cautiously.`,
      monitoring: [
        "Serotonin syndrome (hyperreflexia, clonus, autonomic instability, altered mental status)",
        "Hypertensive crisis (dietary tyramine restrictions must be initiated)",
        "Worsening depression or suicidality during the washout period"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // 0b. MAOI to SSRI/SNRI
  if (maois.includes(from) && (to in ssriEquivalents || to in snriEquivalents || to === 'vortioxetine' || to === 'bupropion')) {
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Irreversible MAOIs require time for the body to synthesize new monoamine oxidase enzymes. Introducing a new agent too early risks severe serotonin syndrome or hypertensive crisis.`,
      protocol: `1. Discontinue ${req.fromDrug}.\n2. MANDATORY WASHOUT: Wait exactly 14 days before initiating ${req.toDrug}.\n3. Initiate ${req.toDrug} at the standard starting dose.`,
      monitoring: [
        "Serotonin syndrome",
        "Hypertensive crisis",
        "Worsening depression during the washout period"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // 0c. SSRI/SNRI to Vortioxetine
  if ((from in ssriEquivalents || from in snriEquivalents) && to === 'vortioxetine') {
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Vortioxetine is a multimodal serotonergic agent. Clinical guidelines recommend a direct switch or a brief cross-taper depending on the current dose of the SSRI/SNRI.`,
      protocol: `Direct Switch (Preferred for low/moderate doses): Stop ${req.fromDrug} and start Vortioxetine 10mg the next day.\n\nCross-Taper (For high doses): Reduce ${req.fromDrug} by 50% for 1 week while starting Vortioxetine 10mg, then stop ${req.fromDrug}.`,
      monitoring: [
        "Nausea (very common with Vortioxetine initiation)",
        "Serotonin syndrome",
        "Discontinuation symptoms from the previous agent"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // 1. SSRI to Bupropion
  if (from in ssriEquivalents && to === 'bupropion') {
    let protocol = "Cross-taper recommended. Halve the dose of the current SSRI and initiate Bupropion at 150mg XL daily. After 1-2 weeks, discontinue the SSRI and titrate Bupropion as clinically indicated.";
    
    if (req.duration === '> 8 weeks' && dose > ssriEquivalents[from]) {
       protocol = "Prolonged cross-taper recommended due to extended duration of therapy and higher dose. Reduce SSRI dose by 25-50% every 1-2 weeks while initiating Bupropion 150mg XL to minimize SSRI withdrawal syndrome.";
    }
    
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Bupropion is a Norepinephrine-Dopamine Reuptake Inhibitor (NDRI). It lacks serotonergic activity, making it an evidence-based switch for patients experiencing SSRI-induced ${reason.toLowerCase() || 'adverse effects'}.`,
      protocol: protocol,
      monitoring: [
        "SSRI withdrawal symptoms (FINISH syndrome)", 
        "Blood pressure (Bupropion can cause dose-related hypertension)", 
        "Seizure risk (avoid if history of seizures or eating disorders)"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults", 
        "Practice Guideline for the Treatment of Patients With Major Depressive Disorder, 3rd (2010) - American Psychiatric Association"
      ]
    };
  }

  // 1b. SSRI/SNRI to Mirtazapine
  if ((from in ssriEquivalents || from in snriEquivalents) && to === 'mirtazapine') {
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Mirtazapine is an alpha-2 antagonist that enhances noradrenergic and serotonergic release. It is often chosen for its sleep-promoting and appetite-stimulating properties.`,
      protocol: `Cross-taper recommended to minimize withdrawal from the ${req.fromDrug}. \n\n1. Reduce ${req.fromDrug} by 50%.\n2. Initiate Mirtazapine at 15mg at bedtime.\n3. After 1-2 weeks, discontinue ${req.fromDrug} and titrate Mirtazapine to 30mg at bedtime if needed.`,
      monitoring: [
        "Sedation (usually transient, often worse at lower 15mg dose than 30mg)",
        "Weight gain and metabolic changes",
        "Discontinuation symptoms from the previous agent"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // 1c. SSRI/SNRI to TCA
  if ((from in ssriEquivalents || from in snriEquivalents) && tcas.includes(to)) {
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `TCAs are potent but have significant anticholinergic and cardiovascular side effects. Caution is required when switching from SSRIs (especially fluoxetine/paroxetine) due to CYP2D6 inhibition, which can dangerously increase TCA levels.`,
      protocol: `Cross-taper with extreme caution. \n\n1. Reduce ${req.fromDrug} by 50%.\n2. Initiate ${req.toDrug} at a very low dose (e.g., 10-25mg at bedtime).\n3. Gradually taper off ${req.fromDrug} over 1-2 weeks.\n4. Slowly titrate ${req.toDrug} based on tolerability and efficacy.\n\n*Note: If switching from Fluoxetine or Paroxetine, consider a washout or use much lower TCA doses due to prolonged CYP2D6 inhibition.*`,
      monitoring: [
        "Anticholinergic effects (dry mouth, constipation, urinary retention)",
        "Orthostatic hypotension and QTc prolongation (baseline ECG recommended)",
        "TCA toxicity (due to CYP450 interactions)"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // 2. Fluoxetine to SNRI
  if (from === 'fluoxetine' && ['venlafaxine', 'duloxetine', 'desvenlafaxine'].includes(to)) {
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Switching to an SNRI is a standard step for lack of efficacy on an SSRI. Fluoxetine and its active metabolite have a very long half-life (up to 16 days) and inhibit CYP2D6.`,
      protocol: `Direct switch with caution. Stop Fluoxetine. Wait 4-7 days before initiating ${req.toDrug} at a low starting dose. DO NOT cross-taper due to high risk of serotonin syndrome.`,
      monitoring: [
        "Serotonin syndrome (mental status changes, autonomic instability, neuromuscular hyperactivity)", 
        "Worsening depression during the washout period"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // 2b. SSRI to SNRI (General, excluding Fluoxetine which is handled above)
  if (from in ssriEquivalents && to in snriEquivalents && from !== 'fluoxetine') {
    const fromEq = ssriEquivalents[from];
    const isHighDose = !isNaN(dose) && dose >= (fromEq * 2); // e.g., Citalopram >= 40mg, Sertraline >= 100mg

    let protocolText = `Step-wise Cross-Taper Protocol (Recommended to minimize withdrawal and improve tolerability):\n\nWeek 1:\n- Reduce ${req.fromDrug} dose by 50%.\n- Initiate ${req.toDrug} at its lowest starting dose (e.g., Venlafaxine 37.5mg or Duloxetine 20-30mg).\n\nWeek 2:\n- Discontinue ${req.fromDrug} completely.\n- Maintain ${req.toDrug} at the starting dose.\n\nWeek 3+:\n- Titrate ${req.toDrug} upwards based on clinical response and tolerability to the target therapeutic dose.`;
    
    if (!isHighDose) {
      protocolText += `\n\nAlternative (Direct Switch for low doses only):\nStop ${req.fromDrug} and start ${req.toDrug} the next day at the starting dose.`;
    }

    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Switching from an SSRI to an SNRI due to ${reason.toLowerCase() || 'lack of efficacy'}. SNRIs provide additional noradrenergic reuptake inhibition. A step-wise cross-taper reduces the risk of serotonergic withdrawal.`,
      protocol: protocolText,
      monitoring: [
        "Serotonin syndrome",
        "Blood pressure (SNRIs can cause dose-related hypertension)",
        "SSRI discontinuation syndrome (dizziness, nausea, lethargy)"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // 2c. SNRI to SSRI
  if (from in snriEquivalents && to in ssriEquivalents) {
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Switching from an SNRI to an SSRI due to ${reason.toLowerCase() || 'adverse effects or lack of efficacy'}.`,
      protocol: `Cross-taper recommended. SNRIs (especially Venlafaxine and Desvenlafaxine) have a high risk of severe discontinuation syndrome. \n\n1. Reduce ${req.fromDrug} gradually over 2-4 weeks.\n2. Initiate ${req.toDrug} at a low dose and titrate up as ${req.fromDrug} is reduced.`,
      monitoring: [
        "SNRI withdrawal symptoms (brain zaps, dizziness, nausea, irritability)",
        "Serotonin syndrome"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // 3. Gabapentin to Pregabalin
  if (from === 'gabapentin' && to === 'pregabalin') {
    const pregabalinDose = isNaN(dose) ? "Calculate ~1/6th of the Gabapentin dose" : `${Math.round(dose / 6)}mg`;
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Pregabalin has more predictable, linear pharmacokinetics and higher bioavailability compared to gabapentin, which relies on a saturable transport mechanism.`,
      protocol: `Direct switch at the next scheduled dose. The approximate conversion ratio is 6:1 (Gabapentin:Pregabalin). \n\nFor a gabapentin dose of ${isNaN(dose) ? '[Dose]' : dose}mg/day, the estimated pregabalin target is ${pregabalinDose}/day, divided BID or TID. \n\nDiscontinue gabapentin and initiate pregabalin at the next scheduled dosing time.`,
      monitoring: [
        "Somnolence and dizziness (common during transition)",
        "Peripheral edema",
        "Renal function (both require dose adjustment in renal impairment)"
      ],
      references: ["Pharmacotherapy: A Pathophysiologic Approach (Neuropathic Pain Guidelines)"]
    };
  }

  // 4. Aripiprazole to Risperidone
  if (from === 'aripiprazole' && to === 'risperidone') {
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Switching from a partial D2 agonist (Aripiprazole) to a strong D2 antagonist (Risperidone) due to ${reason.toLowerCase() || 'lack of efficacy or adverse effects'}.`,
      protocol: `Cross-taper over 1 to 4 weeks. \n\n1. Initiate Risperidone at 1-2mg/day.\n2. Gradually decrease Aripiprazole dose by 25-50% every 1-2 weeks.\n3. Titrate Risperidone up to target therapeutic dose while completing the Aripiprazole taper.\n\nCaution: Aripiprazole has a very long half-life (75 hours).`,
      monitoring: [
        "Extrapyramidal symptoms (EPS) and tardive dyskinesia",
        "Prolactin elevation",
        "Rebound psychosis during cross-taper"
      ],
      references: ["Practice Guideline for the Treatment of Patients With Schizophrenia, 3rd Ed (2020) - American Psychiatric Association"]
    };
  }

  // --- INTRA-CLASS SWITCHES (DYNAMIC) ---

  // A. Statins
  if (from in statinEquivalents && to in statinEquivalents) {
    const fromEq = statinEquivalents[from];
    const toEq = statinEquivalents[to];
    const targetDose = isNaN(dose) ? `Calculate: (Current Dose / ${fromEq}) * ${toEq} mg` : `${Math.round((dose / fromEq) * toEq)}mg`;
    
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Intra-class statin switch. Equivalent dosing is based on standard lipid-lowering efficacy ratios.`,
      protocol: `Standard Direct Switch:\n1. Stop ${req.fromDrug} today.\n2. Start ${req.toDrug} tomorrow at the equivalent dose (${targetDose}).\n\nStep-wise Protocol (If history of Statin Intolerance/SAMS):\n1. Discontinue ${req.fromDrug} and observe a 2-4 week washout until muscle symptoms resolve.\n2. Initiate ${req.toDrug} at the lowest available dose (e.g., Rosuvastatin 5mg or Pravastatin 10mg).\n3. Re-evaluate in 4-6 weeks and gradually titrate dose upwards to achieve LDL-C goals.`,
      monitoring: [
        "Lipid panel (fasting) in 4-12 weeks",
        "Creatine kinase (CK) if muscle symptoms occur",
        "Hepatic transaminases (if clinically indicated)"
      ],
      references: ["2018 AHA/ACC/AACVPR/AAPA/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on the Management of Blood Cholesterol"]
    };
  }

  // B. Opioids
  if (from in opioidMME && to in opioidMME) {
    const fromMME = opioidMME[from];
    const toMME = opioidMME[to];
    
    let targetDoseStr = "";
    if (isNaN(dose)) {
      targetDoseStr = `Calculate: (Current Dose * ${fromMME}) / ${toMME} mg`;
    } else {
      const rawTargetDose = (dose * fromMME) / toMME;
      const reducedTargetDose = rawTargetDose * 0.75; // 25% reduction for cross-tolerance
      targetDoseStr = `${rawTargetDose.toFixed(1)}mg (Equianalgesic). Target starting dose after 25% cross-tolerance reduction: ${reducedTargetDose.toFixed(1)}mg`;
    }

    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Opioid rotation/conversion. MME conversion factor for ${req.fromDrug} is ${fromMME}, and for ${req.toDrug} is ${toMME}.`,
      protocol: `1. Calculate equianalgesic dose: ${targetDoseStr} daily.\n2. CRITICAL: Reduce the calculated equianalgesic dose by 25-50% to account for incomplete cross-tolerance between opioids, unless the patient is experiencing severe uncontrolled pain.\n3. Divide the total daily dose according to the specific formulation (e.g., Q4H for IR, Q12H for ER).`,
      monitoring: [
        "Signs of opioid withdrawal (if dose reduced too much)",
        "Oversedation and respiratory depression (if cross-tolerance is less than expected)",
        "Pain control efficacy and bowel regimen"
      ],
      references: [
        "CDC Clinical Practice Guideline for Prescribing Opioids for Pain",
        "Equianalgesic Dosing Guidelines (McPherson)"
      ]
    };
  }

  // C. SSRIs
  if (from in ssriEquivalents && to in ssriEquivalents) {
    const fromEq = ssriEquivalents[from];
    const toEq = ssriEquivalents[to];
    const targetDose = isNaN(dose) ? `Calculate: (Current Dose / ${fromEq}) * ${toEq} mg` : `${Math.round((dose / fromEq) * toEq)}mg`;

    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Intra-class SSRI switch due to ${reason.toLowerCase() || 'clinical indications'}.`,
      protocol: `Step-wise Cross-Taper Protocol (Preferred for sensitive patients or high doses):\n\nWeek 1:\n- Reduce ${req.fromDrug} dose by 50%.\n- Initiate ${req.toDrug} at 50% of the calculated equivalent dose (${targetDose}).\n\nWeek 2:\n- Discontinue ${req.fromDrug} completely.\n- Increase ${req.toDrug} to the full target dose (${targetDose}).\n\nAlternative (Direct Switch):\nStop ${req.fromDrug} and start ${req.toDrug} at the equivalent dose (${targetDose}) the next day. (Caution if switching from paroxetine due to withdrawal risk, or from fluoxetine due to long half-life).`,
      monitoring: [
        "Serotonin syndrome", 
        "Discontinuation syndrome (especially if stopping paroxetine)", 
        "Efficacy of new agent"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // D. SNRIs
  if (from in snriEquivalents && to in snriEquivalents) {
    const fromEq = snriEquivalents[from];
    const toEq = snriEquivalents[to];
    const targetDose = isNaN(dose) ? `Calculate: (Current Dose / ${fromEq}) * ${toEq} mg` : `${Math.round((dose / fromEq) * toEq)}mg`;

    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Intra-class SNRI switch due to ${reason.toLowerCase() || 'clinical indications'}.`,
      protocol: `Step-wise Cross-Taper Protocol (Highly recommended due to severe SNRI withdrawal risks):\n\nWeek 1-2:\n- Reduce ${req.fromDrug} dose by 25-50%.\n- Initiate ${req.toDrug} at its lowest starting dose.\n\nWeek 3-4:\n- Discontinue ${req.fromDrug} completely.\n- Titrate ${req.toDrug} to the calculated equivalent dose (${targetDose}).\n\nAlternative (Direct Switch for low doses only):\nStop ${req.fromDrug} and start ${req.toDrug} at an equivalent dose the next day.`,
      monitoring: [
        "Blood pressure",
        "SNRI discontinuation syndrome (brain zaps, dizziness, nausea)",
        "Efficacy of new agent"
      ],
      references: [
        "CANMAT 2023 Update on Clinical Guidelines for Management of Major Depressive Disorder in Adults"
      ]
    };
  }

  // E. Antipsychotics
  if (from in antipsychoticEquivalents && to in antipsychoticEquivalents && !(from === 'aripiprazole' && to === 'risperidone')) {
    const fromEq = antipsychoticEquivalents[from];
    const toEq = antipsychoticEquivalents[to];
    const targetDose = isNaN(dose) ? `Calculate: (Current Dose / ${fromEq}) * ${toEq} mg` : `${Math.round((dose / fromEq) * toEq)}mg`;

    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Antipsychotic switch due to ${reason.toLowerCase() || 'lack of efficacy or adverse effects'}.`,
      protocol: `Cross-taper over 1 to 4 weeks (Plateau Cross-Taper method is generally preferred). \n\n1. Initiate ${req.toDrug} at a low dose.\n2. Gradually decrease ${req.fromDrug} dose by 25-50% every 1-2 weeks.\n3. Titrate ${req.toDrug} up to target therapeutic dose while completing the ${req.fromDrug} taper. \n\nEstimated equivalent target dose: ${req.toDrug} ${targetDose}.`,
      monitoring: [
        "Rebound psychosis or agitation during cross-taper",
        "Extrapyramidal symptoms (EPS)",
        "Metabolic parameters (weight, glucose, lipids) - especially if switching to/from Olanzapine or Quetiapine",
        "QTc prolongation"
      ],
      references: [
        "Practice Guideline for the Treatment of Patients With Schizophrenia, 3rd Ed (2020) - American Psychiatric Association",
        "BAP guidelines on the management of weight gain, metabolic disturbances and cardiovascular risk associated with psychosis and antipsychotic drug treatment (Cooper SJ, et al. 2016)"
      ]
    };
  }

  // F. Biologics
  const isFromBiologic = ['Biologics (TNF inhibitors)', 'Biologics (IL inhibitors)', 'Biologics (Integrin/Other)'].some(c => drugClasses[c as keyof typeof drugClasses]?.includes(from));
  const isToBiologic = ['Biologics (TNF inhibitors)', 'Biologics (IL inhibitors)', 'Biologics (Integrin/Other)'].some(c => drugClasses[c as keyof typeof drugClasses]?.includes(to));
  
  if (isFromBiologic && isToBiologic) {
    return {
      fromDrug: req.fromDrug,
      toDrug: req.toDrug,
      rationale: `Biologic switch due to ${reason.toLowerCase() || 'clinical indications'}.`,
      protocol: `Direct Switch (No Washout Period Required): \n\n1. Discontinue ${req.fromDrug}.\n2. Initiate ${req.toDrug} at the time the next dose of ${req.fromDrug} would have been due.\n3. Administer loading doses of ${req.toDrug} as per standard induction protocol for the specific indication.\n\nNote: If switching due to severe adverse event (e.g., severe infection), a washout period may be considered until the event resolves.`,
      monitoring: [
        "Monitor for disease flare during the transition period.",
        "Monitor for infection risk, especially if switching due to previous infection.",
        "Assess clinical response at 12-16 weeks post-induction."
      ],
      references: [
        "American College of Rheumatology (ACR) Guidelines",
        "American Gastroenterological Association (AGA) Guidelines"
      ]
    };
  }

  return null;
}

export type ReplacementSuggestion = {
  drug: string;
  score: number;
  rationale: string[];
  protocol: SwitchResponse;
  warnings?: string[];
};

export function suggestReplacements(req: {
  fromDrug: string;
  currentDose: string;
  duration: string;
  reason: string;
  secondaryEffect: string;
  indication?: string;
  patientContext?: {
    age: string;
    weight: string;
    renalFunction: string;
    hepaticFunction: string;
    comorbidities: string;
    infectionHistory?: string;
    otherMedications: string;
    cyp2d6Status?: string;
  };
}): ReplacementSuggestion[] {
  const { fromDrug, currentDose, duration, reason, secondaryEffect, indication, patientContext } = req;
  const fromProfile = getDrugProfile(fromDrug);
  if (!fromProfile) return [];

  // Determine broad category to keep suggestions within the same general indication
  const fromClass = Object.keys(drugClasses).find(c => drugClasses[c as keyof typeof drugClasses]?.includes(fromDrug.toLowerCase()));
  
  const isAntidepressant = ['SSRIs', 'SNRIs', 'Atypicals / Others', 'TCAs', 'MAOIs', 'Novel / Other Antidepressants'].includes(fromClass || '');
  const isAntipsychotic = ['Antipsychotics (Atypical)', 'Antipsychotics (Typical)'].includes(fromClass || '');
  const isStatin = fromClass === 'Statins';
  const isBiologic = ['Biologics (TNF inhibitors)', 'Biologics (IL inhibitors)', 'Biologics (Integrin/Other)'].includes(fromClass || '');
  const isAntidiabetic = fromClass === 'Antidiabetics';
  const isAntihypertensive = ['Antihypertensives (ACE inhibitors)', 'Antihypertensives (ARBs)', 'Antihypertensives (Beta-blockers)'].includes(fromClass || '');
  const isAnticoagulant = fromClass === 'Anticoagulants';
  const isMoodStabilizer = fromClass === 'Mood Stabilizers / Anticonvulsants';

  const allDrugs = Object.keys(drugClasses).flatMap(c => drugClasses[c as keyof typeof drugClasses]);
  
  let candidates = allDrugs.filter(d => d !== fromDrug.toLowerCase());

  // Filter by broad category to prevent absurd cross-class suggestions
  if (isAntidepressant) {
    candidates = candidates.filter(d => ['SSRIs', 'SNRIs', 'Atypicals / Others', 'TCAs', 'Novel / Other Antidepressants'].some(c => drugClasses[c as keyof typeof drugClasses]?.includes(d)));
  } else if (isAntipsychotic) {
    candidates = candidates.filter(d => ['Antipsychotics (Atypical)', 'Antipsychotics (Typical)'].some(c => drugClasses[c as keyof typeof drugClasses]?.includes(d)));
  } else if (isStatin) {
    candidates = candidates.filter(d => drugClasses['Statins']?.includes(d));
  } else if (isAntidiabetic) {
    candidates = candidates.filter(d => drugClasses['Antidiabetics']?.includes(d));
  } else if (isAntihypertensive) {
    candidates = candidates.filter(d => ['Antihypertensives (ACE inhibitors)', 'Antihypertensives (ARBs)', 'Antihypertensives (Beta-blockers)'].some(c => drugClasses[c as keyof typeof drugClasses]?.includes(d)));
  } else if (isAnticoagulant) {
    candidates = candidates.filter(d => drugClasses['Anticoagulants']?.includes(d));
  } else if (isMoodStabilizer) {
    candidates = candidates.filter(d => drugClasses['Mood Stabilizers / Anticonvulsants']?.includes(d));
  } else if (isBiologic) {
    // For biologics, only suggest other biologics that are approved for the SAME indication
    candidates = candidates.filter(d => {
      const isBio = ['Biologics (TNF inhibitors)', 'Biologics (IL inhibitors)', 'Biologics (Integrin/Other)'].some(c => drugClasses[c as keyof typeof drugClasses]?.includes(d));
      if (!isBio) return false;
      
      // If a specific indication was provided, strictly filter by it
      if (indication) {
        return biologicIndications[d]?.indications.includes(indication);
      }
      
      return true;
    });
  }

  // Score candidates based on reason, secondary effect, and patient context
  const scoredCandidates = candidates.map(drugName => {
    const profile = getDrugProfile(drugName);
    if (!profile) return { drug: drugName, score: -1, rationale: [] as string[] };

    let score = 0;
    let rationaleParts: string[] = [];

    // Reason logic
    if (reason.includes('Weight Gain') && (profile.weightGain === 'Low' || profile.weightGain === 'Minimal')) {
      score += 5;
      rationaleParts.push('lower risk of weight gain');
    } else if (reason.includes('Sexual Dysfunction') && (profile.sexualDysfunction === 'Low' || profile.sexualDysfunction === 'Minimal')) {
      score += 5;
      rationaleParts.push('lower risk of sexual dysfunction');
    } else if (reason.includes('Sedation') && (profile.sedation === 'Low' || profile.sedation === 'Minimal')) {
      score += 5;
      rationaleParts.push('less sedating');
    } else if (reason.includes('Insomnia') && (profile.insomnia === 'Low' || profile.insomnia === 'Minimal')) {
      score += 5;
      rationaleParts.push('lower risk of insomnia');
    } else if (reason.includes('GI Upset') && (profile.giUpset === 'Low' || profile.giUpset === 'Minimal')) {
      score += 5;
      rationaleParts.push('better GI tolerability');
    } else if (reason.includes('Anticholinergic') && (profile.anticholinergic === 'Low' || profile.anticholinergic === 'Minimal')) {
      score += 5;
      rationaleParts.push('lower anticholinergic burden');
    }

    // Secondary effect logic
    if (secondaryEffect === 'weight_loss' && (profile.weightGain === 'Low' || profile.weightGain === 'Minimal')) {
      score += 3;
      rationaleParts.push('weight neutral/favorable profile');
    } else if (secondaryEffect === 'improved_sleep' && (profile.sedation === 'Moderate' || profile.sedation === 'High')) {
      score += 3;
      rationaleParts.push('sedating properties may aid sleep');
    } else if (secondaryEffect === 'activating' && (profile.sedation === 'Low' || profile.sedation === 'Minimal') && (profile.insomnia === 'Moderate' || profile.insomnia === 'High')) {
      score += 3;
      rationaleParts.push('activating properties');
    } else if (secondaryEffect === 'low_sexual_se' && (profile.sexualDysfunction === 'Low' || profile.sexualDysfunction === 'Minimal')) {
      score += 3;
      rationaleParts.push('favorable sexual side effect profile');
    }

    // If it's just lack of efficacy, prefer a different class if possible, or just a standard alternative
    if (reason === 'Lack of Efficacy') {
      score += 1;
      rationaleParts.push('alternative option for lack of efficacy');
    }

    // Biologic-specific logic
    if (isBiologic) {
      const toClass = Object.keys(drugClasses).find(c => drugClasses[c as keyof typeof drugClasses]?.includes(drugName.toLowerCase()));
      
      const isToTNF = toClass === 'Biologics (TNF inhibitors)';
      const isToIL = toClass === 'Biologics (IL inhibitors)';
      const isToIntegrin = toClass === 'Biologics (Integrin/Other)';

      // TNF to IL specific logic
      if (fromClass === 'Biologics (TNF inhibitors)' && isToIL) {
        score += 2;
        rationaleParts.push('IL inhibitor class often preferred after TNF inhibitor failure/intolerance');
      }

      if (reason === 'Primary Non-response') {
        if (fromClass !== toClass) {
          score += 5;
          let specificRationale = 'different mechanism of action preferred for primary non-response';
          if (fromClass === 'Biologics (TNF inhibitors)' && isToIL) {
             specificRationale = 'Switching to an IL inhibitor is preferred after primary non-response to a TNF inhibitor due to differing inflammatory pathways';
          } else if (fromClass === 'Biologics (IL inhibitors)' && isToTNF) {
             specificRationale = 'Switching to a TNF inhibitor provides a distinct mechanism of action after primary non-response to an IL inhibitor';
          } else if (isToIntegrin) {
             specificRationale = 'Integrin inhibitors offer a targeted alternative mechanism after primary non-response to systemic biologics';
          }
          rationaleParts.push(specificRationale);
        } else {
          score -= 2; // Penalize same class for primary non-response
        }
      } else if (reason === 'Secondary Loss of Response') {
        if (fromClass === toClass) {
          score += 3;
          rationaleParts.push(`cycling to another ${toClass?.replace('Biologics (', '').replace(')', '')} is effective for secondary loss of response (often due to immunogenicity)`);
        } else {
          score += 2;
          rationaleParts.push('alternative mechanism of action can recapture response after secondary failure');
        }
      } else if (reason === 'Adverse Effect: Infection Risk') {
        if (drugName.toLowerCase() === 'vedolizumab' && (indication === "Crohn's Disease" || indication === "Ulcerative Colitis")) {
          score += 6;
          rationaleParts.push('gut-selective mechanism (α4β7 integrin inhibitor) significantly lowers systemic immunosuppression and infection risk');
        } else if (isToIL) {
          score += 4;
          rationaleParts.push('IL inhibitors generally demonstrate a more favorable systemic infection risk profile compared to TNF inhibitors');
        } else if (!isToTNF) {
          score += 3;
          rationaleParts.push('non-TNF inhibitor option preferred to minimize broad immunosuppression');
        }
      }

      // Infection history logic
      const hasInfectionHistory = patientContext?.infectionHistory === 'Yes' ||
        patientContext?.comorbidities.toLowerCase().includes('infection') ||
        patientContext?.comorbidities.toLowerCase().includes('tb') ||
        patientContext?.comorbidities.toLowerCase().includes('tuberculosis');

      if (hasInfectionHistory) {
        if (isToTNF) {
          score -= 6;
          rationaleParts.push('caution: TNF inhibitors carry higher risk of serious infections/reactivation');
        } else if (isToIL) {
          score += 3;
          rationaleParts.push('favorable: IL inhibitors generally have lower serious infection risk than TNF inhibitors');
        } else if (isToIntegrin && (indication === "Crohn's Disease" || indication === "Ulcerative Colitis")) {
          score += 5;
          rationaleParts.push('favorable: gut-selective mechanism minimizes systemic immunosuppression');
        }
      }
    }

    // Patient Context Logic
    if (patientContext) {
      const ageNum = parseInt(patientContext.age);
      if (!isNaN(ageNum) && ageNum >= 65) {
        // Elderly patients: penalize high anticholinergic, high sedation, high CNS effects
        if (profile.anticholinergic === 'High' || profile.anticholinergic === 'Moderate') {
          score -= 3;
        } else if (profile.anticholinergic === 'Low' || profile.anticholinergic === 'Minimal') {
          score += 2;
          rationaleParts.push('favorable in elderly (low anticholinergic)');
        }
        if (profile.sedation === 'High') {
          score -= 2;
        }
      }

      if (patientContext.renalFunction.includes('Impairment') || patientContext.renalFunction.includes('ESRD')) {
        // Generic penalty/bonus for renal impairment (would need specific DB flags for perfection, but we can add generic rationale)
        rationaleParts.push('requires renal dose adjustment review');
      }

      if (patientContext.hepaticFunction.includes('Impairment')) {
        rationaleParts.push('requires hepatic dose adjustment review');
      }

      const comorbiditiesLower = patientContext.comorbidities.toLowerCase();
      if (comorbiditiesLower.includes('diabetes') || comorbiditiesLower.includes('obesity')) {
        if (profile.metabolic === 'High' || profile.weightGain === 'High') {
          score -= 4;
        } else if (profile.metabolic === 'Low' || profile.metabolic === 'Minimal') {
          score += 2;
          rationaleParts.push('metabolically favorable for comorbidities');
        }
      }
      
      if (comorbiditiesLower.includes('cardiac') || comorbiditiesLower.includes('arrhythmia') || comorbiditiesLower.includes('qt')) {
        if (profile.qtcProlongation === 'High') {
          score -= 5;
        } else if (profile.qtcProlongation === 'Low' || profile.qtcProlongation === 'Minimal') {
          score += 2;
          rationaleParts.push('favorable QTc profile');
        }
      }

      // Pharmacogenomics Logic
      if (patientContext.cyp2d6Status && patientContext.cyp2d6Status !== 'Unknown' && patientContext.cyp2d6Status !== 'Normal') {
        const status = patientContext.cyp2d6Status;
        const drugLower = drugName.toLowerCase();
        const cyp2d6Substrates = ['fluoxetine', 'paroxetine', 'venlafaxine', 'nortriptyline', 'amitriptyline', 'aripiprazole', 'risperidone', 'haloperidol', 'duloxetine'];
        
        if (status === 'Poor') {
          if (cyp2d6Substrates.includes(drugLower)) {
            score -= 6;
            rationaleParts.push('caution: major CYP2D6 substrate in poor metabolizer (increased toxicity risk)');
          } else {
            score += 2;
            rationaleParts.push('favorable: not highly dependent on CYP2D6');
          }
        } else if (status === 'Intermediate') {
          if (cyp2d6Substrates.includes(drugLower)) {
            score -= 2;
            rationaleParts.push('caution: major CYP2D6 substrate in intermediate metabolizer (may require dose adjustment)');
          }
        } else if (status === 'Ultrarapid') {
          if (cyp2d6Substrates.includes(drugLower)) {
            score -= 5;
            rationaleParts.push('caution: potential for subtherapeutic levels due to ultrarapid CYP2D6 metabolism');
          } else {
            score += 2;
            rationaleParts.push('favorable: not highly dependent on CYP2D6');
          }
        }
      }
    }

    return {
      drug: profile.name,
      score,
      rationale: rationaleParts
    };
  }).filter(c => c.score > 0);

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Return all valid candidates so the client can filter and slice
  const topCandidates = scoredCandidates;

  const suggestions: ReplacementSuggestion[] = [];
  for (const candidate of topCandidates) {
    let protocol = getSwitchingProtocol({
      fromDrug,
      currentDose,
      duration,
      toDrug: candidate.drug,
      reason
    });
    
    if (!protocol) {
      protocol = {
        fromDrug,
        toDrug: candidate.drug,
        rationale: `General switch from ${fromDrug} to ${candidate.drug}.`,
        protocol: `Cross-taper over 1 to 4 weeks. \n\n1. Initiate ${candidate.drug} at a low starting dose.\n2. Gradually decrease ${fromDrug} dose by 25-50% every 1-2 weeks.\n3. Titrate ${candidate.drug} up to target therapeutic dose while completing the ${fromDrug} taper.`,
        monitoring: [
          "Monitor for withdrawal symptoms from the discontinued medication.",
          "Monitor for adverse effects of the new medication.",
          "Assess clinical response and adjust dose as needed."
        ],
        references: [
          "General principles of medication switching. Consult specific drug monographs for detailed guidance."
        ]
      };
    }
    
    const warnings: string[] = [];
    if (patientContext) {
      const candidateKey = candidate.drug.toLowerCase();
      const monograph = monographs[candidateKey];
      if (monograph && monograph.contraindications) {
        const contextText = `${patientContext.comorbidities} ${patientContext.otherMedications}`.toLowerCase();
        
        // Simple keyword matching for contraindications
        monograph.contraindications.forEach(contra => {
          const contraLower = contra.toLowerCase();
          // Extract key terms from contraindication (e.g., "MAOI", "Pimozide", "Seizure")
          const keyTerms = contraLower.split(/[\s,()]+/).filter(t => t.length > 3 && !['concurrent', 'use', 'with', 'history', 'prior', 'current', 'diagnosis'].includes(t));
          
          for (const term of keyTerms) {
            if (contextText.includes(term)) {
              warnings.push(`Contraindication match: ${contra}`);
              break; // Only add the warning once per contraindication
            }
          }
        });
      }
    }

    suggestions.push({
      drug: candidate.drug,
      score: candidate.score,
      rationale: candidate.rationale,
      protocol,
      warnings: warnings.length > 0 ? warnings : undefined
    });
  }

  return suggestions;
}
