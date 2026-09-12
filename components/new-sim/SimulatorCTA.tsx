import { ArrowUpRight, Route } from 'lucide-react';

export default function SimulatorCTA({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Explore the new Driving Lab simulator"
      className="group w-full rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-slate-900/40 to-violet-500/10 p-4 text-left transition-colors hover:border-cyan-400/60 hover:from-cyan-500/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400"><Route size={18} /></span>
        <span className="flex-1 text-sm font-semibold text-slate-100">Driving Lab</span>
        <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-400">New</span>
      </span>
      <span className="mt-3 block text-xs leading-relaxed text-slate-400">Compare model behavior on realistic 3D roads.</span>
      <span className="mt-3 flex items-center justify-between text-xs font-medium text-cyan-400">Open simulator <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" /></span>
    </button>
  );
}
