'use client';
import { vehicleModelLabel } from '@/lib/vehicleDisplay';
import TranslatedText from '@/components/TranslatedText';


import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, LoaderCircle, X, Settings2, Car, Brain, BookOpen } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import ModelModalLoadingOverlay from './ModelModalLoadingOverlay';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { useTranslatedToggles, useTranslatedModels, useTranslatedFeatures, useTranslatedCars } from '../lib/useTranslatedData';
import { modelNameToSlug } from '../lib/modelSlug';
import SearchSuggestions from './SearchSuggestions';
import { useSemanticSearch } from '../hooks/useSemanticSearch';
import { mergeSemanticResults, searchIdentity } from '../lib/semanticSearch';
import { useMyCar } from '../lib/myCar';
import { isSettingApplicableToMake } from '../lib/vehicleSettings';

interface SearchItem {
    id: string;
    type: 'setting' | 'model' | 'car' | 'feature';
    title: string;
    subtitle: string;
    href: string;
    make?: string;
    model?: string;
}

export default function UniversalSearch({ onClose: closeSearch }: { onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loadingModel, setLoadingModel] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { t, tx, locale } = useLanguage();
    const selectedMake = useMyCar()?.vehicle.make;

    const initialPathnameRef = useRef(pathname);

    // Automatically dismiss the loading overlay and search dialog when navigation finishes
    useEffect(() => {
        if (!loadingModel) return;

        // If user arrived at /models from another route, dismiss search immediately
        if (pathname === '/models' && initialPathnameRef.current !== '/models') {
            closeSearch();
            return;
        }

        // Safety fallback timer so loading screen never stays on screen
        const timer = setTimeout(() => {
            closeSearch();
        }, 500);

        return () => clearTimeout(timer);
    }, [pathname, searchParams, loadingModel, closeSearch]);

    const togglesData = useTranslatedToggles();
    const modelsData = useTranslatedModels();
    const featuresData = useTranslatedFeatures();
    const carsData = useTranslatedCars();

    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(timer);
    }, []);

    // Normalize data
    const allItems = useMemo<SearchItem[]>(() => {
        const items: SearchItem[] = [];

        // Add Settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        togglesData.categories.forEach((cat: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cat.settings.forEach((setting: any) => {
                if (!isSettingApplicableToMake(setting.key, selectedMake)) return;
                items.push({
                    id: setting.key,
                    type: 'setting',
                    title: setting.label,
                    subtitle: setting.description || cat.name,
                    href: `/#${setting.key}`,
                });
            });
        });

        // Add Models
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modelsData.categories.forEach((cat: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cat.models.forEach((model: any) => {
                const modelId = model.id || model.name;
                const slug = modelNameToSlug(model.name);
                items.push({
                    id: modelId,
                    type: 'model',
                    title: model.name,
                    subtitle: model.consensus || cat.name,
                    href: `/models?model=${slug}`,
                });
            });
        });

        // Add Features
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        featuresData.features.forEach((feature: any) => {
            items.push({
                id: feature.id,
                type: 'feature',
                title: feature.name,
                subtitle: feature.userSummary || feature.fullName,
                href: `/features#${feature.id}`,
            });
        });

        // Add Cars
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (carsData as any).vehicles?.forEach((car: any) => {
            items.push({
                id: car.id,
                type: 'car',
                title: `${car.make} ${vehicleModelLabel(car.model, tx)}`,
                subtitle: car.years || tx('All Years'),
                href: `/cars?vehicle=${car.id}&search=${encodeURIComponent(car.model)}`,
                make: car.make,
                model: car.model,
            });
        });

        return items;
    }, [togglesData, modelsData, featuresData, carsData, selectedMake, tx]);

    const searchKeys = useMemo(() => ['title', 'subtitle', 'make', 'model'], []);

    // Fuzzy search
    const results = useFuzzySearch<Record<string, unknown>>({
        items: allItems as unknown as Record<string, unknown>[],
        keys: searchKeys,
        query: query,
        threshold: 0.35,
        acronymKey: 'title',
    }) as unknown as SearchItem[];

    const { ids: semanticIds, isLoading } = useSemanticSearch(query, results.slice(0, 12).map(searchIdentity), true, locale);
    const rankedResults = query.trim().length > 0
        ? mergeSemanticResults(allItems, results, semanticIds, query)
        : [];
    const displayResults = rankedResults.slice(0, 8);
    const selectedResult = activeId ? rankedResults.find(item => searchIdentity(item) === activeId) : undefined;
    if (selectedResult && !displayResults.includes(selectedResult)) {
        displayResults[displayResults.length - 1] = selectedResult;
    }

    // Track the chosen entry, so asynchronous ranking cannot change an active selection.
    const activeIndex = Math.max(0, displayResults.findIndex(item => searchIdentity(item) === activeId));

    // Prefetch routes for top search results so clicking opens them instantly
    useEffect(() => {
        displayResults.slice(0, 4).forEach(item => {
            const [path] = item.href.split('#');
            if (path) router.prefetch(path);
        });
    }, [displayResults, router]);

    const handleSelect = (item: SearchItem) => {
        if (item.type === 'model' || item.href.includes('/models?model=')) {
            // If already on /models, close search dialog immediately and update URL without artificial delay
            if (pathname === '/models') {
                closeSearch();
                router.push(item.href);
                return;
            }
            // Navigating from another route: display blurred loading overlay during route transition
            setLoadingModel(item.title);
            router.push(item.href);
            return;
        }
        closeSearch();
        router.push(item.href);
        // Force a hashchange event in case next/navigation doesn't trigger it for anchor links
        if (item.href.includes('#')) {
            setTimeout(() => {
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            }, 100);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (displayResults.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveId(searchIdentity(displayResults[(activeIndex + 1) % displayResults.length]));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveId(searchIdentity(displayResults[(activeIndex - 1 + displayResults.length) % displayResults.length]));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(displayResults[Math.min(activeIndex, displayResults.length - 1)]);
        }
    };


    const getIcon = (type: string) => {
        switch (type) {
            case 'setting': return <Settings2 className="w-5 h-5 text-cyan-400" />;
            case 'model': return <Brain className="w-5 h-5 text-purple-400" />;
            case 'car': return <Car className="w-5 h-5 text-emerald-400" />;
            case 'feature': return <BookOpen className="w-5 h-5 text-blue-400" />;
            default: return <Search className="w-5 h-5 text-slate-400" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'setting': return t('nav.settings') || 'Setting';
            case 'model': return t('nav.models') || 'Model';
            case 'car': return t('nav.carDatabase') || 'Car';
            case 'feature': return t('nav.features') || 'Feature';
            default: return type;
        }
    };

    // Highlight helper for title matches
    const HighlightMatch = ({ text }: { text: string }) => {
        const trimmed = query.trim();
        if (!trimmed) return <><TranslatedText text={text} /></>;

        // Escape regex special characters to prevent injection
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tokens = trimmed
            .split(/\s+/)
            .filter(Boolean)
            .map(tok => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        // Handle alphanumeric queries with optional hyphens (e.g. f150 -> f-?150, cx5 -> cx-?5)
        const flexTokens = tokens.map(tok => {
            if (/^[a-zA-Z0-9]+$/.test(tok) && tok.length > 2) {
                return tok.replace(/([a-zA-Z])(?=[0-9])|([0-9])(?=[a-zA-Z])/g, '$&-?');
            }
            return tok;
        });

        const allPatterns = Array.from(new Set([escaped, ...tokens, ...flexTokens]));
        let pattern: RegExp;
        try {
            pattern = new RegExp(`(${allPatterns.join('|')})`, 'gi');
        } catch {
            return <><TranslatedText text={text} /></>;
        }

        const parts = text.split(pattern);
        return (
            <span>
                {parts.map((part, i) => {
                    const partClean = part.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const isMatch = allPatterns.some(pat => {
                        const patClean = pat.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return (patClean.length > 0 && partClean === patClean) || part.toLowerCase() === pat.toLowerCase();
                    });
                    return isMatch
                        ? <span key={i} className="bg-cyan-500/30 text-cyan-200 rounded px-0.5"><TranslatedText text={part} /></span>
                        : part;
                })}
            </span>
        );
    };

    if (loadingModel) {
        return (
            <ModelModalLoadingOverlay
                modelName={loadingModel}
                onClose={() => {
                    setLoadingModel(null);
                    closeSearch();
                }}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[20vh] px-4">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity" 
                onClick={closeSearch}
            />

            {/* Modal */}
            <div role="dialog" aria-modal="true" aria-label={t('search.label')} className="relative w-full max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex items-center px-4 py-4 border-b border-slate-800/50">
                    <Search className="w-5 h-5 text-slate-400 mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={t('search.universalPlaceholder')}
                        aria-label={t('search.label')}
                        className="min-w-0 flex-1 bg-transparent text-base sm:text-lg text-slate-100 placeholder-slate-500 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0"
                        style={{ outline: 'none', boxShadow: 'none' }}
                        value={query}
                        maxLength={200}
                        onChange={(e) => { setQuery(e.target.value); setActiveId(null); }}
                        onKeyDown={handleKeyDown}
                    />
                    <button 
                        onClick={closeSearch}
                        aria-label={t('search.closeSearch')}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {query.length > 0 && (
                    <div className="max-h-[60vh] overflow-y-auto p-2" aria-busy={isLoading}>
                        {isLoading && (
                            <div role="status" className={`flex items-center justify-center gap-3 text-sm text-slate-400 ${displayResults.length ? 'py-3' : 'py-8'}`}>
                                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none text-cyan-400" />
                                <span>{t('search.loading')}</span>
                            </div>
                        )}
                        {displayResults.length === 0 ? (!isLoading && (
                            <div className="text-center py-8 text-slate-400">
                                {t('search.noResults', { query })}
                            </div>
                        )) : (
                            <div className="space-y-1">
                                {displayResults.map((item, index) => (
                                    <button
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => handleSelect(item)}
                                        onMouseEnter={() => {
                                            setActiveId(searchIdentity(item));
                                            const [path] = item.href.split('#');
                                            if (path) router.prefetch(path);
                                        }}
                                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors text-left group ${
                                            index === activeIndex 
                                                ? 'bg-slate-800/80 border-slate-600 ring-1 ring-slate-700/50 shadow-lg' 
                                                : 'hover:bg-slate-800/40'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg transition-colors ${
                                            index === activeIndex ? 'bg-slate-700 border-slate-600' : 'bg-slate-800 border-slate-700/50 group-hover:bg-slate-700/50'
                                        } border`}>
                                            {getIcon(item.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${index === activeIndex ? 'text-slate-100' : 'text-slate-200'}`}>
                                                <HighlightMatch text={item.title} />
                                            </div>
                                            <div className={`text-sm truncate mt-0.5 ${index === activeIndex ? 'text-slate-300' : 'text-slate-500'}`}>
                                                <TranslatedText text={item.subtitle} />
                                            </div>
                                        </div>
                                        <div className="hidden sm:block">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${
                                                index === activeIndex 
                                                    ? 'text-cyan-300 bg-cyan-500/20 border-cyan-500/30' 
                                                    : 'text-slate-500 bg-slate-800 border-slate-700'
                                            }`}>
                                                <TranslatedText text={getTypeLabel(item.type)} />
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {query.length === 0 && (
                    <SearchSuggestions onSelect={example => {
                        setQuery(example);
                        setActiveId(null);
                        inputRef.current?.focus();
                    }} />
                )}
            </div>
        </div>
    );
}
