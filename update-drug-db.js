const fs = require('fs');

let content = fs.readFileSync('lib/drug-db.ts', 'utf8');

// 1. Update biologicIndications type and content
const oldBiologicIndications = `export const biologicIndications: Record<string, string[]> = {
  'adalimumab': ['Rheumatoid Arthritis', 'Crohn\\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis', 'Hidradenitis Suppurativa'],
  'infliximab': ['Rheumatoid Arthritis', 'Crohn\\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'],
  'etanercept': ['Rheumatoid Arthritis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'],
  'certolizumab': ['Rheumatoid Arthritis', 'Crohn\\'s Disease', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'],
  'golimumab': ['Rheumatoid Arthritis', 'Ulcerative Colitis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'],
  'ustekinumab': ['Crohn\\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis'],
  'secukinumab': ['Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'],
  'ixekizumab': ['Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'],
  'risankizumab': ['Crohn\\'s Disease', 'Psoriasis', 'Psoriatic Arthritis'],
  'guselkumab': ['Psoriasis', 'Psoriatic Arthritis'],
  'tildrakizumab': ['Psoriasis'],
  'vedolizumab': ['Crohn\\'s Disease', 'Ulcerative Colitis'],
  'natalizumab': ['Crohn\\'s Disease', 'Multiple Sclerosis'],
  'abatacept': ['Rheumatoid Arthritis', 'Psoriatic Arthritis'],
  'tocilizumab': ['Rheumatoid Arthritis']
};`;

const newBiologicIndications = `export const biologicIndications: Record<string, { class: string, indications: string[] }> = {
  'adalimumab': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Crohn\\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis', 'Hidradenitis Suppurativa'] },
  'infliximab': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Crohn\\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'etanercept': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'certolizumab': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Crohn\\'s Disease', 'Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'golimumab': { class: 'Biologics (TNF inhibitors)', indications: ['Rheumatoid Arthritis', 'Ulcerative Colitis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'ustekinumab': { class: 'Biologics (IL inhibitors)', indications: ['Crohn\\'s Disease', 'Ulcerative Colitis', 'Psoriasis', 'Psoriatic Arthritis'] },
  'secukinumab': { class: 'Biologics (IL inhibitors)', indications: ['Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'ixekizumab': { class: 'Biologics (IL inhibitors)', indications: ['Psoriasis', 'Psoriatic Arthritis', 'Ankylosing Spondylitis'] },
  'risankizumab': { class: 'Biologics (IL inhibitors)', indications: ['Crohn\\'s Disease', 'Psoriasis', 'Psoriatic Arthritis'] },
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
  'vedolizumab': { class: 'Biologics (Integrin/Other)', indications: ['Crohn\\'s Disease', 'Ulcerative Colitis'] },
  'natalizumab': { class: 'Biologics (Integrin/Other)', indications: ['Crohn\\'s Disease', 'Multiple Sclerosis'] },
  'abatacept': { class: 'Biologics (Integrin/Other)', indications: ['Rheumatoid Arthritis', 'Psoriatic Arthritis'] },
  'tocilizumab': { class: 'Biologics (Integrin/Other)', indications: ['Rheumatoid Arthritis'] },
  'rituximab': { class: 'Biologics (Integrin/Other)', indications: ['Rheumatoid Arthritis', 'Multiple Sclerosis'] },
  'ocrelizumab': { class: 'Biologics (Integrin/Other)', indications: ['Multiple Sclerosis'] },
  'ofatumumab': { class: 'Biologics (Integrin/Other)', indications: ['Multiple Sclerosis'] },
  'belimumab': { class: 'Biologics (Integrin/Other)', indications: ['Systemic Lupus Erythematosus'] },
  'anifrolumab': { class: 'Biologics (Integrin/Other)', indications: ['Systemic Lupus Erythematosus'] }
};`;

content = content.replace(oldBiologicIndications, newBiologicIndications);

// 2. Update drugClasses
const oldIL = `'Biologics (IL inhibitors)': ['ustekinumab', 'secukinumab', 'ixekizumab', 'risankizumab', 'guselkumab', 'tildrakizumab'],`;
const newIL = `'Biologics (IL inhibitors)': ['ustekinumab', 'secukinumab', 'ixekizumab', 'risankizumab', 'guselkumab', 'tildrakizumab', 'brodalumab', 'bimekizumab', 'mirikizumab', 'sarilumab', 'anakinra', 'dupilumab', 'omalizumab', 'mepolizumab', 'benralizumab', 'reslizumab'],`;
content = content.replace(oldIL, newIL);

const oldIntegrin = `'Biologics (Integrin/Other)': ['vedolizumab', 'natalizumab', 'abatacept', 'tocilizumab']`;
const newIntegrin = `'Biologics (Integrin/Other)': ['vedolizumab', 'natalizumab', 'abatacept', 'tocilizumab', 'rituximab', 'ocrelizumab', 'ofatumumab', 'belimumab', 'anifrolumab']`;
content = content.replace(oldIntegrin, newIntegrin);

// 3. Add to drugDatabase
const newDrugs = `
  'brodalumab': { name: 'Brodalumab', brandNames: ['Siliq'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [210] },
  'bimekizumab': { name: 'Bimekizumab', brandNames: ['Bimzelx'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [160] },
  'mirikizumab': { name: 'Mirikizumab', brandNames: ['Omvoh'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [300] },
  'sarilumab': { name: 'Sarilumab', brandNames: ['Kevzara'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [150, 200] },
  'anakinra': { name: 'Anakinra', brandNames: ['Kineret'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'dupilumab': { name: 'Dupilumab', brandNames: ['Dupixent'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [200, 300] },
  'omalizumab': { name: 'Omalizumab', brandNames: ['Xolair'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [75, 150] },
  'mepolizumab': { name: 'Mepolizumab', brandNames: ['Nucala'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'benralizumab': { name: 'Benralizumab', brandNames: ['Fasenra'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [30] },
  'reslizumab': { name: 'Reslizumab', brandNames: ['Cinqair'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100] },
  'rituximab': { name: 'Rituximab', brandNames: ['Rituxan'], biosimilars: ['Truxima', 'Ruxience', 'Riabni'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [100, 500] },
  'ocrelizumab': { name: 'Ocrelizumab', brandNames: ['Ocrevus'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [300] },
  'ofatumumab': { name: 'Ofatumumab', brandNames: ['Kesimpta'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [20] },
  'belimumab': { name: 'Belimumab', brandNames: ['Benlysta'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [120, 200, 400] },
  'anifrolumab': { name: 'Anifrolumab', brandNames: ['Saphnelo'], weightGain: 'Minimal', sedation: 'Minimal', sexualDysfunction: 'Minimal', qtcProlongation: 'Minimal', insomnia: 'Minimal', giUpset: 'Low', metabolic: 'Low', anticholinergic: 'Minimal', cns: 'Minimal' , availableDoses: [300] },
};`;

content = content.replace('};\n\nexport const getDrugProfile', newDrugs + '\n\nexport const getDrugProfile');

fs.writeFileSync('lib/drug-db.ts', content);
console.log('Done');
