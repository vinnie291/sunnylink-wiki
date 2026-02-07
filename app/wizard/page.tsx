import SetupWizard from '@/components/SetupWizard';
import Header from '@/components/Header';
import ScrollToTop from '@/components/ScrollToTop';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Setup Wizard | Sunnylink',
    description: 'Interactive wizard to generate the perfect Sunnypilot configuration based on your car, driving style, and expertise.',
    openGraph: {
        title: 'Sunnylink Setup Wizard',
        description: 'Get a personalized Sunnypilot configuration in minutes.',
    }
};

export default function WizardPage() {
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

                <div className="max-w-4xl mx-auto">
                    <SetupWizard />
                </div>

                <footer className="mt-16 text-center text-slate-600 text-sm">
                    <p>
                        Built for the Sunnypilot community •{' '}
                        <a href="https://www.sunnypilot.ai/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">sunnypilot Terms of Service</a>
                        {' '}•{' '}
                        <a href="https://github.com/sunnypilot/sunnypilot" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">GitHub (sunnypilot)</a>
                        {' '}•{' '}
                        <a href="https://github.com/vinnie291/sunnylink-wiki" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">Contribute to Wiki</a>
                    </p>
                </footer>
            </div>
            <ScrollToTop />
        </main>
    );
}
