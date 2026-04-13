const fs = require('fs');
const path = 'components/SwitchingProtocols.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix double focus:ring-2
content = content.replace(/focus:ring-2 focus:ring-2/g, 'focus:ring-2');

fs.writeFileSync(path, content);
console.log('Fixed double focus:ring-2');
