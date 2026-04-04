'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useLanguage } from '../lib/i18n';
import { useTranslatedCars } from '../lib/useTranslatedData';
import { useViewMode } from '../hooks/useViewMode';
import { useStickySearch } from '../hooks/useStickySearch';
import SearchFilter from './SearchFilter';
import CategoryFilter from './CategoryFilter';
import CarDetailView from './CarDetailView';
import ViewToggle from './ViewToggle';
import MobileCategorySidebar from './MobileCategorySidebar';
import ScrollToTop from './ScrollToTop';

const CategorySidebarButton = dynamic(() => import('./CategorySidebarButton'), { ssr: false });

interface Vehicle {
    id: string;
    make: string;
    model: string;
    years: string;
    hardware: {
        device: string;
        harness: string;
        radar: string;
    };
    bestSettings: {
        drivingModel: string;
        torqueTuning: string;
        lateralControl: string;
        longitudinalControl: string;
        mads: string;
        experimentalMode: string;
    };
    communityConsensus: string;
    forumUrl: string;
    configs?: CarConfig[];
    reviews: {
        user: string;
        rating: number;
        comment: string;
    }[];
    isRecommended?: boolean;
}

interface CarConfig {
    name: string;
    settings: {
        drivingModel: string;
        torqueTuning: string;
        lateralControl: string;
        longitudinalControl: string;
        mads: string;
        experimentalMode: string;
    };
}

interface GroupedVehicle extends Vehicle {
    variants: Vehicle[];
    displayYears: string;
}

const CAR_MAKES = [
    'Acura', 'Audi', 'BMW', 'BYD', 'Chevrolet', 'Chrysler', 'Citroen', 'Ford', 
    'Genesis', 'Honda', 'Hyundai', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 
    'Lexus', 'Lincoln', 'Mazda', 'Nissan', 'Opel', 'Peugeot', 'Ram', 
    'Rivian', 'Škoda', 'Subaru', 'Tata', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
];

