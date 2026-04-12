"use client";
import { useState } from 'react';
import { SwitchingProtocols } from '@/components/SwitchingProtocols';
import { ClinicalChat } from '@/components/ClinicalChat';
import { Sidebar } from '@/components/Sidebar';
import { Bell, Search, User } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('switching');

  const getPageTitle = () => {
    switch (activeTab) {
      case 'switching': return 'Switching Protocols';
      case 'chat': return 'Clinical Chat (RAG)';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex font-sans text-slate-200">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-[#121212] border-b border-white/5 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-medium text-[14px] text-slate-200">{getPageTitle()}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} strokeWidth={1.5} />
              <input 
                type="text" 
                placeholder="Search" 
                className="h-9 w-64 rounded-md border border-white/10 bg-white/5 pl-9 pr-4 text-[14px] text-slate-200 outline-none focus:border-white/20 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'switching' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-[20px] font-medium tracking-tight text-white">Medication Switching</h1>
                  <p className="text-[14px] text-slate-400 mt-1">Evidence-based replacement therapies tailored to patient outcomes.</p>
                </div>
                <SwitchingProtocols />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="h-[calc(100vh-10rem)]">
                <ClinicalChat />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
