"use client";
import { useState } from 'react';
import { SwitchingProtocols } from '@/components/SwitchingProtocols';
import { ClinicalChat } from '@/components/ClinicalChat';
import { InfusionConsult } from '@/components/InfusionConsult';
import { ClinicalCalculators } from '@/components/ClinicalCalculators';
import { DrugReference } from '@/components/DrugReference';
import { Activity, ArrowRight, MessageSquare, Network, Calculator, FlaskConical } from 'lucide-react';
import { motion } from 'motion/react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-200 selection:bg-blue-500/30">
      {/* Top Navigation */}
      <header className="absolute top-0 w-full h-24 flex items-center justify-between px-6 md:px-12 z-50">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => setActiveTab('home')}
        >
          <div className="bg-blue-500/10 p-2.5 rounded-xl group-hover:bg-blue-500/20 transition-colors border border-blue-500/20">
            <Activity className="text-blue-400" size={20} strokeWidth={2} />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">ClinicalRx AI</span>
        </div>
        <nav className="flex items-center gap-2 md:gap-4 bg-white/5 px-2 py-2 rounded-full border border-white/10 backdrop-blur-md">
          <button 
            onClick={() => setActiveTab('switching')} 
            className={`text-[13px] font-medium transition-all px-4 py-2 rounded-full ${activeTab === 'switching' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Switching Protocols
          </button>
          <button 
            onClick={() => setActiveTab('infusion')} 
            className={`text-[13px] font-medium transition-all px-4 py-2 rounded-full ${activeTab === 'infusion' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Infusion Copilot
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`text-[13px] font-medium transition-all px-4 py-2 rounded-full ${activeTab === 'chat' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            Clinical Chat
          </button>
          <button
            onClick={() => setActiveTab('calculators')}
            className={`text-[13px] font-medium transition-all px-4 py-2 rounded-full flex items-center gap-1.5 ${activeTab === 'calculators' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Calculator size={13} strokeWidth={2.5} />
            Clinical Calculators
          </button>
          <button
            onClick={() => setActiveTab('drugref')}
            className={`text-[13px] font-medium transition-all px-4 py-2 rounded-full flex items-center gap-1.5 ${activeTab === 'drugref' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <FlaskConical size={13} strokeWidth={2.5} />
            Drug Reference
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col">
        {activeTab === 'home' && (
          <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-screen">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen" />
              <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px] mix-blend-screen" />
            </div>
            
            <div className="relative z-10 text-center max-w-5xl px-8 flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[13px] font-medium mb-8"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Clinical Intelligence Platform
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
                className="text-5xl md:text-7xl lg:text-8xl font-bold text-white tracking-tighter mb-8 leading-[1.1]"
              >
                Precision Medicine <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 pr-2">
                  At Scale
                </span>
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
              >
                Empower your clinical practice with AI-driven medication switching protocols and evidence-based clinical chat.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mt-4"
              >
                <button 
                  onClick={() => setActiveTab('switching')} 
                  className="btn-premium w-full sm:w-auto px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 group text-[15px]"
                >
                  Explore Protocols
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => setActiveTab('infusion')} 
                  className="glass-card w-full sm:w-auto px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-[15px] border border-white/10 text-white"
                >
                  <Network size={18} className="text-blue-400" />
                  Infusion Copilot
                </button>
                <button 
                  onClick={() => setActiveTab('chat')} 
                  className="glass-card w-full sm:w-auto px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-[15px] border border-white/10 text-white"
                >
                  <MessageSquare size={18} className="text-emerald-400" />
                  Clinical Chat
                </button>
              </motion.div>
            </div>
          </div>
        )}

        {activeTab === 'switching' && (
          <div className="pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">Medication Switching</h1>
              <p className="text-[15px] text-slate-400 mt-2">Evidence-based replacement therapies tailored to patient outcomes.</p>
            </div>
            <SwitchingProtocols />
          </div>
        )}

        {activeTab === 'infusion' && (
          <div className="pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
            <InfusionConsult />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="pt-28 pb-8 px-6 md:px-12 max-w-5xl mx-auto w-full h-screen animate-in fade-in duration-500">
            <ClinicalChat />
          </div>
        )}

        {activeTab === 'calculators' && <ClinicalCalculators />}

        {activeTab === 'drugref' && <DrugReference />}
      </main>
    </div>
  );
}
