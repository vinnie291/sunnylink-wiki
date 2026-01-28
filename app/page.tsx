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
          <div className="lg:flex lg:gap-8">
            {/* Sidebar - Desktop Only */}
            <aside className="hidden lg:block lg:w-72 lg:shrink-0">
              <div className="sticky top-8 space-y-6">
                {/* Search */}
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                  <SearchFilter
                    value={searchQuery}
                    onChange={setSearchQuery}
                    resultCount={filteredSettings.length}
                    totalCount={allSettings.length}
                  />
                </div>

                {/* Categories */}
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                  <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Categories</h2>
                  <div className="space-y-2">
                    {/* All Button */}
                    <button
                      onClick={() => setActiveCategories([])}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left
                        transition-all duration-200 border
                        ${activeCategories.length === 0
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : 'bg-slate-700/30 text-slate-400 border-transparent hover:bg-slate-700/50 hover:text-white'
                        }
                      `}
                    >
                      <span className="text-lg">🏠</span>
                      <span className="flex-1">All Toggles</span>
                      <span className={`px-2 py-0.5 rounded-md text-xs ${activeCategories.length === 0 ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                        {allSettings.length}
                      </span>
                    </button>

                    {/* Category Buttons */}
                    {categoryMeta.map((category) => {
                      const isActive = activeCategories.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          onClick={() => handleToggleCategory(category.id)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left
                            transition-all duration-200 border
                            ${isActive
                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              : 'bg-slate-700/30 text-slate-400 border-transparent hover:bg-slate-700/50 hover:text-white'
                            }
                          `}
                        >
                          <span className="text-lg">{category.icon}</span>
                          <span className="flex-1 truncate">{category.name}</span>
                          <span className={`px-2 py-0.5 rounded-md text-xs ${isActive ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                            {category.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Help Card */}
                <div className="bg-gradient-to-br from-cyan-500/10 to-violet-500/10 rounded-2xl border border-cyan-500/20 p-4">
                  <h3 className="text-sm font-medium text-white mb-2">💡 Quick Tip</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Click the flag icon on any setting to report issues or suggest improvements.
                  </p>
                </div>

                {/* GitHub Contribute Box */}
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 p-4">
                  <h3 className="text-sm font-medium text-white mb-2">👋 Contribute</h3>
                  <a
                    href="https://github.com/vinnie291/sunnylink-wiki"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    Contribute on GitHub
                  </a>
                </div>
              </div>
            </aside>

            {/* Mobile Filters */}
            <div className="lg:hidden space-y-4 mb-6">
              <SearchFilter
                value={searchQuery}
                onChange={setSearchQuery}
                resultCount={filteredSettings.length}
                totalCount={allSettings.length}
              />
              <CategoryFilter
                categories={categoryMeta}
                activeCategories={activeCategories}
                onToggleCategory={handleToggleCategory}
                onClearAll={() => setActiveCategories([])}
              />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              {filteredSettings.length > 0 ? (
                <div className="grid gap-4">
                  {filteredSettings.map((setting) => (
                    <ToggleCard
                      key={setting.key}
                      setting={setting}
                      categoryName={setting.categoryName}
                      categoryIcon={setting.categoryIcon}
                      isHighlighted={setting.key === highlightedKey}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  searchQuery={searchQuery}
                  onClearSearch={handleClearAll}
                />
              )}
            </div>
          </div>
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
