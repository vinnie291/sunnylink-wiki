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
            className="group flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-800/50 hover:bg-cyan-500/10 border border-slate-700/50 hover:border-cyan-500/50 rounded-full transition-all duration-200"
            title="Search (Cmd+K)"
        >
            <Search className="w-4 h-4 text-slate-400 group-hover:text-cyan-400" />
            <span className="hidden lg:inline text-xs font-semibold text-slate-400 group-hover:text-cyan-400 pr-1 select-none">
                {t('search.label')}
            </span>
            <span className="inline lg:hidden sm:inline text-xs font-semibold text-slate-400 group-hover:text-cyan-400 pr-1 select-none">
                {t('search.label')}
            </span>
            <span className="hidden sm:inline ml-2 text-xs text-slate-500 font-mono tracking-tighter bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50">⌘K</span>
            {/* Mobile Pill Text */}
            <span className="inline sm:hidden text-sm font-medium pl-1 pr-2">{t('search.label')}</span>
        </button>
    );
}
