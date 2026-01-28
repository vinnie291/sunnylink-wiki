'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import togglesData from '../data/toggles.json';
import ToggleCard from '../components/ToggleCard';
import SearchFilter from '../components/SearchFilter';
import CategoryFilter from '../components/CategoryFilter';
import EmptyState from '../components/EmptyState';
import ModelLibrary from '../components/ModelLibrary';
import FeatureGuide from '../components/FeatureGuide';
import SetupWizard from '../components/SetupWizard';
import SettingsDatabase from '../components/SettingsDatabase';
import ScrollToTop from '../components/ScrollToTop';

interface ToggleSetting {
  key: string;
  label: string;
  type: string;
  options?: string[];
  default: boolean | string | number;
  description: string;
  recommended?: boolean | string;
  warning?: string;
  userNote?: string;
  safetyLevel?: 'safe' | 'critical';
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  settings: ToggleSetting[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'settings' | 'models' | 'features' | 'wizard'>('settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const categories = togglesData.categories as Category[];

  // Handle deep linking on mount and hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        try {
          const decodedHash = decodeURIComponent(hash);
          if (decodedHash === 'models') {
            setActiveTab('models');
          } else if (decodedHash === 'features') {
            setActiveTab('features');
          } else if (decodedHash === 'wizard') {
            setActiveTab('wizard');
          } else {
            setHighlightedKey(decodedHash);
            setSearchQuery('');
            setActiveCategories([]);
            setActiveTab('settings');
            setTimeout(() => setHighlightedKey(null), 3000);
          }
        } catch (e) {
          console.error('Failed to decode hash:', e);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Flatten all settings with their category info
  const allSettings = useMemo(() => {
    return categories.flatMap((category) =>
      category.settings.map((setting) => ({
        ...setting,
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
      }))
    );
  }, [categories]);

  // Category metadata for filter
  const categoryMeta = useMemo(() => {
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      description: cat.description,
      count: cat.settings.length,
    }));
  }, [categories]);

  // Filter settings based on search and category
  const filteredSettings = useMemo(() => {
    return allSettings.filter((setting) => {
      if (activeCategories.length > 0 && !activeCategories.includes(setting.categoryId)) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          setting.key,
          setting.label,
          setting.description,
          setting.userNote || '',
        ].join(' ').toLowerCase();

        return searchableText.includes(query);
      }

      return true;
    });
  }, [allSettings, searchQuery, activeCategories]);

  // Toggle category in filter
  const handleToggleCategory = useCallback((categoryId: string) => {
    setActiveCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  }, []);

  // Clear all filters
  const handleClearAll = useCallback(() => {
    setActiveCategories([]);
    setSearchQuery('');
  }, []);

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Dashboard Button - Viewport Absolute */}
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
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Sunnylink Wiki
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-6">
            Search and explore all Sunnypilot settings. Find the perfect configuration for your vehicle.
          </p>


          {/* Tab Switcher - Responsive */}
          <div className="inline-flex flex-wrap justify-center gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 max-w-full">
            <button
              onClick={() => setActiveTab('settings')}
              className={`
                px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all
                ${activeTab === 'settings'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <span className="hidden sm:inline">⚙️ </span>Settings<span className="text-[10px] sm:text-xs opacity-70 ml-0.5"> ({allSettings.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`
                px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all
                ${activeTab === 'models'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <span className="hidden sm:inline">🧠 </span>Models<span className="text-[10px] sm:text-xs opacity-70 ml-0.5"> (66)</span>
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`
                px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all
                ${activeTab === 'features'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              <span className="hidden sm:inline">📖 </span>Features
            </button>
            <button
              onClick={() => setActiveTab('wizard')}
              className={`
                group relative px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all overflow-hidden
                ${activeTab === 'wizard'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800'
                }
              `}
            >
              {/* Sparkle effects on hover */}
              <span className={`absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer ${activeTab === 'wizard' ? 'hidden' : ''}`} />

              <span className="relative flex items-center gap-1 sm:gap-2">
                <span>🧙</span>
                <span className="hidden xs:inline">Setup </span><span>Wizard</span>
              </span>
            </button>
          </div>
        </header>

        {/* Tab Content */}
        {activeTab === 'settings' ? (
          /* Settings Tab */
          <SettingsDatabase
            allSettings={allSettings}
            filteredSettings={filteredSettings}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeCategories={activeCategories}
            onToggleCategory={handleToggleCategory}
            onClearCategories={handleClearAll}
            categoryMeta={categoryMeta}
            highlightedKey={highlightedKey}
          />
        ) : activeTab === 'models' ? (
          /* Models Tab */
          <div className="">
            <ModelLibrary />
          </div>
        ) : activeTab === 'features' ? (
          /* Features Tab */
          <div className="max-w-4xl mx-auto">
            <FeatureGuide />
          </div>
        ) : (
          /* Wizard Tab */
          <div className="max-w-4xl mx-auto">
            <SetupWizard />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-slate-600 text-sm">
          <p>
            Built for the Sunnypilot community •{' '}
            <a
              href="https://www.sunnypilot.ai/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-500 hover:text-cyan-400 transition-colors"
            >
              sunnypilot Terms of Service
            </a>
            {' '}•{' '}
            <a
              href="https://github.com/sunnypilot/sunnypilot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-500 hover:text-cyan-400 transition-colors"
            >
              GitHub (sunnypilot)
            </a>
            {' '}•{' '}
            <a
              href="https://github.com/vinnie291/sunnylink-wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-500 hover:text-cyan-400 transition-colors"
            >
              Contribute to Wiki
            </a>
          </p>
        </footer>
      </div>
      <ScrollToTop />
    </main >
  );
}
