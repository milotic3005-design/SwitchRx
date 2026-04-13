const fs = require('fs');
const path = 'components/SwitchingProtocols.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the incorrect htmlFor
content = content.replace('<label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="current-medication">Other Current Medications</label>', '<label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="other-medications">Other Current Medications</label>');

fs.writeFileSync(path, content);
console.log('Fixed htmlFor');
