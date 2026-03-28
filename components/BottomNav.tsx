'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../lib/i18n';
import { useScrollDirection } from '../hooks/useScrollDirection';

export default function BottomNav() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const [isSearchActive, setIsSearchActive] = useState(false);
    const scrollDirection = useScrollDirection();

    // Watch for data-search-active attribute on document element
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsSearchActive(document.documentElement.hasAttribute('data-search-active'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-search-active'] });
        return () => observer.disconnect();
    }, []);

    const navItems = [
        { href: '/', label: t('nav.settings'), icon: '⚙️' },
        { href: '/models', label: t('nav.models'), icon: '🧠' },
        { href: '/cars', label: t('nav.carDatabase'), icon: '🚗', isCenter: true },
        { href: '/stats', label: t('nav.stats'), icon: '📊' },
        { href: '/features', label: t('nav.features'), icon: '📖' },
    ];

    const isHidden = isSearchActive || scrollDirection === 'down';

    return (
        <nav className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${isHidden ? 'translate-y-full' : 'translate-y-0'}`}>
            {/* Glassmorphic background */}
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-700/50" />

            <div className="relative flex items-end justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;

                    if (item.isCenter) {
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                  flex flex-col items-center justify-center -mt-4
                  w-14 h-14 rounded-2xl
                  transition-all duration-300
                  ${isActive
                                        ? 'bg-gradient-to-br from-cyan-500 to-violet-500 shadow-lg shadow-cyan-500/30 scale-105'
                                        : 'bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700/80'
                                    }
                `}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className={`text-[9px] font-medium mt-0.5 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                flex flex-col items-center justify-center py-1.5 px-3
                rounded-xl transition-all duration-200
                ${isActive
                                    ? 'text-cyan-400'
                                    : 'text-slate-400 hover:text-slate-300'
                                }
              `}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className={`text-[10px] font-medium mt-0.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
