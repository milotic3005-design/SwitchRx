const fs = require('fs');
let content = fs.readFileSync('components/SwitchingProtocols.tsx', 'utf8');

const oldSelect = 'className="appearance-none w-full px-4 py-3 pr-10 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 hover:bg-white/10 backdrop-blur-md text-[15px] text-white transition-all shadow-sm cursor-pointer"';
const newSelect = 'className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-indigo-500/50 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"';

const oldDisabledSelect = 'className="appearance-none w-full px-4 py-3 pr-10 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 hover:bg-white/10 backdrop-blur-md text-[15px] text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"';
const newDisabledSelect = 'className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-indigo-500/50 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"';

const oldInput = 'className="appearance-none w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-white/5 hover:bg-white/10 backdrop-blur-md text-[15px] text-white placeholder:text-slate-500 transition-all shadow-sm"';
const newInput = 'className="appearance-none w-full px-5 py-3.5 border border-white/5 rounded-full focus:ring-2 focus:ring-indigo-500/50 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white placeholder:text-slate-500 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"';

content = content.split(oldSelect).join(newSelect);
content = content.split(oldDisabledSelect).join(newDisabledSelect);
content = content.split(oldInput).join(newInput);

const oldChevron = '<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">\n                            <ChevronDown size={16} />\n                          </div>';
const newChevron = `<div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                              <ChevronDown size={14} />
                            </div>
                          </div>`;

const oldChevron2 = '<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">\n                              <ChevronDown size={16} />\n                            </div>';
const newChevron2 = `<div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                                <ChevronDown size={14} />
                              </div>
                            </div>`;

const oldChevron3 = '<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">\n                          <ChevronDown size={16} />\n                        </div>';
const newChevron3 = `<div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                            <ChevronDown size={14} />
                          </div>
                        </div>`;

content = content.split(oldChevron).join(newChevron);
content = content.split(oldChevron2).join(newChevron2);
content = content.split(oldChevron3).join(newChevron3);

fs.writeFileSync('components/SwitchingProtocols.tsx', content);
console.log('Done');
