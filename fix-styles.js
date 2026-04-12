const fs = require('fs');
let content = fs.readFileSync('components/SwitchingProtocols.tsx', 'utf8');

const oldClass = 'className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"';
const newClass = 'className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 text-[15px] text-white transition-all shadow-sm"';

const oldClassPlaceholder = 'className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 placeholder:text-slate-500 transition-colors"';
const newClassPlaceholder = 'className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 text-[15px] text-white placeholder:text-slate-500 transition-all shadow-sm"';

const oldClassDisabled = 'className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors disabled:opacity-50"';
const newClassDisabled = 'className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 text-[15px] text-white transition-all shadow-sm disabled:opacity-50"';

content = content.split(oldClass).join(newClass);
content = content.split(oldClassPlaceholder).join(newClassPlaceholder);
content = content.split(oldClassDisabled).join(newClassDisabled);

content = content.replace(/<option /g, '<option className="bg-[#121212] text-white" ');
content = content.replace(/<option>/g, '<option className="bg-[#121212] text-white">');
content = content.replace(/<optgroup /g, '<optgroup className="bg-[#121212] text-white" ');

fs.writeFileSync('components/SwitchingProtocols.tsx', content);
console.log('Done');
