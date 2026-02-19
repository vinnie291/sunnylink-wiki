import Header from '@/components/Header';
import ScrollToTop from '@/components/ScrollToTop';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Live Stats | Sunnylink',
    description: 'Live fleet statistics for the Sunnypilot community. Track active users, models, and more.',
    openGraph: {
        title: 'Sunnylink Live Stats',
        description: 'Real-time fleet statistics for Sunnypilot.',
    }
};

const METABASE_DASHBOARD_URL = 'https://metabase.sunnypilot.ai/public/dashboard/8d0ca494-6ab3-4d4c-9642-7deb493c4fac';

export default function StatsPage() {
    return (
        <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Decorative background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
            </div>

            {/* Dashboard Button */}
            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-30">
                <a
                    href="https://www.sunnylink.ai/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
            flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3
            bg-indigo-600 hover:bg-indigo-500 text-white
            rounded-xl font-semibold text-sm sm:text-base
            shadow-lg shadow-indigo-600/30
            transition-all duration-200 hover:scale-105 active:scale-95
          "
                >
                    <span>sunnylink Dashboard</span>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </a>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 pt-20 pb-8 sm:py-12">
                <Header />

                {/* Page Title with Live Indicator */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <h2 className="text-2xl md:text-3xl font-bold text-white">
                            Live Fleet Status
                        </h2>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Live
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-2">
                        Real-time statistics from the Sunnypilot community
                    </p>
                    <a
                        href={METABASE_DASHBOARD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                    >
                        Open in full screen
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>

                {/* Metabase Dashboard Embed */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <iframe
                        src={`${METABASE_DASHBOARD_URL}#theme=night&titled=false&hide_parameters=date_range,make,model,by_branch,time_grouping,text`}
                        className="w-full border-0 h-[2400px] md:h-[1200px]"
                        title="Sunnypilot Live Stats Dashboard"
                        allowFullScreen
                    />
                </div>

                <footer className="mt-16 text-center text-slate-600 text-sm">
                    <p>
                        Built for the Sunnypilot community •{' '}
                        <a href="https://www.sunnypilot.ai/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">sunnypilot Terms of Service</a>
                        {' '}•{' '}
                        <a href="https://github.com/sunnypilot/sunnypilot" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">GitHub (sunnypilot)</a>
                        {' '}•{' '}
                        <a href="https://buymeacoffee.com/vinhle.co" target="_blank" rel="noopener noreferrer" className="text-[#FFDD00] hover:text-[#ffe84d] transition-colors">☕ Buy me a coffee</a>
                    </p>
                </footer>
            </div>
            <ScrollToTop />
        </main>
    );
}
