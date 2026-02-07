import Link from 'next/link';
import Navigation from './Navigation';

export default function Header() {
    return (
        <header className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                Sunnylink Wiki
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-4">
                Search and explore all Sunnypilot settings. Find the perfect configuration for your vehicle.
            </p>
            <div className="mb-10">
                <a
                    href="https://community.sunnypilot.ai/c/documentation/114/none"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>Official Documentation</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>
            <Navigation />
        </header>
    );
}
