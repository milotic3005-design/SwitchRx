const fs = require('fs');

// 1. Update SwitchingProtocols.tsx
let sp = fs.readFileSync('components/SwitchingProtocols.tsx', 'utf8');

sp = sp.replace(
  'const allIndications = Array.from(new Set(Object.values(biologicIndications).flat())).sort();',
  'const allIndications = Array.from(new Set(Object.values(biologicIndications).flatMap(b => b.indications))).sort();'
);

sp = sp.replace(
  '!suggestionFilter || biologicIndications[s.drug.toLowerCase()]?.includes(suggestionFilter)',
  '!suggestionFilter || biologicIndications[s.drug.toLowerCase()]?.indications.includes(suggestionFilter)'
);

sp = sp.replace(
  '{biologicIndications[fromDrug.toLowerCase()]?.map(ind => (',
  '{biologicIndications[fromDrug.toLowerCase()]?.indications.map(ind => ('
);

sp = sp.replace(
  '{biologicIndications[suggestion.drug.toLowerCase()].map(ind => (',
  '{biologicIndications[suggestion.drug.toLowerCase()].indications.map(ind => ('
);

fs.writeFileSync('components/SwitchingProtocols.tsx', sp);

// 2. Update clinical-logic.ts
let cl = fs.readFileSync('lib/clinical-logic.ts', 'utf8');

cl = cl.replace(
  'return biologicIndications[d]?.includes(indication);',
  'return biologicIndications[d]?.indications.includes(indication);'
);

fs.writeFileSync('lib/clinical-logic.ts', cl);
console.log('Done');
