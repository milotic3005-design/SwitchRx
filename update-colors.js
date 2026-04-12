const fs = require('fs');
const path = 'components/InfusionConsult.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/indigo/g, 'blue');
fs.writeFileSync(path, content);
console.log('Updated colors in InfusionConsult.tsx');
