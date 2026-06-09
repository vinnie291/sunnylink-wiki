'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../lib/i18n';
import { NAV_ITEMS } from '../lib/navItems';

export default function Navigation() {
    const pathname = usePathname();
    const { t } = useLanguage();

    const isActive = (path: string) => {
        if (path === '/' && pathname === '/') return true;
        if (path !== '/' && pathname === path) return true;
        if (path !== '/' && pathname?.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="hidden md:inline-flex flex-wrap justify-center gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 max-w-full">
            {NAV_ITEMS.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={`
                px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all
                ${isActive(item.href)
                        ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'
                    }
              `}
                >
                    <span className="hidden sm:inline">{item.icon} </span>{t(item.labelKey)}
                </Link>
            ))}
        </div>
    );
}
