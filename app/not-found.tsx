import { FileQuestion, Home, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Custom 404 page for better user experience.
 * Provides helpful navigation options and maintains design consistency.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-slate-800/50 rounded-full flex items-center justify-center border border-slate-700">
            <FileQuestion className="w-12 h-12 text-slate-400" />
          </div>
          <h1 className="text-6xl font-bold text-slate-600 mb-2">404</h1>
        </div>

        {/* Message */}
        <h2 className="text-2xl font-semibold text-slate-200 mb-3">
          Page Not Found
        </h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          Try searching for what you need or head back to the home page.
        </p>

        {/* Navigation Options */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Homepage
          </Link>
          
          <Link
            href="/features"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            <Search className="w-4 h-4" />
            Browse Features
          </Link>
        </div>

        {/* Quick Links */}
        <div className="pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-3">Quick Links</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/cars" className="text-slate-400 hover:text-cyan-400 transition-colors">
              Cars
            </Link>
            <Link href="/models" className="text-slate-400 hover:text-cyan-400 transition-colors">
              Models
            </Link>
            <Link href="/stats" className="text-slate-400 hover:text-cyan-400 transition-colors">
              Stats
            </Link>
            <Link href="/wizard" className="text-slate-400 hover:text-cyan-400 transition-colors">
              Wizard
            </Link>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => typeof window !== 'undefined' && window.history.back()}
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    </main>
  );
}
