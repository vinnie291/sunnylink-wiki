'use client';

import { X } from 'lucide-react';

export default function ExitWizardButton() {
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
                text-sm font-medium text-slate-400 hover:text-white
            "
        >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Exit Wizard</span>
            <span className="sm:hidden">Exit</span>
        </button>
    );
}
