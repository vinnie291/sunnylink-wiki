'use client';

import { Search } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export default function SearchButton() {
    const { t } = useLanguage();

    const handleClick = () => {
        window.dispatchEvent(new CustomEvent('open-universal-search'));
    };

    return (
        <button
            onClick={handleClick}
            className="group flex items-center justify-center gap-2 w-10 h-10 sm:w-auto sm:h-12 px-0 sm:px-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50 rounded-xl transition-all duration-200 shadow-sm"
            title={t('search.label')}
        >
            <Search className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            <span className="hidden sm:inline text-sm font-semibold text-slate-300 group-hover:text-white select-none">
                {t('search.label')}
            </span>
            <span className="hidden sm:inline text-[10px] text-slate-500 font-mono tracking-tighter bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-700/30">⌘ K</span>
        </button>
    );
}
