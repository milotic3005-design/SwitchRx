export type SideEffectLevel = 'Low' | 'Moderate' | 'High' | 'Minimal' | 'N/A' | 'Unknown';

export interface DrugProfile {
  name: string;
  brandNames?: string[];
  biosimilars?: string[];
  weightGain: SideEffectLevel;
  sedation: SideEffectLevel;
  sexualDysfunction: SideEffectLevel;
  qtcProlongation: SideEffectLevel;
  insomnia: SideEffectLevel;
  giUpset: SideEffectLevel;
  metabolic: SideEffectLevel;
  anticholinergic: SideEffectLevel;
  cns: SideEffectLevel;
  availableDoses: number[];
}

export const drugClasses = {
  'SSRIs': ['citalopram', 'escitalopram', 'fluoxetine', 'sertraline', 'paroxetine', 'fluvoxamine'],
  'SNRIs': ['venlafaxine', 'duloxetine', 'desvenlafaxine', 'levomilnacipran', 'milnacipran'],
  'Atypicals / Others': ['bupropion', 'mirtazapine', 'trazodone', 'vortioxetine', 'vilazodone'],
  'TCAs': ['amitriptyline', 'nortriptyline', 'imipramine', 'desipramine', 'clomipramine', 'doxepin', 'protriptyline', 'trimipramine', 'amoxapine', 'maprotiline'],
  'MAOIs': ['phenelzine', 'tranylcypromine', 'isocarboxazid', 'moclobemide', 'selegiline'],
  'Novel / Other Antidepressants': ['nefazodone', 'agomelatine', 'reboxetine', 'esketamine', 'dextromethorphan-bupropion', 'gepirone'],
  'Antipsychotics (Atypical)': ['quetiapine', 'olanzapine', 'risperidone', 'aripiprazole', 'ziprasidone', 'lurasidone', 'paliperidone', 'clozapine', 'asenapine', 'iloperidone', 'cariprazine', 'brexpiprazole', 'lumateperone'],
  'Antipsychotics (Typical)': ['haloperidol', 'chlorpromazine', 'fluphenazine', 'perphenazine', 'loxapine', 'thioridazine', 'trifluoperazine', 'thiothixene', 'pimozide', 'flupentixol', 'zuclopenthixol'],
  'Mood Stabilizers / Anticonvulsants': ['lithium', 'valproate', 'lamotrigine', 'carbamazepine', 'oxcarbazepine', 'topiramate'],
  'Statins': ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin', 'fluvastatin', 'pitavastatin'],
  'Antidiabetics': ['metformin', 'glipizide', 'empagliflozin', 'semaglutide', 'sitagliptin'],
  'Antihypertensives (ACE inhibitors)': ['lisinopril', 'enalapril', 'ramipril'],
  'Antihypertensives (ARBs)': ['losartan', 'valsartan', 'irbesartan'],
  'Antihypertensives (Beta-blockers)': ['metoprolol', 'carvedilol', 'atenolol'],
  'Anticoagulants': ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran'],
  'Biologics (TNF inhibitors)': ['adalimumab', 'infliximab', 'etanercept', 'certolizumab', 'golimumab'],
  'Biologics (IL inhibitors)': ['ustekinumab', 'secukinumab', 'ixekizumab', 'risankizumab', 'guselkumab', 'tildrakizumab', 'brodalumab', 'bimekizumab', 'mirikizumab', 'sarilumab', 'anakinra', 'dupilumab', 'omalizumab', 'mepolizumab', 'benralizumab', 'reslizumab'],
  'Biologics (Integrin/Other)': ['vedolizumab', 'natalizumab', 'abatacept', 'tocilizumab', 'rituximab', 'ocrelizumab', 'ofatumumab', 'belimumab', 'anifrolumab']
};

