export interface DrugMonograph {
  indications: string[];
  contraindications: string[];
  mechanismOfAction: string;
  pharmacokinetics: {
    halfLife: string;
    metabolism: string;
    excretion: string;
  };
  sideEffectsManagement: {
    effect: string;
    management: string;
  }[];
}

export const monographs: Record<string, DrugMonograph> = {
  'fluoxetine': {
    indications: ['Major Depressive Disorder (MDD)', 'Obsessive Compulsive Disorder (OCD)', 'Bulimia Nervosa', 'Panic Disorder'],
    contraindications: ['Concurrent use with MAOIs', 'Concurrent use with Pimozide or Thioridazine'],
    mechanismOfAction: 'Selective Serotonin Reuptake Inhibitor (SSRI). Exact mechanism presumed to be linked to potentiation of serotonergic activity in the central nervous system resulting from its inhibition of CNS neuronal reuptake of serotonin (5-HT).',
    pharmacokinetics: {
      halfLife: '1 to 3 days (acute), 4 to 6 days (chronic); Active metabolite norfluoxetine: 4 to 16 days',
      metabolism: 'Hepatic via CYP2D6 (potent inhibitor)',
      excretion: 'Urine (primarily as metabolites)'
    },
    sideEffectsManagement: [
      { effect: 'Insomnia', management: 'Dose in the morning. Consider adding a sleep aid if persistent.' },
      { effect: 'Nausea', management: 'Take with food. Usually transient.' },
      { effect: 'Sexual Dysfunction', management: 'Consider dose reduction, drug holiday, or switching to/adding a non-serotonergic agent like bupropion.' }
    ]
  },
  'sertraline': {
    indications: ['Major Depressive Disorder (MDD)', 'Obsessive Compulsive Disorder (OCD)', 'Panic Disorder', 'PTSD', 'Social Anxiety Disorder (SAD)', 'Premenstrual Dysphoric Disorder (PMDD)'],
    contraindications: ['Concurrent MAOI use', 'Concurrent Pimozide use', 'Disulfiram (for oral concentrate due to alcohol content)'],
    mechanismOfAction: 'Selective Serotonin Reuptake Inhibitor (SSRI). Potentiates serotonergic activity in the CNS by inhibiting neuronal reuptake of serotonin.',
    pharmacokinetics: {
      halfLife: 'Approximately 26 hours',
      metabolism: 'Hepatic, primarily CYP3A4, CYP2C19, CYP2D6',
      excretion: 'Urine and feces'
    },
    sideEffectsManagement: [
      { effect: 'Diarrhea', management: 'Take with food. Ensure adequate hydration. Usually resolves within 1-2 weeks.' },
      { effect: 'Sexual Dysfunction', management: 'Dose reduction or adjunctive therapy (e.g., bupropion, sildenafil).' }
    ]
  },
  'escitalopram': {
    indications: ['Major Depressive Disorder (MDD)', 'Generalized Anxiety Disorder (GAD)'],
    contraindications: ['Concurrent MAOI use', 'Concurrent Pimozide use'],
    mechanismOfAction: 'Selective Serotonin Reuptake Inhibitor (SSRI). S-enantiomer of citalopram.',
    pharmacokinetics: {
      halfLife: '27-32 hours',
      metabolism: 'Hepatic via CYP3A4 and CYP2C19',
      excretion: 'Urine'
    },
    sideEffectsManagement: [
      { effect: 'Nausea', management: 'Take with food. Usually transient.' },
      { effect: 'QTc Prolongation', management: 'Monitor ECG in patients with risk factors. Maximum dose is 10mg/day in elderly patients.' }
    ]
  },
  'citalopram': {
    indications: ['Major Depressive Disorder (MDD)'],
    contraindications: ['Concurrent MAOI use', 'Concurrent Pimozide use'],
    mechanismOfAction: 'Selective Serotonin Reuptake Inhibitor (SSRI). Potentiates serotonergic activity in the CNS by inhibiting neuronal reuptake of serotonin.',
    pharmacokinetics: {
      halfLife: '35 hours',
      metabolism: 'Hepatic via CYP3A4, CYP2C19, and CYP2D6',
      excretion: 'Urine and feces'
    },
    sideEffectsManagement: [
      { effect: 'QTc Prolongation', management: 'Dose-dependent risk. Maximum dose is 40mg/day (20mg/day in elderly, hepatic impairment, or poor CYP2C19 metabolizers). Monitor ECG.' },
      { effect: 'Sexual Dysfunction', management: 'Consider dose reduction or switching to/adding a non-serotonergic agent like bupropion.' }
    ]
  },
  'venlafaxine': {
    indications: ['Major Depressive Disorder (MDD)', 'Generalized Anxiety Disorder (GAD)', 'Social Anxiety Disorder (SAD)', 'Panic Disorder'],
    contraindications: ['Concurrent MAOI use'],
    mechanismOfAction: 'Serotonin and Norepinephrine Reuptake Inhibitor (SNRI).',
    pharmacokinetics: {
      halfLife: '5 hours (parent), 11 hours (active metabolite ODV)',
      metabolism: 'Hepatic via CYP2D6',
      excretion: 'Urine'
    },
    sideEffectsManagement: [
      { effect: 'Hypertension', management: 'Monitor blood pressure regularly. Consider dose reduction or antihypertensive therapy if elevated.' },
      { effect: 'Discontinuation Syndrome', management: 'Taper slowly over weeks to months. Do not stop abruptly.' }
    ]
  },
  'bupropion': {
    indications: ['Major Depressive Disorder (MDD)', 'Seasonal Affective Disorder', 'Smoking Cessation'],
    contraindications: ['Seizure disorder', 'Current or prior diagnosis of bulimia or anorexia nervosa', 'Abrupt discontinuation of alcohol, benzodiazepines, barbiturates, or antiepileptic drugs', 'Concurrent MAOI use'],
    mechanismOfAction: 'Norepinephrine-Dopamine Reuptake Inhibitor (NDRI).',
    pharmacokinetics: {
      halfLife: '21 hours',
      metabolism: 'Hepatic via CYP2B6',
      excretion: 'Urine'
    },
    sideEffectsManagement: [
      { effect: 'Insomnia', management: 'Avoid dosing near bedtime.' },
      { effect: 'Seizures', management: 'Strictly adhere to maximum daily and single-dose limits. Avoid in high-risk patients.' }
    ]
  },
  'lithium': {
    indications: ['Bipolar Disorder (acute mania and maintenance)'],
    contraindications: ['Severe cardiovascular or renal disease', 'Severe dehydration or sodium depletion'],
    mechanismOfAction: 'Exact mechanism unknown. Alters sodium transport across cell membranes in nerve and muscle cells.',
    pharmacokinetics: {
      halfLife: '18-36 hours',
      metabolism: 'Not metabolized',
      excretion: 'Renal (100%)'
    },
    sideEffectsManagement: [
      { effect: 'Tremor', management: 'Consider dose reduction, switch to extended-release formulation, or add a beta-blocker (e.g., propranolol).' },
      { effect: 'Polyuria/Polydipsia', management: 'Monitor renal function. Consider amiloride if nephrogenic diabetes insipidus develops.' },
      { effect: 'Hypothyroidism', management: 'Monitor TSH. Supplement with levothyroxine if needed.' }
    ]
  },
  'quetiapine': {
    indications: ['Schizophrenia', 'Bipolar I Disorder (mania)', 'Bipolar Disorder (depression)', 'Major Depressive Disorder (adjunctive)'],
    contraindications: ['Known hypersensitivity'],
    mechanismOfAction: 'Atypical antipsychotic. Antagonist at multiple neurotransmitter receptors including serotonin 5-HT1A and 5-HT2, dopamine D1 and D2, histamine H1, and adrenergic alpha-1 and alpha-2 receptors.',
    pharmacokinetics: {
      halfLife: '6 hours (parent), 12 hours (active metabolite)',
      metabolism: 'Hepatic via CYP3A4',
      excretion: 'Urine and feces'
    },
    sideEffectsManagement: [
      { effect: 'Sedation', management: 'Dose at bedtime. Often improves with tolerance.' },
      { effect: 'Metabolic Syndrome', management: 'Monitor weight, BMI, fasting glucose, and lipids regularly. Encourage diet and exercise.' }
    ]
  },
  'aripiprazole': {
    indications: ['Schizophrenia', 'Bipolar I Disorder', 'Major Depressive Disorder (adjunctive)', 'Irritability associated with Autistic Disorder', 'Tourette\'s Disorder'],
    contraindications: ['Known hypersensitivity'],
    mechanismOfAction: 'Atypical antipsychotic. Partial agonist at dopamine D2 and serotonin 5-HT1A receptors, and antagonist at serotonin 5-HT2A receptors.',
    pharmacokinetics: {
      halfLife: '75 hours (parent), 94 hours (active metabolite)',
      metabolism: 'Hepatic via CYP2D6 and CYP3A4',
      excretion: 'Feces and urine'
    },
    sideEffectsManagement: [
      { effect: 'Akathisia', management: 'Consider dose reduction, or add a beta-blocker (propranolol) or anticholinergic agent.' },
      { effect: 'Insomnia', management: 'Dose in the morning if activating.' }
    ]
  },
  'adalimumab': {
    indications: ['Rheumatoid Arthritis', 'Crohn\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis', 'Hidradenitis Suppurativa'],
    contraindications: ['Active severe infections', 'Concurrent administration of live vaccines'],
    mechanismOfAction: 'Recombinant human IgG1 monoclonal antibody specific for human tumor necrosis factor (TNF).',
    pharmacokinetics: {
      halfLife: '10 to 20 days',
      metabolism: 'Degraded into small peptides and amino acids via catabolic pathways',
      excretion: 'Not applicable (monoclonal antibody)'
    },
    sideEffectsManagement: [
      { effect: 'Injection Site Reactions', management: 'Rotate injection sites. Apply cold compress. Usually mild and transient.' },
      { effect: 'Infections', management: 'Screen for TB and Hepatitis B before starting. Withhold during active infections.' }
    ]
  },
  'infliximab': {
    indications: ['Rheumatoid Arthritis', 'Crohn\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'],
    contraindications: ['Moderate to severe heart failure (doses >5mg/kg)', 'Active severe infections'],
    mechanismOfAction: 'Chimeric IgG1k monoclonal antibody that binds specifically to human tumor necrosis factor alpha (TNF-alpha).',
    pharmacokinetics: {
      halfLife: '7 to 12 days',
      metabolism: 'Degraded into small peptides and amino acids',
      excretion: 'Not applicable'
    },
    sideEffectsManagement: [
      { effect: 'Infusion Reactions', management: 'Pre-medicate with antihistamines and acetaminophen. Slow infusion rate.' },
      { effect: 'Infections', management: 'Screen for TB and Hepatitis B before starting. Withhold during active infections.' }
    ]
  },
  'ustekinumab': {
    indications: ['Crohn\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis'],
    contraindications: ['Clinically significant hypersensitivity to ustekinumab'],
    mechanismOfAction: 'Human IgG1k monoclonal antibody that binds with specificity to the p40 protein subunit used by both the IL-12 and IL-23 cytokines.',
    pharmacokinetics: {
      halfLife: '14.9 to 45.6 days',
      metabolism: 'Degraded into small peptides and amino acids',
      excretion: 'Not applicable'
    },
    sideEffectsManagement: [
      { effect: 'Infections', management: 'Screen for TB before starting. Monitor for signs of infection.' },
      { effect: 'Nasopharyngitis', management: 'Symptomatic treatment. Usually mild.' }
    ]
  },
  'vedolizumab': {
    indications: ['Crohn\'s Disease', 'Ulcerative Colitis'],
    contraindications: ['Known serious or severe hypersensitivity to vedolizumab'],
    mechanismOfAction: 'Humanized monoclonal antibody that specifically binds to the alpha4beta7 integrin and blocks the interaction of alpha4beta7 integrin with mucosal addressin cell adhesion molecule-1 (MAdCAM-1).',
    pharmacokinetics: {
      halfLife: '25.5 days',
      metabolism: 'Degraded into small peptides and amino acids',
      excretion: 'Not applicable'
    },
    sideEffectsManagement: [
      { effect: 'Infusion Reactions', management: 'Monitor during and after infusion. Treat symptoms as they arise.' },
      { effect: 'Nasopharyngitis / Headache', management: 'Symptomatic treatment. Usually mild.' }
    ]
  }
};
