'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/i18n';
import { getModelFleetStat, formatRouteCount, getBrandFleetStat, formatDeviceCount } from '../lib/fleetStats';
import { getVehicleForumUrl } from '../lib/carForum';
import { getCarCutoutImage } from '../lib/carImages';
import { modelNameToSlug } from '../lib/modelSlug';

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
    forumQuotes?: {
        text: string;
        user: string;
        context?: string;
    }[];
}

interface GroupedVehicle extends Vehicle {
    variants: Vehicle[];
}

interface CarDetailViewProps {
    vehicle: GroupedVehicle;
    onClose: () => void;
}

export default function CarDetailView({ vehicle, onClose }: CarDetailViewProps) {
    const { t } = useLanguage();
    const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
    const [selectedConfigIdx, setSelectedConfigIdx] = useState(0);

    const currentVehicle = vehicle.variants[selectedVariantIdx] || vehicle.variants[0] || vehicle;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Reset config selection when variant changes
    useEffect(() => {
        setSelectedConfigIdx(0);
    }, [selectedVariantIdx]);

    const configs = currentVehicle.configs?.length ? currentVehicle.configs : [
        { name: t('cars.bestSettings') || 'Recommended Configuration', settings: currentVehicle.bestSettings }
    ];
    const currentConfig = configs[selectedConfigIdx] || configs[0];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Modal Content */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-hidden bg-slate-900 border border-slate-700 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors z-10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Content Header */}
                <div className="p-6 pr-16 sm:p-8 sm:pr-20 border-b border-slate-800 shrink-0">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <div className="text-sm font-bold text-cyan-500 uppercase tracking-widest mb-1">{vehicle.make}</div>
                            <h2 className="text-4xl font-bold text-slate-100">{vehicle.model}</h2>
                            {vehicle.variants.length > 1 ? (
                                <div className="relative mt-2 inline-block">
                                    <select
                                        value={selectedVariantIdx}
                                        onChange={(e) => setSelectedVariantIdx(Number(e.target.value))}
                                        className="appearance-none bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 text-cyan-400 text-sm font-bold py-1.5 pl-3 pr-8 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all cursor-pointer"
                                    >
                                        {vehicle.variants.map((v, idx) => (
                                            <option key={idx} value={idx}>{v.years}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                        <svg className="w-4 h-4 text-cyan-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-slate-400 font-medium">{currentVehicle.years}</div>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex shrink-0 w-32 h-16 md:w-40 md:h-20 items-center justify-center pointer-events-none">
                                <img
                                    src={getCarCutoutImage(vehicle.make, vehicle.model)}
                                    alt={`${vehicle.make} ${vehicle.model}`}
                                    className="w-full h-full object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                                />
                            </div>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-sm font-bold uppercase tracking-wider">
                                {t('cars.status') || 'Tested'}
                            </span>
                            {(() => {
                                const forumUrl = getVehicleForumUrl(vehicle.make, vehicle.forumUrl);
                                return (
                                    <a
                                        href={forumUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors flex items-center gap-2"
                                    >
                                        <span>💬</span> {t('cars.forum') || 'Join Discussion'}
                                    </a>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Scrollable Body */}
                <div className="p-4 sm:p-8 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Highlights & Hardware */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Consensus Section */}
                            <section>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">{t('cars.consensus') || 'Community Consensus'}</h3>
                                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                                    <p className="text-lg text-slate-200 leading-relaxed italic">
                                        &quot;{currentVehicle.communityConsensus}&quot;
                                    </p>
                                </div>
                            </section>

                            {/* Community Chatter / Forum Quotes */}
                            {currentVehicle.forumQuotes && currentVehicle.forumQuotes.length > 0 && (
                                <section>
                                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">{t('cars.highlights') || 'Forum Highlights'}</h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {currentVehicle.forumQuotes.map((quote, idx) => (
                                            <div key={idx} className="relative p-6 rounded-2xl bg-slate-800/20 border border-slate-700/30 overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <span className="text-4xl text-cyan-400">💬</span>
                                                </div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20">
                                                        Sunnypilot Forum
                                                    </span>
                                                    <span className="text-slate-500 text-xs font-medium">@{quote.user}</span>
                                                </div>
                                                <p className="text-slate-200 text-lg leading-relaxed font-medium mb-2 relative z-10">
                                                    &ldquo;{quote.text}&rdquo;
                                                </p>
                                                {quote.context && (
                                                    <div className="text-xs text-slate-500 italic flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/30"></span>
                                                        {quote.context}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Recommended Settings Grid */}
                            <section>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">{t('cars.bestSettings') || 'Configuration'}</h3>
                                    
                                    {configs.length > 1 && (
                                        <div className="relative group shrink-0">
                                            <select
                                                value={selectedConfigIdx}
                                                onChange={(e) => setSelectedConfigIdx(Number(e.target.value))}
                                                className="appearance-none bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 text-slate-100 text-sm font-bold py-2 pl-4 pr-10 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all cursor-pointer w-full"
                                            >
                                                {configs.map((config, idx) => (
                                                    <option key={idx} value={idx}>{config.name}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Driving Model - Enhanced with Telemetry */}
                                    {(() => {
                                        const modelName = currentConfig.settings.drivingModel;
                                        const stat = getModelFleetStat(modelName);
                                        const slug = modelNameToSlug(modelName);
                                        const modelUrl = `/models?model=${slug}#${slug}`;

                                        return (
                                            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/80 to-cyan-950/30 border border-cyan-500/40 flex flex-col justify-between gap-3 shadow-md group/card hover:border-cyan-500/60 transition-all duration-200">
                                                <div className="flex items-start justify-between">
                                                    <Link
                                                        href={modelUrl}
                                                        className="block group/link"
                                                        title={`View ${modelName} specs on models page`}
                                                    >
                                                        <div className="text-xs text-cyan-400 font-semibold mb-0.5">{t('cars.setting.model') || 'Driving Model'}</div>
                                                        <div className="font-bold text-slate-100 text-lg leading-tight group-hover/link:text-cyan-300 transition-colors flex items-center gap-1.5">
                                                            <span>{modelName}</span>
                                                            <span className="text-xs text-cyan-400/80 group-hover/link:text-cyan-300 transition-colors">↗</span>
                                                        </div>
                                                    </Link>
                                                    <Link
                                                        href={modelUrl}
                                                        className="text-2xl hover:scale-110 transition-transform"
                                                        title={`View ${modelName} specs on models page`}
                                                    >
                                                        🧠
                                                    </Link>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700/60">
                                                    {stat ? (
                                                        <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium">
                                                            <span>{stat.rank <= 5 ? '🔥' : '⚡'}</span>
                                                            <span>{formatRouteCount(stat.routes)} {t('cars.fleetStats.routesLogged') || 'routes logged'}</span>
                                                            <span className="text-[10px] text-slate-400">({t('cars.fleetStats.fleetRank') || 'Rank'} #{stat.rank})</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">{t('cars.fleetStats.communityVerified') || 'Community Verified'}</span>
                                                    )}
                                                    <Link
                                                        href={modelUrl}
                                                        className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-cyan-500/10"
                                                        title={`View ${modelName} specs on models page`}
                                                    >
                                                        <span>{t('cars.fleetStats.viewModel') || 'Specs'}</span>
                                                        <span>↗</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {[
                                        { label: t('cars.setting.torque') || 'Torque Tuning', value: currentConfig.settings.torqueTuning, icon: '🔒' },
                                        { label: t('cars.setting.lateral') || 'Lateral Control', value: currentConfig.settings.lateralControl, icon: '🔄' },
                                        { label: t('cars.setting.longitudinal') || 'Longitudinal', value: currentConfig.settings.longitudinalControl, icon: '🚀' },
                                        { label: t('cars.setting.mads') || 'MADS', value: currentConfig.settings.mads, icon: '🛡️' },
                                        { label: t('cars.setting.exp') || 'Experimental', value: currentConfig.settings.experimentalMode, icon: '🧪' }
                                    ].map((s, idx) => (
                                        <div key={idx} className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-between">
                                            <div>
                                                <div className="text-xs text-slate-500 mb-0.5">{s.label}</div>
                                                <div className="font-bold text-slate-100">{s.value}</div>
                                            </div>
                                            <span className="text-2xl">{s.icon}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Community Fleet Adoption Section */}
                            <section className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                                            <span>📊</span> {t('cars.fleetStats.communityAdoption') || 'Community Fleet Adoption'}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {t('cars.fleetStats.communityAdoptionDesc') || 'Real-world route volume from the Sunnypilot live stats telemetry.'}
                                        </p>
                                    </div>
                                    <Link 
                                        href="/stats" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1 font-medium shrink-0"
                                    >
                                        <span>{t('stats.title') || 'Live Stats'}</span>
                                        <span>↗</span>
                                    </Link>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {configs.map((cfg, idx) => {
                                        const stat = getModelFleetStat(cfg.settings.drivingModel);
                                        const isCurrent = idx === selectedConfigIdx;
                                        return (
                                            <div 
                                                key={idx}
                                                onClick={() => setSelectedConfigIdx(idx)}
                                                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                                    isCurrent 
                                                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                                                        : 'bg-slate-900/40 border-slate-700/40 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between text-xs mb-1.5">
                                                    <span className={`font-bold truncate ${isCurrent ? 'text-cyan-300' : 'text-slate-200'}`}>
                                                        {cfg.name}
                                                    </span>
                                                    {stat && (
                                                        <span className="font-mono text-cyan-400 font-semibold text-xs shrink-0">
                                                            {formatRouteCount(stat.routes)} routes
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                    <span>
                                                        Model:{' '}
                                                        <Link
                                                            href={`/models?model=${modelNameToSlug(cfg.settings.drivingModel)}#${modelNameToSlug(cfg.settings.drivingModel)}`}
                                                            className="text-slate-300 hover:text-cyan-400 underline decoration-slate-600 hover:decoration-cyan-400 transition-colors font-bold inline-flex items-center gap-1"
                                                            title={`View ${cfg.settings.drivingModel} specs`}
                                                        >
                                                            <span>{cfg.settings.drivingModel}</span>
                                                            <span className="text-[10px]">↗</span>
                                                        </Link>
                                                    </span>
                                                    {stat && <span>{t('cars.fleetStats.fleetRankInFleet', { rank: stat.rank }) || `Rank #${stat.rank} in fleet`}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Review Section */}
                            <section>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">{t('cars.reviews') || 'User Reviews'}</h3>
                                <div className="space-y-4">
                                    {currentVehicle.reviews.map((review, idx) => (
                                        <div key={idx} className="p-6 rounded-2xl bg-slate-800/20 border border-slate-700/30">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xs uppercase">
                                                        {review.user.substring(0, 2)}
                                                    </div>
                                                    <span className="font-bold text-slate-300">{review.user}</span>
                                                </div>
                                                <div className="flex text-yellow-500 gap-0.5">
                                                    {[...Array(5)].map((_, i) => (
                                                        <span key={i} className={i < review.rating ? 'opacity-100' : 'opacity-20'}>⭐</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-slate-400 italic font-medium leading-relaxed">&quot;{review.comment}&quot;</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Sidebar: Hardware & Requirements */}
                        <div className="space-y-8">
                            <section>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">{t('cars.hardware') || 'Hardware Requirements'}</h3>
                                <div className="flex flex-col gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                                        <div className="text-xs text-slate-500 mb-1">{t('cars.device') || 'Device'}</div>
                                        <div className="font-bold text-slate-100 flex items-center gap-2">
                                            <span>📱</span> {currentVehicle.hardware.device}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                                        <div className="text-xs text-slate-500 mb-1">{t('cars.harness') || 'Harness'}</div>
                                        <div className="font-bold text-slate-100 flex items-center gap-2">
                                            <span>🔌</span> {currentVehicle.hardware.harness}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                                        <div className="text-xs text-slate-500 mb-1">{t('cars.radar') || 'Radar'}</div>
                                        <div className="font-bold text-slate-100 flex items-center gap-2">
                                            <span>📡</span> {currentVehicle.hardware.radar}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Brand & Platform Fleet Telemetry */}
                            {(() => {
                                const brandStat = getBrandFleetStat(currentVehicle.make);
                                if (!brandStat) return null;
                                return (
                                    <section className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/80 border border-slate-700/60">
                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                                <span>⚡</span> {t('cars.fleetStats.platformScale') || 'Platform Fleet Scale'}
                                            </h4>
                                            <span className="text-[11px] font-mono text-cyan-400 font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                                                Rank #{brandStat.rank}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-2.5 mb-3 flex-wrap">
                                            <span className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                                                {formatDeviceCount(brandStat.totalDevices)}
                                            </span>
                                            <span className="text-xs text-slate-400 leading-snug">
                                                {t('cars.fleetStats.activeDongles', { brand: brandStat.brand, pct: brandStat.sharePercent }) || `active ${brandStat.brand} dongles (${brandStat.sharePercent}% of fleet)`}
                                            </span>
                                        </div>

                                        <div className="space-y-2 pt-3 border-t border-slate-700/50">
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                                {t('cars.fleetStats.branchDistribution') || 'Community Branch Distribution:'}
                                            </div>
                                            {Object.entries(brandStat.branches)
                                                .sort((a, b) => b[1] - a[1])
                                                .slice(0, 3)
                                                .map(([branch, count]) => {
                                                    const pct = Math.round((count / brandStat.totalDevices) * 100);
                                                    return (
                                                        <div key={branch} className="text-xs">
                                                            <div className="flex justify-between text-[11px] mb-1">
                                                                <span className="font-mono text-slate-300 font-medium">{branch}</span>
                                                                <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                                                            </div>
                                                            <div className="w-full bg-slate-700/40 rounded-full h-1.5 overflow-hidden">
                                                                <div 
                                                                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-500" 
                                                                    style={{ width: `${pct}%` }} 
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </section>
                                );
                            })()}


                            <section className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                                <h4 className="text-cyan-400 font-bold text-sm mb-2">{t('cars.tip.title') || 'Pro Tip'}</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {t('cars.tip.desc') || 'Always verify your calibration after changing settings. Ensure the device is mounted securely for optimal NNLC performance.'}
                                </p>
                            </section>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
