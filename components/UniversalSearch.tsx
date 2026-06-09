'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Settings2, Car, Brain, BookOpen } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { useTranslatedToggles, useTranslatedModels, useTranslatedFeatures, useTranslatedCars } from '../lib/useTranslatedData';

interface SearchItem {
    id: string;
    type: 'setting' | 'model' | 'car' | 'feature';
    title: string;
    subtitle: string;
    href: string;
}

export default function UniversalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { t } = useLanguage();

    const togglesData = useTranslatedToggles();
    const modelsData = useTranslatedModels();
    const featuresData = useTranslatedFeatures();
    const carsData = useTranslatedCars();

    // Listen for custom event and Cmd+K to open
    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        const handleClose = () => setIsOpen(false);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('open-universal-search', handleOpen);
        window.addEventListener('close-universal-search', handleClose);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('open-universal-search', handleOpen);
            window.removeEventListener('close-universal-search', handleClose);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setActiveIndex(0);
        } else {
            setQuery(''); // Reset on close
        }
    }, [isOpen]);

    // Normalize data
    const allItems = useMemo<SearchItem[]>(() => {
        const items: SearchItem[] = [];

        // Add Settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        togglesData.categories.forEach((cat: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cat.settings.forEach((setting: any) => {
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
                items.push({
                    id: model.id,
                    type: 'model',
                    title: model.name,
                    subtitle: model.consensus || cat.name,
                    href: `/models#${model.name}`,
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
                title: `${car.make} ${car.model}`,
                subtitle: car.years || 'All Years',
                href: `/cars?vehicle=${car.id}&search=${encodeURIComponent(car.model)}`,
            });
        });

        return items;
    }, [togglesData, modelsData, featuresData, carsData]);

    // Fuzzy search
    const results = useFuzzySearch<Record<string, unknown>>({
        items: allItems as unknown as Record<string, unknown>[],
        keys: ['title', 'subtitle'],
        query: query,
        threshold: 0.3,
    }) as unknown as SearchItem[];

    const displayResults = query.length > 0 ? results.slice(0, 8) : [];

    // Reset active index when results change
    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    const handleSelect = (item: SearchItem) => {
        setIsOpen(false);
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
            setActiveIndex((prev) => (prev + 1) % displayResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev - 1 + displayResults.length) % displayResults.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(displayResults[activeIndex]);
        }
    };

    if (!isOpen) return null;

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
        if (!query) return <>{text}</>;
        
        // Escape regex special characters to prevent injection
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) => 
                    part.toLowerCase() === query.toLowerCase() 
                        ? <span key={i} className="bg-cyan-500/30 text-cyan-200 rounded px-0.5">{part}</span>
                        : part
                )}
            </span>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[20vh] px-4">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity" 
                onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex items-center px-4 py-4 border-b border-slate-800/50">
                    <Search className="w-5 h-5 text-slate-400 mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={t('search.universalPlaceholder')}
                        className="flex-1 bg-transparent text-lg text-slate-100 placeholder-slate-500 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0"
                        style={{ outline: 'none', boxShadow: 'none' }}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {query.length > 0 && (
                    <div className="max-h-[60vh] overflow-y-auto p-2">
                        {displayResults.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                {t('search.noResults', { query })}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {displayResults.map((item, index) => (
                                    <button
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => handleSelect(item)}
                                        onMouseEnter={() => setActiveIndex(index)}
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
                                                {item.subtitle}
                                            </div>
                                        </div>
                                        <div className="hidden sm:block">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${
                                                index === activeIndex 
                                                    ? 'text-cyan-300 bg-cyan-500/20 border-cyan-500/30' 
                                                    : 'text-slate-500 bg-slate-800 border-slate-700'
                                            }`}>
                                                {getTypeLabel(item.type)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {query.length === 0 && (
                    <div className="px-4 py-8 text-center text-slate-500 text-sm">
                        {t('search.startTyping')}
                    </div>
                )}
            </div>
        </div>
    );
}
