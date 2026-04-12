const fs = require('fs');

let content = fs.readFileSync('lib/drug-db.ts', 'utf8');

const newDrugs = `
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
};`;

content = content.replace('};\n\nexport function getDrugProfile', newDrugs.replace('};\n', '') + '\n};\n\nexport function getDrugProfile');

fs.writeFileSync('lib/drug-db.ts', content);
console.log('Done');
