import type { LucideIcon } from 'lucide-react';

/** A tool page's header: the tool's icon in a violet tile, a white title, and a one-line description. */
export function PageHeader({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
        <span className="bg-violet-500/10 p-2.5 rounded-xl border border-violet-500/20">
          <Icon className="text-violet-400" size={20} strokeWidth={2} aria-hidden="true" />
        </span>
        {title}
      </h1>
      <p className="text-[15px] text-slate-400 mt-2">{description}</p>
    </div>
  );
}