export const biologicIndications: Record<string, { class: string, indications: string[] }> = {
  'adalimumab': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Crohn\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis', 'Hidradenitis Suppurativa'] },
  'infliximab': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Crohn\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'etanercept': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'certolizumab': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Crohn\'s Disease', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'golimumab': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Ulcerative Colitis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'ustekinumab': { class: 'Biologics (IL inhibitors)', indications: ['Crohn\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis'] },
  'secukinumab': { class: 'Biologics (IL inhibitors)', indications: ['Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'ixekizumab': { class: 'Biologics (IL inhibitors)', indications: ['Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'risankizumab': { class: 'Biologics (IL inhibitors)', indications: ['Crohn\'s Disease', 'Psoriasis', 'Psoriatic Arthritis'] },
  'guselkumab': { class: 'Biologics (IL inhibitors)', indications: ['Psoriasis', 'Psoriatic Arthritis'] },
  'tildrakizumab': { class: 'Biologics (IL inhibitors)', indications: ['Psoriasis'] },
  'brodalumab': { class: 'Biologics (IL inhibitors)', indications: ['Psoriasis'] },
  'bimekizumab': { class: 'Biologics (IL inhibitors)', indications: ['Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'mirikizumab': { class: 'Biologics (IL inhibitors)', indications: ['Ulcerative Colitis'] },
  'sarilumab': { class: 'Biologics (IL inhibitors)', indications: ['Rheumatoid Arthritis'] },
  'anakinra': { class: 'Biologics (IL inhibitors)', indications: ['Rheumatoid Arthritis'] },
  'dupilumab': { class: 'Biologics (IL inhibitors)', indications: ['Atopic Dermatitis', 'Asthma', 'Chronic Rhinosinusitis with Nasal Polyposis', 'Eosinophilic Esophagitis', 'Prurigo Nodularis'] },
  'omalizumab': { class: 'Biologics (IL inhibitors)', indications: ['Asthma', 'Chronic Idiopathic Urticaria'] },
  'mepolizumab': { class: 'Biologics (IL inhibitors)', indications: ['Asthma'] },
  'benralizumab': { class: 'Biologics (IL inhibitors)', indications: ['Asthma'] },
  'reslizumab': { class: 'Biologics (IL inhibitors)', indications: ['Asthma'] },
  'vedolizumab': { class: 'Biologics (Integrin/Other)', indications: ['Crohn\'s Disease', 'Ulcerative Colitis'] },
  'natalizumab': { class: 'Biologics (Integrin/Other)', indications: ['Crohn\'s Disease', 'Multiple Sclerosis'] },
  'abatacept': { class: 'Biologics (Integrin/Other)', indications: ['Rheumatoid Arthritis', 'Psoriatic Arthritis'] },
  'tocilizumab': { class: 'Biologics (Integrin/Other)', indications: ['Rheumatoid Arthritis'] },
  'rituximab': { class: 'Biologics (Integrin/Other)', indications: ['Rheumatoid Arthritis', 'Multiple Sclerosis'] },
  'ocrelizumab': { class: 'Biologics (Integrin/Other)', indications: ['Multiple Sclerosis'] },
  'ofatumumab': { class: 'Biologics (Integrin/Other)', indications: ['Multiple Sclerosis'] },
  'belimumab': { class: 'Biologics (Integrin/Other)', indications: ['Systemic Lupus Erythematosus'] },
  'anifrolumab': { class: 'Biologics (Integrin/Other)', indications: ['Systemic Lupus Erythematosus'] }
};

const drugDatabase: Record<string, DrugProfile> = {
  // SSRIs
  'citalopram': { name: 'Citalopram', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'High', qtcProlongation: 'Moderate', insomnia: 'Low', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [10, 20, 40] },
  'escitalopram': { name: 'Escitalopram', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [5, 10, 20] },
  'fluoxetine': { name: 'Fluoxetine', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [10, 20, 40, 60] },
  'sertraline': { name: 'Sertraline', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [25, 50, 100, 150, 200] },
  'paroxetine': { name: 'Paroxetine', weightGain: 'High', sedation: 'Moderate', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Moderate', metabolic: 'Moderate', anticholinergic: 'Moderate', cns: 'Low' , availableDoses: [10, 20, 30, 40] },
  'fluvoxamine': { name: 'Fluvoxamine', weightGain: 'Moderate', sedation: 'Moderate', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [25, 50, 100] },
  
  // SNRIs
  'venlafaxine': { name: 'Venlafaxine', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [37.5, 75, 150, 225] },
  'duloxetine': { name: 'Duloxetine', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [20, 30, 60] },
  'desvenlafaxine': { name: 'Desvenlafaxine', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [25, 50, 100] },
  'levomilnacipran': { name: 'Levomilnacipran', weightGain: 'Low', sedation: 'Low', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [20, 40, 80, 120] },
  'milnacipran': { name: 'Milnacipran', weightGain: 'Low', sedation: 'Low', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [12.5, 25, 50, 100] },
  
  // Atypicals / Others
  'bupropion': { name: 'Bupropion', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Low', insomnia: 'High', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [75, 100, 150, 300] },
  'mirtazapine': { name: 'Mirtazapine', weightGain: 'High', sedation: 'High', sexualDysfunction: 'Minimal', qtcProlongation: 'Low', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'High', anticholinergic: 'Low', cns: 'Low' , availableDoses: [7.5, 15, 30, 45] },
  'trazodone': { name: 'Trazodone', weightGain: 'Moderate', sedation: 'High', sexualDysfunction: 'Minimal', qtcProlongation: 'Low', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [50, 100, 150, 300] },
  'vortioxetine': { name: 'Vortioxetine', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [5, 10, 20] },
  'vilazodone': { name: 'Vilazodone', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [10, 20, 40] },
  
  // TCAs
  'amitriptyline': { name: 'Amitriptyline', weightGain: 'High', sedation: 'High', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'High', cns: 'Moderate' , availableDoses: [10, 25, 50, 75, 100, 150] },
  'nortriptyline': { name: 'Nortriptyline', weightGain: 'Moderate', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Moderate', cns: 'Moderate' , availableDoses: [10, 25, 50, 75] },
  'imipramine': { name: 'Imipramine', weightGain: 'High', sedation: 'High', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'High', cns: 'Moderate' , availableDoses: [10, 25, 50, 75] },
  'desipramine': { name: 'Desipramine', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Moderate', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Moderate', cns: 'Moderate' , availableDoses: [10, 25, 50, 75, 100] },
  'clomipramine': { name: 'Clomipramine', weightGain: 'High', sedation: 'High', sexualDysfunction: 'High', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Moderate', anticholinergic: 'High', cns: 'Moderate' , availableDoses: [25, 50, 75] },
  'doxepin': { name: 'Doxepin', weightGain: 'High', sedation: 'High', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'High', cns: 'Moderate' , availableDoses: [10, 25, 50, 75, 100] },
  'protriptyline': { name: 'Protriptyline', weightGain: 'Low', sedation: 'Minimal', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'High', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Moderate', cns: 'Moderate' , availableDoses: [5, 10] },
  'trimipramine': { name: 'Trimipramine', weightGain: 'High', sedation: 'High', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'High', cns: 'Moderate' , availableDoses: [25, 50, 100] },
  'amoxapine': { name: 'Amoxapine', weightGain: 'Moderate', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Moderate', cns: 'High' , availableDoses: [25, 50, 100, 150] },
  'maprotiline': { name: 'Maprotiline', weightGain: 'Moderate', sedation: 'High', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Moderate', cns: 'Moderate' , availableDoses: [25, 50, 75] },

  // MAOIs
  'phenelzine': { name: 'Phenelzine', weightGain: 'High', sedation: 'High', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Moderate', cns: 'Moderate' , availableDoses: [15] },
  'tranylcypromine': { name: 'Tranylcypromine', weightGain: 'Low', sedation: 'Low', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'High', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [10] },
  'isocarboxazid': { name: 'Isocarboxazid', weightGain: 'Moderate', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [10] },
  'moclobemide': { name: 'Moclobemide', weightGain: 'Low', sedation: 'Low', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [150, 300] },
  'selegiline': { name: 'Selegiline (Transdermal)', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'High', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [6, 9, 12] },

  // Novel / Other Antidepressants
  'nefazodone': { name: 'Nefazodone', weightGain: 'Minimal', sedation: 'High', sexualDysfunction: 'Minimal', qtcProlongation: 'Low', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [50, 100, 150, 200, 250] },
  'agomelatine': { name: 'Agomelatine', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Minimal', qtcProlongation: 'Low', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [25] },
  'reboxetine': { name: 'Reboxetine', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'High', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Moderate', cns: 'Low' , availableDoses: [4] },
  'esketamine': { name: 'Esketamine', weightGain: 'Minimal', sedation: 'High', sexualDysfunction: 'Minimal', qtcProlongation: 'Low', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'High' , availableDoses: [28, 56, 84] },
  'dextromethorphan-bupropion': { name: 'Dextromethorphan/Bupropion', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [45] },
  'gepirone': { name: 'Gepirone', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [18.2, 36.3, 54.5, 72.6] },

  // Antipsychotics (Atypical)
  'quetiapine': { name: 'Quetiapine', weightGain: 'High', sedation: 'High', sexualDysfunction: 'Low', qtcProlongation: 'Moderate', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'High', anticholinergic: 'Moderate', cns: 'Low' , availableDoses: [25, 50, 100, 200, 300, 400] },
  'olanzapine': { name: 'Olanzapine', weightGain: 'High', sedation: 'High', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'High', anticholinergic: 'Moderate', cns: 'Low' , availableDoses: [2.5, 5, 7.5, 10, 15, 20] },
  'risperidone': { name: 'Risperidone', weightGain: 'Moderate', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [0.25, 0.5, 1, 2, 3, 4] },
  'aripiprazole': { name: 'Aripiprazole', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Minimal', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [2, 5, 10, 15, 20, 30] },
  'ziprasidone': { name: 'Ziprasidone', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'High', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [20, 40, 60, 80] },
  'lurasidone': { name: 'Lurasidone', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [20, 40, 60, 80, 120] },
  'paliperidone': { name: 'Paliperidone', weightGain: 'Moderate', sedation: 'Moderate', sexualDysfunction: 'High', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [1.5, 3, 6, 9] },
  'clozapine': { name: 'Clozapine', weightGain: 'High', sedation: 'High', sexualDysfunction: 'Low', qtcProlongation: 'Moderate', insomnia: 'Minimal', giUpset: 'High', metabolic: 'High', anticholinergic: 'High', cns: 'Low' , availableDoses: [25, 50, 100, 200] },
  'asenapine': { name: 'Asenapine', weightGain: 'Moderate', sedation: 'High', sexualDysfunction: 'Low', qtcProlongation: 'Moderate', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [5, 10] },
  'iloperidone': { name: 'Iloperidone', weightGain: 'Moderate', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'High', insomnia: 'Low', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Low', cns: 'Low' , availableDoses: [1, 2, 4, 6, 8, 10, 12] },
  'cariprazine': { name: 'Cariprazine', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'High' , availableDoses: [1.5, 3, 4.5, 6] },
  'brexpiprazole': { name: 'Brexpiprazole', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [0.25, 0.5, 1, 2, 3, 4] },
  'lumateperone': { name: 'Lumateperone', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [42] },

  // Antipsychotics (Typical)
  'haloperidol': { name: 'Haloperidol', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'High' , availableDoses: [0.5, 1, 2, 5, 10, 20] },
  'chlorpromazine': { name: 'Chlorpromazine', weightGain: 'Moderate', sedation: 'High', sexualDysfunction: 'Moderate', qtcProlongation: 'Moderate', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'High', cns: 'Moderate' , availableDoses: [10, 25, 50, 100, 200] },
  'fluphenazine': { name: 'Fluphenazine', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'High' , availableDoses: [1, 2.5, 5, 10] },
  'perphenazine': { name: 'Perphenazine', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Moderate', cns: 'High' , availableDoses: [2, 4, 8, 16] },
  'loxapine': { name: 'Loxapine', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Moderate', cns: 'Moderate' , availableDoses: [5, 10, 25, 50] },
  'thioridazine': { name: 'Thioridazine', weightGain: 'Moderate', sedation: 'High', sexualDysfunction: 'High', qtcProlongation: 'High', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'High', cns: 'Low' , availableDoses: [10, 25, 50, 100] },
  'trifluoperazine': { name: 'Trifluoperazine', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'High' , availableDoses: [1, 2, 5, 10] },
  'thiothixene': { name: 'Thiothixene', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'High' , availableDoses: [1, 2, 5, 10] },
  'pimozide': { name: 'Pimozide', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Moderate', qtcProlongation: 'High', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'High' , availableDoses: [1, 2] },
  'flupentixol': { name: 'Flupentixol', weightGain: 'Minimal', sedation: 'Low', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'High' , availableDoses: [0.5, 1, 3] },
  'zuclopenthixol': { name: 'Zuclopenthixol', weightGain: 'Moderate', sedation: 'High', sexualDysfunction: 'Moderate', qtcProlongation: 'Low', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Moderate', cns: 'High' , availableDoses: [10, 25] },

  // Mood Stabilizers / Anticonvulsants
  'lithium': { name: 'Lithium', weightGain: 'Moderate', sedation: 'Low', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'High', metabolic: 'Moderate', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [150, 300, 600] },
  'valproate': { name: 'Valproate (Divalproex)', weightGain: 'High', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'High', metabolic: 'High', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [125, 250, 500] },
  'lamotrigine': { name: 'Lamotrigine', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Low', insomnia: 'Moderate', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Low' , availableDoses: [25, 100, 150, 200] },
  'carbamazepine': { name: 'Carbamazepine', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [100, 200, 400] },
  'oxcarbazepine': { name: 'Oxcarbazepine', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [150, 300, 600] },
  'topiramate': { name: 'Topiramate', weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Low', qtcProlongation: 'Low', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Low', cns: 'Moderate' , availableDoses: [25, 50, 100, 200] },

  // Statins
  'atorvastatin': { name: 'Atorvastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: [10, 20, 40, 80] },
  'rosuvastatin': { name: 'Rosuvastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: [5, 10, 20, 40] },
  'simvastatin': { name: 'Simvastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: [5, 10, 20, 40, 80] },
  'pravastatin': { name: 'Pravastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: [10, 20, 40, 80] },
  'lovastatin': { name: 'Lovastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: [10, 20, 40] },
  'fluvastatin': { name: 'Fluvastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: [20, 40, 80] },
  'pitavastatin': { name: 'Pitavastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: [1, 2, 4] },

  // Antidiabetics
  'metformin': { name: 'Metformin', brandNames: ['Glucophage'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [500, 850, 1000] },
  'glipizide': { name: 'Glipizide', brandNames: ['Glucotrol'], weightGain: 'Moderate', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Moderate', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [5, 10] },
  'empagliflozin': { name: 'Empagliflozin', brandNames: ['Jardiance'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [10, 25] },
  'semaglutide': { name: 'Semaglutide', brandNames: ['Ozempic', 'Rybelsus', 'Wegovy'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'High', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [0.25, 0.5, 1, 2] },
  'sitagliptin': { name: 'Sitagliptin', brandNames: ['Januvia'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [25, 50, 100] },

  // Antihypertensives (ACE inhibitors)
  'lisinopril': { name: 'Lisinopril', brandNames: ['Prinivil', 'Zestril'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [5, 10, 20, 40] },
  'enalapril': { name: 'Enalapril', brandNames: ['Vasotec'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [2.5, 5, 10, 20] },
  'ramipril': { name: 'Ramipril', brandNames: ['Altace'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [1.25, 2.5, 5, 10] },

  // Antihypertensives (ARBs)
  'losartan': { name: 'Losartan', brandNames: ['Cozaar'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [25, 50, 100] },
  'valsartan': { name: 'Valsartan', brandNames: ['Diovan'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [40, 80, 160, 320] },
  'irbesartan': { name: 'Irbesartan', brandNames: ['Avapro'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [75, 150, 300] },

  // Antihypertensives (Beta-blockers)
  'metoprolol': { name: 'Metoprolol', brandNames: ['Lopressor', 'Toprol XL'], weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'Minimal', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low', availableDoses: [25, 50, 100, 200] },
  'carvedilol': { name: 'Carvedilol', brandNames: ['Coreg'], weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'Minimal', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low', availableDoses: [3.125, 6.25, 12.5, 25] },
  'atenolol': { name: 'Atenolol', brandNames: ['Tenormin'], weightGain: 'Minimal', sedation: 'Moderate', sexualDysfunction: 'Moderate', qtcProlongation: 'Minimal', insomnia: 'Low', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low', availableDoses: [25, 50, 100] },

  // Anticoagulants
  'warfarin': { name: 'Warfarin', brandNames: ['Coumadin', 'Jantoven'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [1, 2, 2.5, 3, 4, 5, 6, 7.5, 10] },
  'apixaban': { name: 'Apixaban', brandNames: ['Eliquis'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [2.5, 5] },
  'rivaroxaban': { name: 'Rivaroxaban', brandNames: ['Xarelto'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [2.5, 10, 15, 20] },
  'dabigatran': { name: 'Dabigatran', brandNames: ['Pradaxa'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal', availableDoses: [75, 110, 150] },



  // Biologics
  'adalimumab': { name: 'Adalimumab', brandNames: ['Humira'], biosimilars: ['Amjevita', 'Cyltezo', 'Hyrimoz', 'Hadlima', 'Abrilada', 'Hulio', 'Yusimry', 'Idacio', 'Yuflyma', 'Simlandi'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [40] },
  'infliximab': { name: 'Infliximab', brandNames: ['Remicade'], biosimilars: ['Inflectra', 'Renflexis', 'Ixifi', 'Avsola'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'etanercept': { name: 'Etanercept', brandNames: ['Enbrel'], biosimilars: ['Erelzi', 'Eticovo'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [50] },
  'certolizumab': { name: 'Certolizumab', brandNames: ['Cimzia'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [200] },
  'golimumab': { name: 'Golimumab', brandNames: ['Simponi', 'Simponi Aria'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [50, 100] },
  'ustekinumab': { name: 'Ustekinumab', brandNames: ['Stelara'], biosimilars: ['Wezlana', 'Selarsdi', 'Pyzchiva', 'Otulfi'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [45, 90] },
  'secukinumab': { name: 'Secukinumab', brandNames: ['Cosentyx'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [150, 300] },
  'ixekizumab': { name: 'Ixekizumab', brandNames: ['Taltz'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [80] },
  'risankizumab': { name: 'Risankizumab', brandNames: ['Skyrizi'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [150, 360] },
  'guselkumab': { name: 'Guselkumab', brandNames: ['Tremfya'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'tildrakizumab': { name: 'Tildrakizumab', brandNames: ['Ilumya'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'vedolizumab': { name: 'Vedolizumab', brandNames: ['Entyvio'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [300] },
  'natalizumab': { name: 'Natalizumab', brandNames: ['Tysabri'], biosimilars: ['Tyruko'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [300] },
  'abatacept': { name: 'Abatacept', brandNames: ['Orencia'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [125] },
  'tocilizumab': { name: 'Tocilizumab', brandNames: ['Actemra'], biosimilars: ['Tofidence', 'Tyenne'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [162] },

  'brodalumab': { name: 'Brodalumab', brandNames: ['Siliq'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [210] },
  'bimekizumab': { name: 'Bimekizumab', brandNames: ['Bimzelx'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [160] },
  'mirikizumab': { name: 'Mirikizumab', brandNames: ['Omvoh'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [300] },
  'sarilumab': { name: 'Sarilumab', brandNames: ['Kevzara'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [150, 200] },
  'anakinra': { name: 'Anakinra', brandNames: ['Kineret'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'dupilumab': { name: 'Dupilumab', brandNames: ['Dupixent'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [200, 300] },
  'omalizumab': { name: 'Omalizumab', brandNames: ['Xolair'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [75, 150] },
  'mepolizumab': { name: 'Mepolizumab', brandNames: ['Nucala'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'benralizumab': { name: 'Benralizumab', brandNames: ['Fasenra'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [30] },
  'reslizumab': { name: 'Reslizumab', brandNames: ['Cinqair'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'rituximab': { name: 'Rituximab', brandNames: ['Rituxan'], biosimilars: ['Truxima', 'Ruxience', 'Riabni'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100, 500] },
  'ocrelizumab': { name: 'Ocrelizumab', brandNames: ['Ocrevus'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [300] },
  'ofatumumab': { name: 'Ofatumumab', brandNames: ['Kesimpta'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [20] },
  'belimumab': { name: 'Belimumab', brandNames: ['Benlysta'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [120, 200, 400] },
  'anifrolumab': { name: 'Anifrolumab', brandNames: ['Saphnelo'], biosimilars: [], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [300] }
};

export function getDrugProfile(drugName: string): DrugProfile | null {
  if (!drugName) return null;
  const normalized = drugName.toLowerCase().trim();
  
  // Try exact match
  if (drugDatabase[normalized]) return drugDatabase[normalized];
  
  // Try partial match (e.g., "Citalopram 20mg" -> matches "citalopram")
  const match = Object.keys(drugDatabase).find(k => normalized.includes(k) || k.includes(normalized));
  return match ? drugDatabase[match] : null;
}

export function getAllDrugs(): string[] {
  return Object.keys(drugDatabase);
}

// Precompute drug to class mapping for O(1) lookups
const drugToClassMap = new Map<string, string>();
for (const [className, drugs] of Object.entries(drugClasses)) {
  for (const drug of drugs) {
    drugToClassMap.set(drug.toLowerCase().trim(), className);
  }
}

export function getDrugClass(drugName: string): string | null {
  const normalized = drugName.toLowerCase().trim();
  return drugToClassMap.get(normalized) || null;
}
