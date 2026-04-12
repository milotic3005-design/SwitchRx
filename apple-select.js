const fs = require('fs');
let content = fs.readFileSync('components/SwitchingProtocols.tsx', 'utf8');

// 1. Update Select classes
const oldSelectClass = 'className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 text-[15px] text-white transition-all shadow-sm"';
const newSelectClass = 'className="appearance-none w-full px-4 py-3 pr-10 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 hover:bg-white/10 backdrop-blur-md text-[15px] text-white transition-all shadow-sm cursor-pointer"';
content = content.split(oldSelectClass).join(newSelectClass);

const oldSelectDisabledClass = 'className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 text-[15px] text-white transition-all shadow-sm disabled:opacity-50"';
const newSelectDisabledClass = 'className="appearance-none w-full px-4 py-3 pr-10 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 hover:bg-white/10 backdrop-blur-md text-[15px] text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"';
content = content.split(oldSelectDisabledClass).join(newSelectDisabledClass);

// 2. Update Input classes
const oldInputClass = 'className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 text-[15px] text-white placeholder:text-slate-500 transition-all shadow-sm"';
const newInputClass = 'className="appearance-none w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 hover:bg-white/10 backdrop-blur-md text-[15px] text-white placeholder:text-slate-500 transition-all shadow-sm"';
content = content.split(oldInputClass).join(newInputClass);

// 3. Wrap <select>
let parts = content.split('<select');
let newContent = parts[0];
for (let i = 1; i < parts.length; i++) {
    let part = parts[i];
    let endIdx = part.indexOf('</select>');
    if (endIdx !== -1) {
        let beforeEnd = part.substring(0, endIdx);
        let afterEnd = part.substring(endIdx + '</select>'.length);
        newContent += '<div className="relative">\n                <select' + beforeEnd + '</select>\n                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">\n                  <ChevronDown size={16} />\n                </div>\n              </div>' + afterEnd;
    } else {
        newContent += '<select' + part;
    }
}

fs.writeFileSync('components/SwitchingProtocols.tsx', newContent);
console.log('Done');
