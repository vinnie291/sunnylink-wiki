'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import togglesData from '../data/toggles.json';
import ToggleCard from '../components/ToggleCard';
import SearchFilter from '../components/SearchFilter';
import CategoryFilter from '../components/CategoryFilter';
import EmptyState from '../components/EmptyState';
import ModelLibrary from '../components/ModelLibrary';
import FeatureGuide from '../components/FeatureGuide';

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
  const [activeTab, setActiveTab] = useState<'settings' | 'models' | 'features'>('settings');
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
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Sunnylink Wiki
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-6">
            Search and explore all Sunnypilot settings. Find the perfect configuration for your vehicle.
          </p>

          {/* Tab Switcher */}
          <div className="inline-flex gap-2 p-1.5 rounded-2xl bg-slate-800/50 border border-slate-700/50">
            <button
              onClick={() => setActiveTab('settings')}
              className={`
                px-6 py-2.5 rounded-xl text-sm font-medium transition-all
                ${activeTab === 'settings'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              ⚙️ Settings ({allSettings.length})
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`
                px-6 py-2.5 rounded-xl text-sm font-medium transition-all
                ${activeTab === 'models'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              🧠 Models (66)
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`
                px-6 py-2.5 rounded-xl text-sm font-medium transition-all
                ${activeTab === 'features'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }
              `}
            >
              📖 Features
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
        ) : (
          /* Features Tab */
          <div className="max-w-4xl mx-auto">
            <FeatureGuide />
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
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
