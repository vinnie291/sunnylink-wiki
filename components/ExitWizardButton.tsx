'use client';

import { X } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export default function ExitWizardButton() {
    const { t } = useLanguage();
    return (
        <button 
            onClick={() => window.location.href = '/cars'} 
            className="
                flex items-center justify-center gap-1.5 
                px-4 h-10 sm:h-12 
                rounded-xl 
                bg-slate-800/50 backdrop-blur-sm 
                border border-slate-700/50 
                hover:bg-slate-700/50 hover:border-slate-600/50 
                transition-all duration-200 
                text-sm font-medium text-slate-400 hover:text-slate-100
            "
        >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">{t('cw.exitWizard')}</span>
            <span className="sm:hidden">{t('cw.exit')}</span>
        </button>
    );
}
