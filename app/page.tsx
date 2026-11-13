"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SwitchingProtocols } from '@/components/SwitchingProtocols';
import { CopilotGate } from '@/components/copilot/CopilotGate';
import { ClinicalCalculators } from '@/components/ClinicalCalculators';
import { DrugReference, resolveDrugByKey } from '@/components/DrugReference';
import { BreakRoom } from '@/components/BreakRoom';
import { MixingGuide } from '@/components/MixingGuide';
import { Starfield } from '@/components/Starfield';
import { CommandPalette } from '@/components/launcher/CommandPalette';
import { useShortcutHint } from '@/components/launcher/hooks';
import { Launcher } from '@/components/launcher/Launcher';
import { TOOL_ICONS } from '@/components/launcher/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { Activity, Search, Sun, Moon } from 'lucide-react';
import { onOpenDrug, onAskCopilot } from '@/lib/cross-tab-events';
import { DRUG_DB } from '@/data/drug-database';
import { TOOLS, type CalcId, type TabId } from '@/lib/launcher/catalog';
import { isPaletteShortcut } from '@/lib/launcher/panel-state';
import { recordRecent } from '@/lib/launcher/recents';
import type { Target } from '@/lib/launcher/search';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'home' | TabId>('home');
  // Cross-tab navigation state. Each "pending" payload carries a token so the
  // child component re-applies the request even when the same drug/scenario
  // is requested twice in a row (otherwise the prop value wouldn't change and
  // useEffect would no-op).
  const [pendingDrug, setPendingDrug] = useState<{ drugKey: string; token: number } | null>(null);
  const [pendingScenario, setPendingScenario] = useState<{ scenario: string; autoSubmit: boolean; token: number } | null>(null);
  const [pendingCalc, setPendingCalc] = useState<{ id: CalcId; token: number } | null>(null);
  const [pendingMixing, setPendingMixing] = useState<{ drugKey: string; token: number } | null>(null);

  // The search: a dialog on Cmd+K from any tool. On the home page the shortcut focuses the home search box.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const homeSearchRef = useRef<HTMLInputElement>(null);
  const shortcutHint = useShortcutHint();

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
      const drug = resolveDrugByKey(drugKey);
      if (drug) recordRecent({ kind: 'drug', id: drug.id, dest: 'reference' });
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

  // Every jump made from the search or the launcher goes through here: it switches the tab and hands the
  // tool its request with a fresh token, so the same request applies twice in a row.
  const go = useCallback((target: Target) => {
    setPaletteOpen(false);
    // The tabs share one window scroll: without this a jump made deep in one page lands deep in the next.
    window.scrollTo(0, 0);
    const token = Date.now();
    if (target.kind === 'tool') {
      setActiveTab(target.tab);
    } else if (target.kind === 'calculator') {
      setActiveTab('calculators');
      setPendingCalc({ id: target.id, token });
      recordRecent({ kind: 'calculator', id: target.id });
    } else if (target.kind === 'ask') {
      setActiveTab('infusion');
      setPendingScenario({ scenario: target.text, autoSubmit: false, token });
    } else {
      const drug = DRUG_DB.find(d => d.id === target.id);
      if (!drug) return;
      if (target.dest === 'mixing') {
        setActiveTab('mixing');
        setPendingMixing({ drugKey: drug.id, token });
      } else if (target.dest === 'reference') {
        setActiveTab('drugref');
        setPendingDrug({ drugKey: drug.id, token });
      } else {
        // The question box gets the drug's name, unsent, for the user to finish the question.
        setActiveTab('infusion');
        setPendingScenario({ scenario: `${drug.genericName}: `, autoSubmit: false, token });
      }
      recordRecent({ kind: 'drug', id: drug.id, dest: target.dest });
    }
  }, []);

  const openSearch = useCallback(() => {
    if (homeSearchRef.current) homeSearchRef.current.focus();
    else setPaletteOpen(open => !open);
  }, []);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e)) return;
      e.preventDefault();
      openSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearch]);

  // Memoize each tab's content so a tab switch (which only flips `activeTab`)
  // doesn't re-render every mounted tab subtree. All tabs stay mounted to
  // preserve their local state, but their elements are referentially stable
  // here — keyed only on the props that actually change — so React reuses them
  // and skips reconciling the heavy subtrees (e.g. the 234-card Drug Reference)
  // on every nav click. This is what keeps tab switching snappy.
  const switchingTab = useMemo(() => (
    <div className="pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full">
      <PageHeader
        icon={TOOL_ICONS.switching}
        title="Switching Protocols"
        description="Evidence-based replacement therapies tailored to patient outcomes."
      />
      <SwitchingProtocols />
    </div>
  ), []);

  const infusionTab = useMemo(() => (
    <div className="pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full">
      <CopilotGate prefillScenario={pendingScenario} />
    </div>
  ), [pendingScenario]);

  const calculatorsTab = useMemo(() => <ClinicalCalculators openCalc={pendingCalc} />, [pendingCalc]);

  const drugRefTab = useMemo(() => <DrugReference openDrug={pendingDrug} />, [pendingDrug]);

  const mixingTab = useMemo(() => <MixingGuide openDrug={pendingMixing} />, [pendingMixing]);

  const breakRoomTab = useMemo(() => <BreakRoom />, []);

  return (
    <div className="min-h-screen flex flex-col text-slate-200">
      <Starfield />
      {/* Top Navigation */}
      <header className="absolute top-0 w-full h-24 flex items-center justify-between gap-4 px-6 md:px-12 z-50">
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
            type="button"
            onClick={openSearch}
            aria-label="Search drugs and tools"
            className="text-[13px] font-medium transition-all px-3 py-2 rounded-full flex items-center gap-1.5 whitespace-nowrap text-slate-400 hover:text-white hover:bg-white/5"
          >
            <Search size={14} strokeWidth={2.5} aria-hidden="true" />
            <span className="hidden 2xl:inline">Search</span>
            <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 font-sans text-[13px] text-slate-500">{shortcutHint}</kbd>
          </button>
          {TOOLS.map(tool => {
            const Icon = TOOL_ICONS[tool.tab];
            return (
              <button
                key={tool.tab}
                type="button"
                onClick={() => setActiveTab(tool.tab)}
                aria-label={tool.label}
                aria-current={activeTab === tool.tab ? 'page' : undefined}
                className={`text-[13px] font-medium transition-all px-3 xl:px-4 py-2 rounded-full flex items-center gap-1.5 whitespace-nowrap ${activeTab === tool.tab ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                {/* The full names fit from 1280px, and the icons with them from 1536px; below 1280px the
                    short names keep every label on one line. */}
                <Icon size={13} strokeWidth={2.5} className="hidden 2xl:block" aria-hidden="true" />
                <span className="xl:hidden">{tool.shortLabel}</span>
                <span className="hidden xl:inline">{tool.label}</span>
              </button>
            );
          })}
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
        {activeTab === 'home' && <Launcher onGo={go} searchInputRef={homeSearchRef} />}

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

        <div className={activeTab === 'calculators' ? 'contents' : 'hidden'}>
          {calculatorsTab}
        </div>

        <div className={activeTab === 'drugref' ? 'contents' : 'hidden'}>
          {drugRefTab}
        </div>

        <div className={activeTab === 'mixing' ? 'contents' : 'hidden'}>
          {mixingTab}
        </div>

        <div className={activeTab === 'breakroom' ? 'contents' : 'hidden'}>
          {breakRoomTab}
        </div>
      </main>

      {/* Inside the root element, not under <body> and not in the menu: see CommandPalette. */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onGo={go} />
    </div>
  );
}
