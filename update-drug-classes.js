const fs = require('fs');

let content = fs.readFileSync('lib/drug-db.ts', 'utf8');

// 1. Add to drugClasses
const newClasses = `
  'Antidiabetics': ['metformin', 'glipizide', 'empagliflozin', 'semaglutide', 'sitagliptin'],
  'Antihypertensives (ACE inhibitors)': ['lisinopril', 'enalapril', 'ramipril'],
  'Antihypertensives (ARBs)': ['losartan', 'valsartan', 'irbesartan'],
  'Antihypertensives (Beta-blockers)': ['metoprolol', 'carvedilol', 'atenolol'],
  'Anticoagulants': ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran'],`;

content = content.replace(
  /'Statins': \['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin', 'fluvastatin', 'pitavastatin'\],/g,
  `'Statins': ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin', 'fluvastatin', 'pitavastatin'],${newClasses}`
);

// 2. Add to drugDatabase
const newDrugs = `
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

`;

content = content.replace(
  /'pitavastatin': { name: 'Pitavastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: \[1, 2, 4\] },/g,
  `'pitavastatin': { name: 'Pitavastatin', weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Moderate', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Low' , availableDoses: [1, 2, 4] },\n${newDrugs}`
);

fs.writeFileSync('lib/drug-db.ts', content);
console.log('Done');
