const fs = require('fs');

let content = fs.readFileSync('lib/drug-db.ts', 'utf8');

// Update ustekinumab
content = content.replace(
  /biosimilars: \['Wezlana'\]/g,
  "biosimilars: ['Wezlana', 'Selarsdi', 'Pyzchiva', 'Otulfi']"
);

// Update tocilizumab
content = content.replace(
  /biosimilars: \['Tofidence'\]/g,
  "biosimilars: ['Tofidence', 'Tyenne']"
);

// Update adalimumab
content = content.replace(
  /biosimilars: \['Amjevita', 'Cyltezo', 'Hyrimoz', 'Hadlima', 'Abrilada', 'Hulio', 'Yusimry', 'Idacio', 'Yuflyma'\]/g,
  "biosimilars: ['Amjevita', 'Cyltezo', 'Hyrimoz', 'Hadlima', 'Abrilada', 'Hulio', 'Yusimry', 'Idacio', 'Yuflyma', 'Simlandi']"
);

// Add empty biosimilars array to biologics that don't have them yet, just to be consistent
const biologicsWithoutBiosimilars = [
  'certolizumab', 'golimumab', 'secukinumab', 'ixekizumab', 'risankizumab', 
  'guselkumab', 'tildrakizumab', 'brodalumab', 'bimekizumab', 'mirikizumab', 
  'sarilumab', 'anakinra', 'dupilumab', 'omalizumab', 'mepolizumab', 
  'benralizumab', 'reslizumab', 'vedolizumab', 'abatacept', 'ocrelizumab', 
  'ofatumumab', 'belimumab', 'anifrolumab'
];

biologicsWithoutBiosimilars.forEach(drug => {
  const regex = new RegExp(`('${drug}': { name: '[^']+', brandNames: \\[[^\\]]+\\])(, weightGain)`, 'g');
  content = content.replace(regex, "$1, biosimilars: []$2");
  
  // Also handle cases without brandNames if any
  const regexNoBrand = new RegExp(`('${drug}': { name: '[^']+')(, weightGain)`, 'g');
  if (content.match(regexNoBrand) && !content.match(regex)) {
      content = content.replace(regexNoBrand, "$1, biosimilars: []$2");
  }
});

fs.writeFileSync('lib/drug-db.ts', content);
console.log('Done');
