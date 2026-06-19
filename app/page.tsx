"use client";
import { useState, useEffect, useMemo } from 'react';
import { SwitchingProtocols } from '@/components/SwitchingProtocols';
import { ClinicalChat } from '@/components/ClinicalChat';
import { InfusionConsult } from '@/components/InfusionConsult';
import { ClinicalCalculators } from '@/components/ClinicalCalculators';
import { DrugReference } from '@/components/DrugReference';
import { BreakRoom } from '@/components/BreakRoom';
import { Starfield } from '@/components/Starfield';
import { Activity, ArrowRight, MessageSquare, Network, Calculator, FlaskConical, Coffee, Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { onOpenDrug, onAskCopilot } from '@/lib/cross-tab-events';

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  // Cross-tab navigation state. Each "pending" payload carries a token so the
  // child component re-applies the request even when the same drug/scenario
  // is requested twice in a row (otherwise the prop value wouldn't change and
  // useEffect would no-op).
  const [pendingDrug, setPendingDrug] = useState<{ drugKey: string; token: number } | null>(null);
  const [pendingScenario, setPendingScenario] = useState<{ scenario: string; autoSubmit: boolean; token: number } | null>(null);

  // Theme. The pre-paint script in layout.tsx already set the <html> class from
  // localStorage to avoid a flash; here we mirror it into React state on mount.
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    let stored: 'dark' | 'light' | null = null;
    try {
      stored = localStorage.getItem('theme') as 'dark' | 'light' | null;
    } catch {}
    if (stored) setTheme(stored);
    setThemeReady(true);
  }, []);
  // Keep the DOM class and localStorage in sync with state. Running the side
  // effect here (not inside the setState updater) keeps it idempotent and safe
  // under React StrictMode's double-invocation. Skip until the initial read is
  // done so we don't clobber the stored value with the default on first render.
  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.classList.toggle('light', theme === 'light');
    try {
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme, themeReady]);
  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  useEffect(() => {
    const offDrug = onOpenDrug(({ drugKey }) => {
      setActiveTab('drugref');
      setPendingDrug({ drugKey, token: Date.now() });
    });
    const offCopilot = onAskCopilot(({ scenario, autoSubmit }) => {
      setActiveTab('infusion');
      setPendingScenario({ scenario, autoSubmit: !!autoSubmit, token: Date.now() });
    });
    return () => {
      offDrug();
      offCopilot();
    };
  }, []);

  // Memoize each tab's content so a tab switch (which only flips `activeTab`)
  // doesn't re-render every mounted tab subtree. All tabs stay mounted to
  // preserve their local state, but their elements are referentially stable
  // here — keyed only on the props that actually change — so React reuses them
  // and skips reconciling the heavy subtrees (e.g. the 234-card Drug Reference)
  // on every nav click. This is what keeps tab switching snappy.
  const switchingTab = useMemo(() => (
    <div className="pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <div className="cc-eyebrow mb-3">Protocols</div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--cc-gold-warm)' }}>
          Medication Switching
        </h1>
        <p className="text-[15px] text-slate-400 mt-3">Evidence-based replacement therapies tailored to patient outcomes.</p>
      </div>
      <SwitchingProtocols />
    </div>
  ), []);

  const infusionTab = useMemo(() => (
    <div className="pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full">
      <InfusionConsult prefillScenario={pendingScenario} />
    </div>
  ), [pendingScenario]);

  const chatTab = useMemo(() => (
    <div className="pt-28 pb-8 px-6 md:px-12 max-w-5xl mx-auto w-full h-screen">
      <ClinicalChat />
    </div>
  ), []);

  const calculatorsTab = useMemo(() => <ClinicalCalculators />, []);

  const drugRefTab = useMemo(() => <DrugReference openDrug={pendingDrug} />, [pendingDrug]);

  const breakRoomTab = useMemo(() => <BreakRoom />, []);

  return (
    <div className="min-h-screen flex flex-col text-slate-200">
      <Starfield />
      {/* Top Navigation */}
      <header className="absolute top-0 w-full h-24 flex items-center justify-between px-6 md:px-12 z-50">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setActiveTab('home')}
        >
          <div className="bg-blue-500/10 p-2.5 rounded-md group-hover:bg-blue-500/20 transition-colors border border-blue-500/20">
            <Activity className="text-blue-400" size={20} strokeWidth={2} />
          </div>
          <span className="text-white text-xl font-bold tracking-tight whitespace-nowrap">ClinicalRx AI</span>
        </div>
        <nav className="flex items-center gap-1 md:gap-2 bg-white/5 px-2 py-2 rounded-full border border-white/10 backdrop-blur-md">
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
          <button
            onClick={() => setActiveTab('breakroom')}
            className={`text-[13px] font-medium transition-all px-4 py-2 rounded-full flex items-center gap-1.5 ${activeTab === 'breakroom' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Coffee size={13} strokeWidth={2.5} />
            Break Room
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="ml-1 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col">
        {activeTab === 'home' && (
          <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-screen">
            {/* Background Effects — cosmic violet / teal / wine washes */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[130px] mix-blend-screen" style={{ background: 'rgba(154,108,255,0.22)' }} />
              <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-[130px] mix-blend-screen" style={{ background: 'rgba(95,168,162,0.16)' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[820px] rounded-full blur-[130px] mix-blend-screen" style={{ background: 'rgba(227,194,126,0.08)' }} />
            </div>

            <div className="relative z-10 text-center max-w-5xl px-8 flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="cc-eyebrow inline-flex items-center gap-2.5 mb-8"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--cc-gold)' }}></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--cc-gold)' }}></span>
                </span>
                Clinical Intelligence Platform
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
                className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]"
                style={{ color: 'var(--cc-gold-warm)' }}
              >
                Precision Medicine <br/>
                <span style={{ fontStyle: 'italic', color: 'var(--cc-gold)' }}>At Scale</span>
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="mb-8"
                style={{ width: 70, height: 1, background: 'rgba(227,194,126,0.5)' }}
              />

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                className="text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed"
                style={{ color: 'var(--cc-muted)' }}
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

        {/* The working tabs stay MOUNTED and toggle visibility with `hidden`
            instead of conditional rendering. Unmounting a tab would reset all
            of its local React state (typed scenarios, generated briefs, chat
            history, calculator inputs), so switching tabs and coming back used
            to wipe progress. Keeping them mounted preserves that state. The
            home tab has no state, so it stays conditionally rendered. */}
        <div className={activeTab === 'switching' ? 'contents' : 'hidden'}>
          {switchingTab}
        </div>

        <div className={activeTab === 'infusion' ? 'contents' : 'hidden'}>
          {infusionTab}
        </div>

        <div className={activeTab === 'chat' ? 'contents' : 'hidden'}>
          {chatTab}
        </div>

        <div className={activeTab === 'calculators' ? 'contents' : 'hidden'}>
          {calculatorsTab}
        </div>

        <div className={activeTab === 'drugref' ? 'contents' : 'hidden'}>
          {drugRefTab}
        </div>

        <div className={activeTab === 'breakroom' ? 'contents' : 'hidden'}>
          {breakRoomTab}
        </div>
      </main>
    </div>
  );
}
