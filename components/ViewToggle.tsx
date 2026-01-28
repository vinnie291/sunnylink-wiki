import { motion } from 'framer-motion';

interface ViewToggleProps {
    viewMode: 'grid' | 'list';
    onChange: (mode: 'grid' | 'list') => void;
    id?: string;
}

export default function ViewToggle({ viewMode, onChange, id = 'view-toggle' }: ViewToggleProps) {
    return (
        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 backdrop-blur-sm">
            <button
                onClick={() => onChange('grid')}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'grid' ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
                aria-label="Grid view"
            >
                {viewMode === 'grid' && (
                    <motion.div
                        layoutId={`${id}-active`}
                        className="absolute inset-0 bg-cyan-500/20 border border-cyan-500/30 rounded-lg shadow-sm"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                )}
                <span className="relative z-10 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    <span className="sr-only">Grid</span>
                </span>
            </button>
            <button
                onClick={() => onChange('list')}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
                aria-label="List view"
            >
                {viewMode === 'list' && (
                    <motion.div
                        layoutId={`${id}-active`}
                        className="absolute inset-0 bg-cyan-500/20 border border-cyan-500/30 rounded-lg shadow-sm"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                )}
                <span className="relative z-10 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    <span className="sr-only">List</span>
                </span>
            </button>
        </div>
    );
}
