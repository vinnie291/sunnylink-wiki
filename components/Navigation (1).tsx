'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/' && pathname === '/') return true;
        if (path !== '/' && pathname?.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="hidden md:inline-flex flex-wrap justify-center gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 max-w-full">
            <Link
                href="/"
                className={`
                px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all
                ${isActive('/')
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }
              `}
            >
                <span className="hidden sm:inline">⚙️ </span>Settings
            </Link>
            <Link
                href="/models"
                className={`
                px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all
                ${isActive('/models')
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }
              `}
            >
                <span className="hidden sm:inline">🧠 </span>Models<span className="text-[10px] sm:text-xs opacity-70 ml-0.5"> (66)</span>
            </Link>
            <Link
                href="/features"
                className={`
                px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all
                ${isActive('/features')
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }
              `}
            >
                <span className="hidden sm:inline">📖 </span>Features
            </Link>
            <Link
                href="/stats"
                className={`
                px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all
                ${isActive('/stats')
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }
              `}
            >
                <span className="hidden sm:inline">📊 </span>Stats
            </Link>
            <Link
                href="/wizard"
                className={`
                group relative px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all overflow-hidden
                ${isActive('/wizard')
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800'
                    }
              `}
            >
                {/* Sparkle effects on hover */}
                <span className={`absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer ${isActive('/wizard') ? 'hidden' : ''}`} />

                <span className="relative flex items-center gap-1 sm:gap-2">
                    <span>🧙</span>
                    <span className="hidden xs:inline">Setup </span><span>Wizard</span>
                </span>
            </Link>
        </div>
    );
}