export default function CarDatabase() {
    const { t } = useLanguage();
    const carsData = useTranslatedCars();
    const vehicles = carsData.vehicles as Vehicle[];

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMake, setSelectedMake] = useState<string>('');
    const [showRecommended, setShowRecommended] = useState<boolean>(false);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const { viewMode, setViewMode } = useViewMode('cars_page', 'grid');
    const [sortBy, setSortBy] = useState<string>('rating-desc');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    const { sentinelRef, isSticky } = useStickySearch();

    // Map car makes to category format for CategoryFilter
    const categoryMeta = useMemo(() => {
        const counts = vehicles.reduce((acc, v) => {
            acc[v.make] = (acc[v.make] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return CAR_MAKES
            .filter(make => counts[make] > 0)
            .map(make => ({
                id: make.toLowerCase(),
                name: make,
                icon: '🏢',
                count: counts[make]
            }));
    }, [vehicles]);

    const recommendedCount = useMemo(() => {
        return vehicles.filter(v => v.isRecommended).length;
    }, [vehicles]);

    const activeCategories = useMemo(() => {
        const active = [];
        if (selectedMake) active.push(selectedMake.toLowerCase());
        if (showRecommended) active.push('recommended');
        return active;
    }, [selectedMake, showRecommended]);

    const handleToggleCategory = (id: string) => {
        if (id === 'recommended') {
            setShowRecommended(prev => !prev);
            setSearchQuery('');
            return;
        }
        const make = categoryMeta.find(m => m.id === id)?.name || '';
        setSelectedMake(prev => prev === make ? '' : make);
        setSearchQuery('');
    };

    const groupedVehicles = useMemo(() => {
        const groups: Record<string, GroupedVehicle> = {};

        vehicles.forEach(vehicle => {
            // Normalize model name for grouping (remove parenthetical info like Early Access)
            const normalizedModel = vehicle.model.replace(/\s*\(.*?\)/g, '').trim();
            const key = `${vehicle.make}-${normalizedModel}`;

            if (!groups[key]) {
                groups[key] = {
                    ...vehicle,
                    model: normalizedModel, // Use normalized model name for the parent
                    variants: [vehicle],
                    displayYears: vehicle.years
                };
            } else {
                groups[key].variants.push(vehicle);
                
                // Update combined year range
                if (!groups[key].displayYears.includes(vehicle.years)) {
                    groups[key].displayYears = `${groups[key].displayYears}, ${vehicle.years}`;
                }
                
                // Prefer recommended tag if any variant has it
                if (vehicle.isRecommended) {
                    groups[key].isRecommended = true;
                }
            }
        });

        return Object.values(groups);
    }, [vehicles]);

    const filteredVehicles = useMemo(() => {
        let results = [...groupedVehicles];

        if (selectedMake) {
            results = results.filter(v => 
                v.make.toLowerCase() === selectedMake.toLowerCase()
            );
        }

        if (showRecommended) {
            results = results.filter(v => v.isRecommended);
        }

        if (searchQuery) {
            const fuse = new Fuse(results, {
                keys: ['make', 'model', 'displayYears'],
                threshold: 0.3,
            });
            results = fuse.search(searchQuery).map(result => result.item);
        }

        // Sorting
        results.sort((a, b) => {
            const ratingA = a.reviews.length > 0 
                ? a.reviews.reduce((acc, r) => acc + r.rating, 0) / a.reviews.length 
                : 0;
            const ratingB = b.reviews.length > 0 
                ? b.reviews.reduce((acc, r) => acc + r.rating, 0) / b.reviews.length 
                : 0;

            switch (sortBy) {
                case 'recommended-first':
                    if (a.isRecommended && !b.isRecommended) return -1;
                    if (!a.isRecommended && b.isRecommended) return 1;
                    return ratingB - ratingA;
                case 'brand-asc':
                    return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
                case 'brand-desc':
                    return `${b.make} ${b.model}`.localeCompare(`${a.make} ${a.model}`);
                case 'model-asc':
                    return a.model.localeCompare(b.model);
                case 'model-desc':
                    return b.model.localeCompare(a.model);
                case 'rating-desc':
                    return ratingB - ratingA;
                case 'rating-asc':
                    return ratingA - ratingB;
                default:
                    return 0;
            }
        });

        return results;
    }, [groupedVehicles, searchQuery, selectedMake, sortBy, showRecommended]);

    const [isSearchActive, setIsSearchActive] = useState(false);

    // Watch for data-search-active attribute to force sticky behavior when typing
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsSearchActive(document.documentElement.hasAttribute('data-search-active'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-search-active'] });
        return () => observer.disconnect();
    }, []);

    const effectiveIsSticky = isSticky || isSearchActive;

    return (
        <div className="lg:flex lg:gap-8">
            {/* Mobile Category Sidebar */}
            <MobileCategorySidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                categories={categoryMeta}
                mode="models" // Using models mode for single-select brand behavior
                activeCategory={selectedMake.toLowerCase() || 'all'}
                onSelectCategory={(id) => {
                    const make = categoryMeta.find(m => m.id === id)?.name || '';
                    setSelectedMake(make);
                    setSearchQuery('');
                }}
            />
            
            <CategorySidebarButton
                onClick={() => setSidebarOpen(!sidebarOpen)}
                isSticky={effectiveIsSticky}
                isSidebarOpen={sidebarOpen}
            />

            {/* Sidebar - Desktop Only */}
            <aside className="hidden lg:block lg:w-72 lg:shrink-0">
                <div className="sticky top-8 space-y-6 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2 pb-8">
                    {/* Search */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <SearchFilter
                            value={searchQuery}
                            onChange={setSearchQuery}
                            resultCount={filteredVehicles.length}
                            totalCount={vehicles.length}
                            itemLabel="vehicles"
                        />
                    </div>

                    {/* Desktop Setup Wizard */}
                    <Link href="/wizard" className="block">
                        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 p-4 transition-all group relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 text-6xl opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 pointer-events-none">
                                🧙
                            </div>
                            <div className="relative">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                                    <span>✨</span> {t('wizard.recommended') || 'Recommended'}
                                </div>
                                <h3 className="text-white font-bold text-sm mb-1 group-hover:text-cyan-300 transition-colors">
                                    {t('wizard.title') || 'Setup Wizard'}
                                </h3>
                                <p className="text-slate-400 text-xs leading-relaxed max-w-[85%] group-hover:text-slate-300 transition-colors">
                                    {t('cars.description') || 'Find the optimized settings and hardware requirements.'}
                                </p>
                            </div>
                        </div>
                    </Link>

                    {/* Brands */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <CategoryFilter
                            categories={categoryMeta}
                            activeCategories={activeCategories}
                            onToggleCategory={handleToggleCategory}
                            onClearAll={() => { setSelectedMake(''); setShowRecommended(false); }}
                            vertical={true}
                            recommendedCount={recommendedCount}
                        />
                    </div>

                    {/* Quick Tip */}
                    <div className="bg-gradient-to-br from-cyan-500/10 to-violet-500/10 rounded-2xl border border-cyan-500/20 p-4">
                        <p className="text-sm font-medium text-white mb-2">💡 {t('cars.tip.title') || 'Quick Tip'}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {t('cars.tip.desc') || 'Select your brand to see all tested models and community settings at a glance.'}
                        </p>
                    </div>

                    {/* Buy Me a Coffee */}
                    <a
                        href="https://buymeacoffee.com/vinhle.co"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl border border-[#FFDD00]/50 text-[#FFDD00] font-bold text-sm transition-all duration-300 hover:bg-[#FFDD00]/10 hover:border-[#FFDD00] hover:shadow-[0_0_16px_rgba(255,221,0,0.4)] hover:animate-pulse"
                    >
                        <span className="text-lg">☕</span>
                        {t('footer.buyMeCoffee') || 'Buy Me a Coffee'}
                    </a>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
                {/* Sentinel for sticky detection */}
                <div ref={sentinelRef} className="lg:hidden h-0" />

                {/* Mobile Filters - Sticky */}
                <div className={`lg:hidden -mx-4 px-4 pt-2 pb-4 space-y-4 mb-6 transition-all duration-300 relative ${effectiveIsSticky ? 'sticky top-0 z-20' : ''}`}>
                    <SearchFilter
                        value={searchQuery}
                        onChange={setSearchQuery}
                        resultCount={filteredVehicles.length}
                        totalCount={vehicles.length}
                        itemLabel="vehicles"
                    />
                    <div className={`transition-all duration-300 overflow-hidden ${effectiveIsSticky ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[500px] opacity-100'}`}>
                        <CategoryFilter
                            categories={categoryMeta}
                            activeCategories={activeCategories}
                            onToggleCategory={handleToggleCategory}
                            onClearAll={() => { setSelectedMake(''); setShowRecommended(false); }}
                            collapsible={true}
                            vertical={true}
                            recommendedCount={recommendedCount}
                        />
                    </div>
                </div>

                {/* Header Section */}
                <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                            {searchQuery ? (
                                <><span>🔍</span> {t('settings.searchResults') || 'Search Results'}</>
                            ) : selectedMake ? (
                                <><span>🏢</span> {selectedMake}</>
                            ) : (
                                <><span>🚗</span> {t('cars.title') || 'Car Database'}</>
                            )}
                        </h2>
                        <p className="text-sm text-slate-400">
                            {searchQuery
                                ? t('cars.searchFound', { count: filteredVehicles.length, query: searchQuery })
                                : selectedMake
                                    ? `Browse all community-verified ${selectedMake} configurations.`
                                    : t('cars.description') || 'Explore verified hardware and tuning settings for your vehicle.'
                            }
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="hidden md:block">
                            <ViewToggle viewMode={viewMode} onChange={setViewMode} id="cars-view" />
                        </div>

                        <div className="relative group flex items-center bg-slate-800/50 border border-slate-700/50 rounded-xl focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all hover:bg-slate-800 cursor-pointer">
                            <label htmlFor="cars-sort" className="pl-3 flex items-center pointer-events-none whitespace-nowrap">
                                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">{t('settings.sort') || 'Sort'}</span>
                            </label>
                            <select
                                id="cars-sort"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="appearance-none outline-none bg-transparent w-full pl-2 pr-10 py-2.5 text-sm font-medium text-white cursor-pointer"
                            >
                                <option value="recommended-first" className="bg-slate-800">{t('cars.sort.recommended') || 'Recommended First'}</option>
                                <option value="rating-desc" className="bg-slate-800">{t('cars.sort.ratingHighLow') || 'Rating (High-Low)'}</option>
                                <option value="rating-asc" className="bg-slate-800">{t('cars.sort.ratingLowHigh') || 'Rating (Low-High)'}</option>
                                <option value="brand-asc" className="bg-slate-800">{t('cars.sort.brandAZ') || 'Brand (A-Z)'}</option>
                                <option value="brand-desc" className="bg-slate-800">{t('cars.sort.brandZA') || 'Brand (Z-A)'}</option>
                                <option value="model-asc" className="bg-slate-800">{t('cars.sort.modelAZ') || 'Model (A-Z)'}</option>
                                <option value="model-desc" className="bg-slate-800">{t('cars.sort.modelZA') || 'Model (Z-A)'}</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vehicle Grid/List */}
                <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2" : "flex flex-col gap-4"}>
                    {/* Mobile Setup Wizard Tile */}
                    <div className="lg:hidden">
                        <Link href="/wizard" className="block h-full">
                            <motion.div
                                layout
                                className={`h-full bg-gradient-to-br from-cyan-900/40 to-blue-900/40 backdrop-blur-sm border border-cyan-500/30 rounded-2xl cursor-pointer hover:border-cyan-400/50 transition-all group relative overflow-hidden ${
                                    viewMode === 'grid' ? 'p-6 flex flex-col' : 'p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6'
                                }`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                
                                <div className={`relative ${viewMode === 'list' ? 'flex-1 min-w-0' : 'flex-1'}`}>
                                    <div className={viewMode === 'list' ? 'flex flex-col md:flex-row md:items-center gap-4' : ''}>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest">{t('wizard.title') || 'Setup Wizard'}</div>
                                                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
                                                    <span>✨</span> {t('wizard.recommended') || 'Recommended'}
                                                </div>
                                            </div>
                                            <h3 className={`font-bold text-white ${viewMode === 'grid' ? 'text-xl mb-2' : 'text-lg md:text-xl'}`}>
                                                Find Your Vehicle
                                            </h3>
                                            <div className="text-sm text-cyan-100/60 leading-relaxed">
                                                {t('cars.description') || 'Get optimized settings and hardware requirements tailored for your specific car.'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`relative flex items-center justify-between sm:justify-end ${
                                    viewMode === 'grid' ? 'pt-4 border-t border-cyan-500/20 mt-4' : 'shrink-0'
                                }`}>
                                    <span className="text-3xl lg:hidden">🧙</span>
                                    <span className="text-xs font-bold text-cyan-300 bg-cyan-500/10 px-4 py-2 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                                        {t('wizard.start') || 'Start'} →
                                    </span>
                                </div>
                            </motion.div>
                        </Link>
                    </div>

                    {filteredVehicles.length > 0 && (
                        <AnimatePresence mode="popLayout">
                            {filteredVehicles.map((vehicle) => (
                                <motion.div
                                    key={vehicle.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    whileHover={{ y: -4 }}
                                    onClick={() => setSelectedVehicle(vehicle)}
                                    className={`bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl cursor-pointer hover:border-cyan-500/50 transition-all group relative overflow-hidden ${
                                        viewMode === 'grid' ? 'p-6' : 'p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6'
                                    }`}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    <div className={`relative ${viewMode === 'list' ? 'flex-1 min-w-0' : ''}`}>
                                        <div className={viewMode === 'list' ? 'flex flex-col md:flex-row md:items-center gap-4 md:gap-8' : ''}>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="text-xs font-bold text-cyan-500 uppercase tracking-widest">{vehicle.make}</div>
                                                    {vehicle.isRecommended && (
                                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                                                            <span>★</span> {t('cars.recommended') || 'Recommended'}
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className={`font-bold text-white ${viewMode === 'grid' ? 'text-xl' : 'text-lg md:text-xl'}`}>{vehicle.model}</h3>
                                                <div className="text-sm text-slate-500">{vehicle.displayYears}</div>
                                            </div>

                                            {viewMode === 'list' && (
                                                <div className="flex-1 flex flex-wrap gap-x-8 gap-y-4">
                                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                                        <span className="text-slate-500 shrink-0">🧠</span>
                                                        <span className="truncate max-w-[150px]">{vehicle.bestSettings.drivingModel}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                                        <span className="text-slate-500 shrink-0">🛠️</span>
                                                        <span className="truncate max-w-[150px]">{vehicle.hardware.harness}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {viewMode === 'grid' && (
                                        <div className="space-y-3 mb-6 mt-4 relative">
                                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                                <span className="text-slate-500 shrink-0">🧠</span>
                                                <span className="truncate">{vehicle.bestSettings.drivingModel}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                                <span className="text-slate-500 shrink-0">🛠️</span>
                                                <span className="truncate">{vehicle.hardware.harness}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className={`relative flex items-center justify-between ${
                                        viewMode === 'grid' ? 'pt-4 border-t border-slate-800/50' : 'sm:border-l sm:border-slate-800/50 sm:pl-8 shrink-0'
                                    }`}>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-yellow-500">⭐</span>
                                            <span className="text-sm font-bold text-white">
                                                {vehicle.reviews.length > 0 
                                                    ? (vehicle.reviews.reduce((acc, r) => acc + r.rating, 0) / vehicle.reviews.length).toFixed(1)
                                                    : '--'}
                                            </span>
                                            <span className="text-xs text-slate-500">({vehicle.reviews.length})</span>
                                        </div>
                                        <span className="text-xs font-medium text-slate-400 group-hover:text-cyan-400 transition-colors">
                                            {t('cars.viewDetails') || 'View Details'}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {filteredVehicles.length === 0 && (
                    <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50 mt-6 md:mt-0">
                        <div className="text-5xl mb-4">🔍</div>
                        <h3 className="text-xl font-medium text-white mb-2">No vehicles found</h3>
                        <p className="text-slate-400 mb-6">Try adjusting your filters or search terms.</p>
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedMake('');
                                setShowRecommended(false);
                            }}
                            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                        >
                            Clear All
                        </button>
                    </div>
                )}


            </div>

            {/* Scroll To Top Button */}
            <ScrollToTop />

            {/* Detail View Modal */}
            {selectedVehicle && (
                <CarDetailView
                    vehicle={selectedVehicle as GroupedVehicle}
                    onClose={() => setSelectedVehicle(null)}
                />
            )}
        </div>
    );
}
