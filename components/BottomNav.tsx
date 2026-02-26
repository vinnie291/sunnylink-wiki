'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { href: '/', label: 'Settings', icon: '⚙️' },
    { href: '/models', label: 'Models', icon: '🧠' },
    { href: '/wizard', label: 'Wizard', icon: '🧙', isCenter: true },
    { href: '/stats', label: 'Stats', icon: '📊' },
    { href: '/features', label: 'Features', icon: '📖' },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
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
