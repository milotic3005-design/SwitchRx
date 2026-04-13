const fs = require('fs');
const path = 'components/SwitchingProtocols.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Change indigo to blue for consistency and better focus rings
content = content.replace(/indigo/g, 'blue');
content = content.replace(/focus:ring-blue-500\/50/g, 'focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60');

// 2. Add IDs and htmlFor for accessibility
const fields = [
  { label: 'Current Medication', id: 'current-medication', tag: 'select' },
  { label: 'Current Dose', id: 'current-dose', tag: 'select' },
  { label: 'Duration', id: 'duration', tag: 'select' },
  { label: 'Disease State / Indication', id: 'indication', tag: 'select' },
  { label: 'Primary Reason for Switch', id: 'reason', tag: 'select' },
  { label: 'Age \\(yrs\\)', id: 'age', tag: 'input' },
  { label: 'Weight \\(kg\\)', id: 'weight', tag: 'input' },
  { label: 'Renal Function', id: 'renal-function', tag: 'select' },
  { label: 'Hepatic Function', id: 'hepatic-function', tag: 'select' },
  { label: 'Comorbidities', id: 'comorbidities', tag: 'input' },
  { label: 'History of Severe Infections', id: 'infection-history', tag: 'select' },
  { label: 'Other Current Medications', id: 'other-medications', tag: 'input' },
  { label: 'CYP2D6 Status', id: 'cyp2d6-status', tag: 'select' }
];

fields.forEach(field => {
  // Add htmlFor to label
  const labelRegex = new RegExp(`(<label className="[^"]*")>(.*?${field.label}.*?)<\\/label>`, 'g');
  content = content.replace(labelRegex, `$1 htmlFor="${field.id}">$2</label>`);
});

// Since regex for the next tag is tricky, we'll do a targeted replace for the tags based on their value/onChange bindings
const tagReplacements = [
  { bind: 'value={fromDrug}', id: 'current-medication' },
  { bind: 'value={currentDose}', id: 'current-dose' },
  { bind: 'value={duration}', id: 'duration' },
  { bind: 'value={indication}', id: 'indication' },
  { bind: 'value={reason}', id: 'reason' },
  { bind: 'value={age}', id: 'age' },
  { bind: 'value={weight}', id: 'weight' },
  { bind: 'value={renalFunction}', id: 'renal-function' },
  { bind: 'value={hepaticFunction}', id: 'hepatic-function' },
  { bind: 'value={comorbidities}', id: 'comorbidities' },
  { bind: 'value={infectionHistory}', id: 'infection-history' },
  { bind: 'value={otherMedications}', id: 'other-medications' },
  { bind: 'value={cyp2d6Status}', id: 'cyp2d6-status' },
  { bind: 'value={suggestionFilter}', id: 'filter-indication' }
];

tagReplacements.forEach(rep => {
  content = content.replace(rep.bind, `id="${rep.id}" ${rep.bind}`);
});

// Add htmlFor to the filter label which is a span currently
content = content.replace('<span className="text-[12px] text-slate-400">Filter by Indication:</span>', '<label htmlFor="filter-indication" className="text-[12px] text-slate-400">Filter by Indication:</label>');

fs.writeFileSync(path, content);
console.log('Dropdowns enhanced');
