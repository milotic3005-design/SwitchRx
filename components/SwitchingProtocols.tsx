"use client";
import { useState } from 'react';
import { suggestReplacements, ReplacementSuggestion } from '@/lib/clinical-logic';
import { getDrugProfile, DrugProfile, drugClasses, biologicIndications } from '@/lib/drug-db';
import { monographs } from '@/lib/drug-monographs';
import { ArrowRight, AlertTriangle, CheckCircle2, BookOpen, Activity, ShieldAlert, Info, X, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

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
  const [otherMedications, setOtherMedications] = useState('');
  const [cyp2d6Status, setCyp2d6Status] = useState('Unknown');

  const [suggestions, setSuggestions] = useState<ReplacementSuggestion[] | null>(null);
  const [showMonographFor, setShowMonographFor] = useState<string | null>(null);
  const [suggestionFilter, setSuggestionFilter] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const allIndications = Array.from(new Set(Object.values(biologicIndications).flat())).sort();

  const handleSearch = async () => {
    if (!fromDrug) return;
    
    setSuggestions(null);
    setIsSearching(true);
    
    // Simulate a brief calculation delay for better UX and animation
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
        otherMedications,
        cyp2d6Status
      }
    });
    setSuggestions(results);
    setIsSearching(false);
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

  return (
    <div className="w-full">
      <div className="bg-[#121212] p-6 md:p-8 rounded-xl border border-white/5 mb-8" suppressHydrationWarning>
        
        {/* Patient Context Section */}
        <div className="mb-10 bg-white/5 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-5 border-b border-white/5 pb-3">
            <div className="text-indigo-400">
              <Info size={16} strokeWidth={1.5} />
            </div>
            <h3 className="font-medium text-slate-200 text-[14px]">Patient Context (Optional)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">Age (yrs)</label>
              <input 
                type="number" 
                value={age} 
                onChange={(e) => setAge(e.target.value)} 
                placeholder="e.g. 45"
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 placeholder:text-slate-500 transition-colors"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">Weight (kg)</label>
              <input 
                type="number" 
                value={weight} 
                onChange={(e) => setWeight(e.target.value)} 
                placeholder="e.g. 70"
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 placeholder:text-slate-500 transition-colors"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">Renal Function</label>
              <select 
                value={renalFunction} 
                onChange={(e) => setRenalFunction(e.target.value)}
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                suppressHydrationWarning
              >
                <option value="Normal">Normal</option>
                <option value="Mild Impairment">Mild Impairment</option>
                <option value="Moderate Impairment">Moderate Impairment</option>
                <option value="Severe Impairment">Severe Impairment</option>
                <option value="ESRD/Dialysis">ESRD / Dialysis</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">Hepatic Function</label>
              <select 
                value={hepaticFunction} 
                onChange={(e) => setHepaticFunction(e.target.value)}
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                suppressHydrationWarning
              >
                <option value="Normal">Normal</option>
                <option value="Mild Impairment">Mild Impairment</option>
                <option value="Moderate Impairment">Moderate Impairment</option>
                <option value="Severe Impairment">Severe Impairment</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">Comorbidities</label>
              <input 
                type="text" 
                value={comorbidities} 
                onChange={(e) => setComorbidities(e.target.value)} 
                placeholder="e.g. Diabetes, Hypertension"
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 placeholder:text-slate-500 transition-colors"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">Other Current Medications</label>
              <input 
                type="text" 
                value={otherMedications} 
                onChange={(e) => setOtherMedications(e.target.value)} 
                placeholder="e.g. Lisinopril, Metformin"
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 placeholder:text-slate-500 transition-colors"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">CYP2D6 Status</label>
              <select 
                value={cyp2d6Status} 
                onChange={(e) => setCyp2d6Status(e.target.value)}
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                suppressHydrationWarning
              >
                <option value="Unknown">Unknown</option>
                <option value="Poor">Poor Metabolizer</option>
                <option value="Intermediate">Intermediate Metabolizer</option>
                <option value="Normal">Normal Metabolizer</option>
                <option value="Ultrarapid">Ultrarapid Metabolizer</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Left Side: Current Therapy */}
          <div className="md:col-span-5 space-y-5">
            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
              <div className="text-blue-400">
                <Activity size={16} strokeWidth={1.5} />
              </div>
              <h3 className="font-medium text-slate-200 text-[14px]">Current Therapy</h3>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[12px] font-medium text-slate-500">Current Medication</label>
              </div>
              <select 
                value={fromDrug}
                onChange={(e) => {
                  setFromDrug(e.target.value);
                  setCurrentDose('');
                }}
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                suppressHydrationWarning
              >
                <option value="">Select a medication...</option>
                {Object.entries(drugClasses).map(([className, drugs]) => (
                  <optgroup key={className} label={className}>
                    {getSortedDrugs(drugs).map(drug => {
                      const profile = getDrugProfile(drug);
                      const brandStr = profile?.brandNames && profile.brandNames.length > 0 ? ` (${profile.brandNames.join(', ')})` : '';
                      return <option key={drug} value={drug}>{profile?.name || drug}{brandStr}</option>;
                    })}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-2">Current Dose</label>
                <select 
                  value={currentDose}
                  onChange={(e) => setCurrentDose(e.target.value)}
                  disabled={!fromDrug}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors disabled:opacity-50"
                  suppressHydrationWarning
                >
                  <option value="">{fromDrug ? "Select dose..." : "Select drug first"}</option>
                  {fromDrug && getDrugProfile(fromDrug)?.availableDoses?.map(dose => (
                    <option key={dose} value={dose}>{dose} mg</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-2">Duration</label>
                <select 
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                  suppressHydrationWarning
                >
                  {durations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {isBiologic && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-[12px] font-medium text-slate-500 mb-2">Disease State / Indication</label>
                <select 
                  value={indication}
                  onChange={(e) => setIndication(e.target.value)}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                  suppressHydrationWarning
                >
                  <option value="">Select indication...</option>
                  {biologicIndications[fromDrug.toLowerCase()]?.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Center Arrow */}
          <div className="md:col-span-2 flex justify-center items-center h-full pt-8">
            <div className="text-slate-500">
              <ArrowRight size={16} strokeWidth={1.5} />
            </div>
          </div>

          {/* Right Side: Desired Outcomes */}
          <div className="md:col-span-5 space-y-5">
            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
              <div className="text-emerald-400">
                <CheckCircle2 size={16} strokeWidth={1.5} />
              </div>
              <h3 className="font-medium text-slate-200 text-[14px]">Desired Outcomes</h3>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">Reason for Switching</label>
              <select 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                suppressHydrationWarning
              >
                {reasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2">Optional Secondary Effect</label>
              <select 
                value={secondaryEffect}
                onChange={(e) => setSecondaryEffect(e.target.value)}
                className="w-full px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                suppressHydrationWarning
              >
                <option value="none">No specific preference</option>
                <option value="weight_loss">Weight Neutral / Favorable</option>
                <option value="improved_sleep">Help with Sleeping (Sedating)</option>
                <option value="activating">Increased Energy (Activating)</option>
                <option value="low_sexual_se">Low Sexual Side Effects</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/5 flex justify-end">
          <motion.button 
            onClick={handleSearch}
            disabled={!fromDrug || isSearching}
            whileTap={!fromDrug || isSearching ? undefined : { scale: 0.95 }}
            className="bg-white text-black hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white px-6 py-2 rounded-lg font-medium text-[14px] transition-all flex items-center gap-2"
            suppressHydrationWarning
          >
            {isSearching ? (
              <>
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search size={16} strokeWidth={1.5} />
                Find Replacements
              </>
            )}
          </motion.button>
        </div>
      </div>

      {suggestions && suggestions.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex items-start gap-4"
        >
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} strokeWidth={1.5} />
          <div>
            <h3 className="font-medium text-amber-500 text-[14px]">No Direct Replacements Found</h3>
            <p className="text-amber-500/80 text-[14px] mt-1">
              Could not find suitable replacement therapies based on the provided parameters. Please consult clinical guidelines.
            </p>
          </div>
        </motion.div>
      )}

      {suggestions && suggestions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-2 mb-2">
            <h3 className="text-[16px] font-medium text-white">Suggested Replacement Therapies</h3>
            
            {isBiologic && (
              <div className="flex items-center gap-3">
                <label className="text-[12px] font-medium text-slate-500">Filter by Indication:</label>
                <select
                  value={suggestionFilter}
                  onChange={(e) => setSuggestionFilter(e.target.value)}
                  className="px-3 py-2 border border-white/10 rounded-lg focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 transition-colors"
                  suppressHydrationWarning
                >
                  <option value="">All Indications</option>
                  {allIndications.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          {suggestions.filter(s => !suggestionFilter || biologicIndications[s.drug.toLowerCase()]?.includes(suggestionFilter)).length === 0 ? (
            <div className="bg-white/5 border border-white/5 rounded-xl p-6 text-center text-[14px] text-slate-500">
              No suggestions match the selected indication filter.
            </div>
          ) : (
            suggestions.filter(s => !suggestionFilter || biologicIndications[s.drug.toLowerCase()]?.includes(suggestionFilter)).map((suggestion, idx) => {
              const profile = getDrugProfile(suggestion.drug);
              return (
            <div key={idx} className="bg-[#121212] border border-white/10 rounded-xl overflow-hidden">
              <div className="bg-white/5 px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-emerald-400">
                    <CheckCircle2 size={16} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-200 text-[16px] flex items-baseline gap-2">
                      <span className="capitalize">{profile?.name || suggestion.drug}</span>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-md">Generic</span>
                    </h3>
                    {(profile?.brandNames || profile?.biosimilars) && (
                      <div className="text-[12px] text-slate-400 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {profile.brandNames && profile.brandNames.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-500">Common Brands:</span> 
                            <span>{profile.brandNames.join(', ')}</span>
                          </div>
                        )}
                        {profile.biosimilars && profile.biosimilars.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-500">Biosimilars:</span> 
                            <span>{profile.biosimilars.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {monographs[suggestion.drug.toLowerCase()] && (
                  <button 
                    onClick={() => setShowMonographFor(suggestion.drug.toLowerCase())}
                    className="text-[12px] text-slate-300 hover:text-white flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg font-medium transition-colors border border-white/5"
                  >
                    <BookOpen size={14} strokeWidth={1.5} />
                    View Monograph
                  </button>
                )}
              </div>
              
              <div className="p-6 space-y-6">
                {suggestion.warnings && suggestion.warnings.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                    <h4 className="text-[12px] font-medium text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <AlertTriangle size={14} strokeWidth={1.5} />
                      Contraindication Warnings
                    </h4>
                    <ul className="space-y-2">
                      {suggestion.warnings.map((warning, i) => (
                        <li key={i} className="text-red-300 text-[14px] flex items-start gap-2">
                          <span className="text-red-500/50 mt-0.5">•</span>
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
                  <h4 className="text-[12px] font-medium text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Info size={14} strokeWidth={1.5} />
                    Why this was suggested
                  </h4>
                  <ul className="space-y-2">
                    {suggestion.rationale.map((reason, i) => (
                      <li key={i} className="text-blue-300 text-[14px] flex items-start gap-2">
                        <span className="text-blue-500/50 mt-0.5">•</span>
                        <span className="first-letter:capitalize">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-3">Switching Strategy</h4>
                  <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                    <p className="text-[14px] text-slate-300 leading-relaxed whitespace-pre-wrap">{suggestion.protocol.protocol}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-3">Monitoring Parameters</h4>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {suggestion.protocol.monitoring.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-[14px] text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5">
                        <Activity className="text-blue-400 shrink-0 mt-0.5" size={14} strokeWidth={1.5} />
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="text-slate-500" size={14} strokeWidth={1.5} />
                    <h4 className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">Academic References</h4>
                  </div>
                  <ul className="space-y-2">
                    {suggestion.protocol.references.map((ref: string, i: number) => (
                      <li key={i} className="text-[12px] text-slate-400 flex items-start gap-2">
                        <span className="text-slate-600 mt-0.5">•</span>
                        {ref}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            );
            })
          )}
        </motion.div>
      )}

      {/* Monograph Modal */}
      {showMonographFor && monographs[showMonographFor] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <h3 className="text-[16px] font-medium text-slate-200 flex items-center gap-3">
                <div className="text-blue-400">
                  <BookOpen size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="capitalize">{getDrugProfile(showMonographFor)?.name || showMonographFor}</span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-md">Generic</span>
                    <span className="text-[12px] font-normal text-slate-500 ml-1">Monograph</span>
                  </div>
                  {(getDrugProfile(showMonographFor)?.brandNames || getDrugProfile(showMonographFor)?.biosimilars) && (
                    <div className="text-[12px] font-normal text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {getDrugProfile(showMonographFor)?.brandNames && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-500">Common Brands:</span> 
                          <span>{getDrugProfile(showMonographFor)?.brandNames?.join(', ')}</span>
                        </div>
                      )}
                      {getDrugProfile(showMonographFor)?.biosimilars && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-500">Biosimilars:</span> 
                          <span>{getDrugProfile(showMonographFor)?.biosimilars?.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </h3>
              <button 
                onClick={() => setShowMonographFor(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <h4 className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2">Mechanism of Action</h4>
                <p className="text-slate-300 text-[14px] leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">{monographs[showMonographFor].mechanismOfAction}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                  <h4 className="text-[12px] font-medium text-blue-400 uppercase tracking-wider mb-2">Indications</h4>
                  <ul className="list-disc list-inside text-[14px] text-blue-200/80 space-y-1">
                    {monographs[showMonographFor].indications.map((ind, i) => (
                      <li key={i}>{ind}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <h4 className="text-[12px] font-medium text-red-400 uppercase tracking-wider mb-2">Contraindications</h4>
                  <ul className="list-disc list-inside text-[14px] text-red-200/80 space-y-1">
                    {monographs[showMonographFor].contraindications.map((contra, i) => (
                      <li key={i}>{contra}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2">Pharmacokinetics</h4>
                <div className="bg-white/5 rounded-xl p-4 border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[14px]">
                  <div>
                    <span className="block text-slate-500 text-[10px] mb-1 uppercase tracking-wider">Half-Life</span>
                    <span className="font-medium text-slate-200">{monographs[showMonographFor].pharmacokinetics.halfLife}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px] mb-1 uppercase tracking-wider">Metabolism</span>
                    <span className="font-medium text-slate-200">{monographs[showMonographFor].pharmacokinetics.metabolism}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px] mb-1 uppercase tracking-wider">Excretion</span>
                    <span className="font-medium text-slate-200">{monographs[showMonographFor].pharmacokinetics.excretion}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[12px] font-medium text-slate-500 uppercase tracking-wider mb-2">Side Effects & Management</h4>
                <div className="space-y-2">
                  {monographs[showMonographFor].sideEffectsManagement.map((se, i) => (
                    <div key={i} className="border border-white/5 bg-white/5 rounded-xl p-4">
                      <span className="font-medium text-slate-200 block mb-1 text-[14px]">{se.effect}</span>
                      <span className="text-[14px] text-slate-400 leading-relaxed">{se.management}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
