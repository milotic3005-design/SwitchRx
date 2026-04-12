import { Activity, MessageSquare, LayoutDashboard } from 'lucide-react';

export function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const navItems = [
    { id: 'switching', label: 'Switching Protocols', icon: Activity },
    { id: 'chat', label: 'Clinical Chat (RAG)', icon: MessageSquare },
  ];

  return (
    <div className="w-64 bg-[#121212] border-r border-white/5 flex flex-col h-full shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-white/5">
        <h1 className="text-[14px] font-medium text-slate-200 flex items-center gap-2">
          <div className="text-blue-500">
            <Activity size={16} strokeWidth={1.5} />
          </div>
          ClinicalRx AI
        </h1>
      </div>
      
      <div className="p-4">
        <p className="px-3 text-[12px] font-medium text-slate-500 mb-2">Main Menu</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[14px] transition-colors ${
                  isActive
                    ? 'bg-white/5 text-slate-200'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon size={16} strokeWidth={1.5} className={isActive ? "text-slate-200" : "text-slate-400"} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
