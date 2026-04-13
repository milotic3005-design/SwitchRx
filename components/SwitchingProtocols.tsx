"use client";
import { useState } from 'react';
import { suggestReplacements, ReplacementSuggestion } from '@/lib/clinical-logic';
import { getDrugProfile, DrugProfile, drugClasses, biologicIndications } from '@/lib/drug-db';
import { monographs } from '@/lib/drug-monographs';
import { ArrowRight, AlertTriangle, CheckCircle2, BookOpen, Activity, ShieldAlert, Info, X, Search, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function SwitchingProtocols() {
  const [fromDrug, setFromDrug] = useState('');
  const [currentDose, setCurrentDose] = useState('');
  const [duration, setDuration] = useState('< 4 weeks');
  const [reason, setReason] = useState('Lack of Efficacy');
  const [secondaryEffect, setSecondaryEffect] = useState('none');
  const [indication, setIndication] = useState('');
  
  // Patient Context State
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [renalFunction, setRenalFunction] = useState('Normal');
  const [hepaticFunction, setHepaticFunction] = useState('Normal');
  const [comorbidities, setComorbidities] = useState('');
  const [infectionHistory, setInfectionHistory] = useState('No');
  const [otherMedications, setOtherMedications] = useState('');
  const [cyp2d6Status, setCyp2d6Status] = useState('Unknown');

  const [suggestions, setSuggestions] = useState<ReplacementSuggestion[] | null>(null);
  const [showMonographFor, setShowMonographFor] = useState<string | null>(null);
  const [suggestionFilter, setSuggestionFilter] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const allIndications = Array.from(new Set(Object.values(biologicIndications).flatMap(b => b.indications))).sort();


  const [mainTab, setMainTab] = useState<'setup' | 'suggestions'>('setup');
  const [subTab, setSubTab] = useState<'therapy' | 'patient'>('therapy');

  const handleSearch = async () => {
    if (!fromDrug) return;
    
    setSuggestions(null);
    setIsSearching(true);
    setSuggestionFilter(indication);
    
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const results = suggestReplacements({
      fromDrug,
      currentDose,
      duration,
      reason,
      secondaryEffect,
      indication,
      patientContext: {
        age,
        weight,
        renalFunction,
        hepaticFunction,
        comorbidities,
        infectionHistory,
        otherMedications,
        cyp2d6Status
      }
    });
    setSuggestions(results);
    setIsSearching(false);
    setMainTab('suggestions');
  };

  const isBiologic = fromDrug && ['Biologics (TNF inhibitors)', 'Biologics (IL inhibitors)', 'Biologics (Integrin/Other)'].some(c => drugClasses[c as keyof typeof drugClasses]?.includes(fromDrug.toLowerCase()));

  const reasons = [
    "Lack of Efficacy",
    "Primary Non-response",
    "Secondary Loss of Response",
    "Adverse Effect: Sexual Dysfunction (Libido/Anorgasmia)",
    "Adverse Effect: Weight Gain",
    "Adverse Effect: Metabolic Changes (Lipids/Glucose)",
    "Adverse Effect: Sedation / Fatigue",
    "Adverse Effect: Insomnia",
    "Adverse Effect: GI Upset",
    "Adverse Effect: Anticholinergic (Dry Mouth/Constipation)",
    "Adverse Effect: CNS / EPS (Tremor/Akathisia)",
    "Adverse Effect: Injection Site Reaction",
    "Adverse Effect: Infection Risk",
    "Transition of Care (e.g., IV to PO/SC)",
    "Cost / Formulary Issue"
  ];

  const durations = [
    "< 4 weeks",
    "4-8 weeks",
    "> 8 weeks"
  ];

  const getSortedDrugs = (drugs: string[]) => {
    return [...drugs].sort((a, b) => {
      const nameA = getDrugProfile(a)?.name || a;
      const nameB = getDrugProfile(b)?.name || b;
      return nameA.localeCompare(nameB);
    });
  };

  const hasBiologicSuggestions = suggestions?.some(s => 
    ['Biologics (TNF inhibitors)', 'Biologics (IL inhibitors)', 'Biologics (Integrin/Other)'].some(c => 
      drugClasses[c as keyof typeof drugClasses]?.includes(s.drug.toLowerCase())
    )
  );

  const filteredSuggestions = suggestions?.filter(s => 
    !suggestionFilter || biologicIndications[s.drug.toLowerCase()]?.indications.includes(suggestionFilter)
  ).slice(0, 3);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Animated Tab Bar */}
      <div className="flex justify-center mb-8">
        <motion.div layout className="bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-2 flex flex-col gap-2 shadow-2xl relative z-20">
          <AnimatePresence mode="popLayout">
            {mainTab === 'setup' && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex items-center justify-center gap-1 px-2 pt-1"
              >
                {['therapy', 'patient'].map(t => (
                  <button
                    key={t}
                    onClick={() => setSubTab(t as any)}
                    className={`relative px-5 py-2 text-[13px] font-medium rounded-full transition-colors ${subTab === t ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {subTab === t && (
                      <motion.div layoutId="sub-pill" className="absolute inset-0 bg-white/10 rounded-full" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                    )}
                    <span className="relative z-10">{t === 'therapy' ? 'Current Therapy' : 'Patient Context'}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-full">
            <button
              onClick={() => setMainTab('setup')}
              className={`relative flex items-center gap-2 px-6 py-3 text-[14px] font-medium rounded-full transition-colors ${mainTab === 'setup' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {mainTab === 'setup' && (
                <motion.div layoutId="main-pill" className="absolute inset-0 bg-[#2a2a2a] rounded-full shadow-lg border border-white/5" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Activity size={16} />
                Setup
              </span>
            </button>
            <button
              onClick={() => setMainTab('suggestions')}
              className={`relative flex items-center gap-2 px-6 py-3 text-[14px] font-medium rounded-full transition-colors ${mainTab === 'suggestions' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {mainTab === 'suggestions' && (
                <motion.div layoutId="main-pill" className="absolute inset-0 bg-[#2a2a2a] rounded-full shadow-lg border border-white/5" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Sparkles size={16} />
                Suggestions
              </span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Content Area */}
      <div className="bg-[#121212] p-6 md:p-8 rounded-3xl border border-white/5 relative z-10">
        <AnimatePresence mode="wait">
          {mainTab === 'setup' ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {subTab === 'therapy' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Side: Current Therapy */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                        <div className="text-blue-400">
                          <Activity size={16} strokeWidth={1.5} />
                        </div>
                        <h3 className="font-medium text-slate-200 text-[14px]">Current Therapy</h3>
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-[12px] font-medium text-slate-500" htmlFor="current-medication">Current Medication</label>
                        </div>
                        <div className="relative">
                          <select 
                            id="current-medication" value={fromDrug}
                            onChange={(e) => {
                              setFromDrug(e.target.value);
                              setCurrentDose('');
                            }}
                            className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                            suppressHydrationWarning
                          >
                            <option className="bg-[#121212] text-white" value="">Select a medication...</option>
                            {Object.entries(drugClasses).map(([className, drugs]) => (
                              <optgroup className="bg-[#121212] text-white" key={className} label={className}>
                                {getSortedDrugs(drugs).map(drug => {
                                  const profile = getDrugProfile(drug);
                                  const brandStr = profile?.brandNames && profile.brandNames.length > 0 ? ` (${profile.brandNames.join(', ')})` : '';
                                  return <option className="bg-[#121212] text-white" key={drug} value={drug}>{profile?.name || drug}{brandStr}</option>;
                                })}
                              </optgroup>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                              <ChevronDown size={14} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="current-dose">Current Dose</label>
                          <div className="relative">
                            <select 
                              id="current-dose" value={currentDose}
                              onChange={(e) => setCurrentDose(e.target.value)}
                              disabled={!fromDrug}
                              className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              suppressHydrationWarning
                            >
                              <option className="bg-[#121212] text-white" value="">{fromDrug ? "Select dose..." : "Select drug first"}</option>
                              {fromDrug && getDrugProfile(fromDrug)?.availableDoses?.map(dose => (
                                <option className="bg-[#121212] text-white" key={dose} value={dose}>{dose} mg</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="duration">Duration</label>
                          <div className="relative">
                            <select 
                              id="duration" value={duration}
                              onChange={(e) => setDuration(e.target.value)}
                              className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                              suppressHydrationWarning
                            >
                              {durations.map(d => <option className="bg-[#121212] text-white" key={d} value={d}>{d}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isBiologic && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="indication">Disease State / Indication</label>
                          <div className="relative">
                            <select 
                              id="indication" value={indication}
                              onChange={(e) => setIndication(e.target.value)}
                              className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                              suppressHydrationWarning
                            >
                              <option className="bg-[#121212] text-white" value="">Select primary indication...</option>
                              {biologicIndications[fromDrug.toLowerCase()]?.indications.map(ind => (
                                <option className="bg-[#121212] text-white" key={ind} value={ind}>{ind}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Side: Switch To */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                        <div className="text-emerald-400">
                          <ArrowRight size={16} strokeWidth={1.5} />
                        </div>
                        <h3 className="font-medium text-slate-200 text-[14px]">Switching Parameters</h3>
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="reason">Primary Reason for Switch</label>
                        <div className="relative">
                          <select 
                            id="reason" value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                            suppressHydrationWarning
                          >
                            {reasons.map(r => <option className="bg-[#121212] text-white" key={r} value={r}>{r}</option>)}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                              <ChevronDown size={14} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                      onClick={handleSearch}
                      disabled={!fromDrug || isSearching}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Analyzing Protocols...
                        </>
                      ) : (
                        <>
                          <Search size={18} />
                          Find Switching Protocols
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-5 border-b border-white/5 pb-3">
                    <div className="text-blue-400">
                      <Info size={16} strokeWidth={1.5} />
                    </div>
                    <h3 className="font-medium text-slate-200 text-[14px]">Patient Context (Optional)</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="age">Age (yrs)</label>
                      <input 
                        type="number" 
                        id="age" value={age} 
                        onChange={(e) => setAge(e.target.value)} 
                        placeholder="e.g. 45"
                        className="appearance-none w-full px-5 py-3.5 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white placeholder:text-slate-500 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                        suppressHydrationWarning
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="weight">Weight (kg)</label>
                      <input 
                        type="number" 
                        id="weight" value={weight} 
                        onChange={(e) => setWeight(e.target.value)} 
                        placeholder="e.g. 70"
                        className="appearance-none w-full px-5 py-3.5 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white placeholder:text-slate-500 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                        suppressHydrationWarning
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="renal-function">Renal Function</label>
                      <div className="relative">
                        <select 
                          id="renal-function" value={renalFunction} 
                          onChange={(e) => setRenalFunction(e.target.value)}
                          className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                          suppressHydrationWarning
                        >
                          <option className="bg-[#121212] text-white" value="Normal">Normal</option>
                          <option className="bg-[#121212] text-white" value="Mild Impairment">Mild Impairment</option>
                          <option className="bg-[#121212] text-white" value="Moderate Impairment">Moderate Impairment</option>
                          <option className="bg-[#121212] text-white" value="Severe Impairment">Severe Impairment</option>
                          <option className="bg-[#121212] text-white" value="ESRD/Dialysis">ESRD / Dialysis</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="hepatic-function">Hepatic Function</label>
                      <div className="relative">
                        <select 
                          id="hepatic-function" value={hepaticFunction} 
                          onChange={(e) => setHepaticFunction(e.target.value)}
                          className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                          suppressHydrationWarning
                        >
                          <option className="bg-[#121212] text-white" value="Normal">Normal</option>
                          <option className="bg-[#121212] text-white" value="Mild Impairment">Mild Impairment (Child-Pugh A)</option>
                          <option className="bg-[#121212] text-white" value="Moderate Impairment">Moderate Impairment (Child-Pugh B)</option>
                          <option className="bg-[#121212] text-white" value="Severe Impairment">Severe Impairment (Child-Pugh C)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="comorbidities">Comorbidities</label>
                      <input 
                        type="text" 
                        id="comorbidities" value={comorbidities} 
                        onChange={(e) => setComorbidities(e.target.value)} 
                        placeholder="e.g. Diabetes, Hypertension"
                        className="appearance-none w-full px-5 py-3.5 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white placeholder:text-slate-500 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                        suppressHydrationWarning
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="infection-history">History of Severe Infections</label>
                      <div className="relative">
                        <select 
                          id="infection-history" value={infectionHistory} 
                          onChange={(e) => setInfectionHistory(e.target.value)}
                          className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                          suppressHydrationWarning
                        >
                          <option className="bg-[#121212] text-white" value="No">No</option>
                          <option className="bg-[#121212] text-white" value="Yes">Yes</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="other-medications">Other Current Medications</label>
                      <input 
                        type="text" 
                        id="other-medications" value={otherMedications} 
                        onChange={(e) => setOtherMedications(e.target.value)} 
                        placeholder="e.g. Lisinopril, Metformin"
                        className="appearance-none w-full px-5 py-3.5 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white placeholder:text-slate-500 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                        suppressHydrationWarning
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-500 mb-2" htmlFor="cyp2d6-status">CYP2D6 Status</label>
                      <div className="relative">
                        <select 
                          id="cyp2d6-status" value={cyp2d6Status} 
                          onChange={(e) => setCyp2d6Status(e.target.value)}
                          className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
                          suppressHydrationWarning
                        >
                          <option className="bg-[#121212] text-white" value="Unknown">Unknown</option>
                          <option className="bg-[#121212] text-white" value="Poor">Poor Metabolizer</option>
                          <option className="bg-[#121212] text-white" value="Intermediate">Intermediate Metabolizer</option>
                          <option className="bg-[#121212] text-white" value="Normal">Normal Metabolizer</option>
                          <option className="bg-[#121212] text-white" value="Ultrarapid">Ultrarapid Metabolizer</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                      onClick={handleSearch}
                      disabled={!fromDrug || isSearching}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Analyzing Protocols...
                        </>
                      ) : (
                        <>
                          <Search size={18} />
                          Find Switching Protocols
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {!suggestions ? (
                <div className="text-center py-12 text-slate-400">
                  <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Configure therapy and patient context to see suggestions.</p>
                  <button onClick={() => setMainTab('setup')} className="mt-4 text-blue-400 hover:text-blue-300">Go to Setup</button>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <AlertTriangle size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No suitable replacements found for this specific scenario.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-white">Suggested Replacements</h3>
                    
                    {hasBiologicSuggestions && (
                      <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                        <label htmlFor="filter-indication" className="text-[12px] text-slate-400">Filter by Indication:</label>
                        <div className="relative">
                          <select 
                            id="filter-indication" value={suggestionFilter}
                            onChange={(e) => setSuggestionFilter(e.target.value)}
                            className="appearance-none bg-transparent text-white text-[13px] font-medium outline-none pr-6 py-1 pl-2 -ml-2 rounded-md focus:ring-2 focus:ring-blue-500/60 focus:bg-white/5 cursor-pointer transition-all"
                          >
                            <option className="bg-[#121212]" value="">All Indications</option>
                            {allIndications.map(ind => (
                              <option className="bg-[#121212]" key={ind} value={ind}>{ind}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-slate-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4">
                    {filteredSuggestions?.map((suggestion, index) => {
                      const profile = getDrugProfile(suggestion.drug);
                      const isBio = ['Biologics (TNF inhibitors)', 'Biologics (IL inhibitors)', 'Biologics (Integrin/Other)'].some(c => drugClasses[c as keyof typeof drugClasses]?.includes(suggestion.drug.toLowerCase()));
                      
                      return (
                        <div key={suggestion.drug} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-lg font-bold text-white capitalize">{suggestion.drug}</h4>
                                {index === 0 && (
                                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border border-emerald-500/20">
                                    Top Match
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-400">
                                <div>{profile?.brandNames?.join(', ')}</div>
                                {profile?.biosimilars && profile.biosimilars.length > 0 && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    (Biosimilars: {profile.biosimilars.join(', ')})
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-blue-400">{suggestion.score}</div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Match Score</div>
                            </div>
                          </div>

                          {isBio && biologicIndications[suggestion.drug.toLowerCase()] && (
                            <div className="mb-4 flex flex-wrap gap-2">
                              {biologicIndications[suggestion.drug.toLowerCase()].indications.map(ind => (
                                <span key={ind} className={`text-[11px] px-2 py-1 rounded-full border ${ind === indication || ind === suggestionFilter ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                  {ind}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="grid md:grid-cols-2 gap-6 mt-6">
                            <div>
                              <h5 className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-emerald-400" />
                                Rationale
                              </h5>
                              <ul className="space-y-2">
                                {suggestion.rationale.map((r, i) => (
                                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                    <span className="text-emerald-500 mt-1">•</span>
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <div>
                              <h5 className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <ShieldAlert size={14} className="text-amber-400" />
                                Side Effect Profile
                              </h5>
                              <div className="grid grid-cols-2 gap-2">
                                {profile && Object.entries({
                                  'Weight Gain': profile.weightGain,
                                  'Sedation': profile.sedation,
                                  'Sexual Dys.': profile.sexualDysfunction,
                                  'GI Upset': profile.giUpset
                                }).map(([key, value]) => (
                                  <div key={key} className="bg-black/20 rounded-lg p-2 flex justify-between items-center border border-white/5">
                                    <span className="text-[11px] text-slate-400">{key}</span>
                                    <span className={`text-[11px] font-medium ${
                                      value === 'High' ? 'text-rose-400' : 
                                      value === 'Moderate' ? 'text-amber-400' : 
                                      'text-emerald-400'
                                    }`}>{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                            <button 
                              onClick={() => setShowMonographFor(showMonographFor === suggestion.drug ? null : suggestion.drug)}
                              className="text-[13px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                            >
                              <BookOpen size={14} />
                              {showMonographFor === suggestion.drug ? 'Hide Protocol Details' : 'View Protocol Details'}
                            </button>
                          </div>

                          {showMonographFor === suggestion.drug && monographs[suggestion.drug.toLowerCase()] && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 bg-black/30 rounded-xl p-5 border border-white/5 text-sm text-slate-300 space-y-4"
                            >
                              <div>
                                <h6 className="font-medium text-white mb-1">Mechanism of Action</h6>
                                <p className="leading-relaxed">{monographs[suggestion.drug.toLowerCase()].mechanismOfAction}</p>
                              </div>
                              <div>
                                <h6 className="font-medium text-white mb-1">Contraindications</h6>
                                <ul className="list-disc pl-4 space-y-1">
                                  {monographs[suggestion.drug.toLowerCase()].contraindications.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h6 className="font-medium text-white mb-1">Side Effects Management</h6>
                                <ul className="list-disc pl-4 space-y-1">
                                  {monographs[suggestion.drug.toLowerCase()].sideEffectsManagement.map((se, i) => (
                                    <li key={i}><span className="text-amber-400">{se.effect}:</span> {se.management}</li>
                                  ))}
                                </ul>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
