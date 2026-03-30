'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/i18n';

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

interface CarDetailViewProps {
    vehicle: Vehicle;
    onClose: () => void;
}

export default function CarDetailView({ vehicle, onClose }: CarDetailViewProps) {
    const { t } = useLanguage();
    const [selectedConfigIdx, setSelectedConfigIdx] = useState(0);

    const configs = vehicle.configs?.length ? vehicle.configs : [
        { name: t('cars.bestSettings') || 'Recommended Configuration', settings: vehicle.bestSettings }
    ];
    const currentConfig = configs[selectedConfigIdx] || configs[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
                    className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Content Header */}
                <div className="p-6 sm:p-8 border-b border-slate-800 shrink-0">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <div className="text-sm font-bold text-cyan-500 uppercase tracking-widest mb-1">{vehicle.make}</div>
                            <h2 className="text-4xl font-bold text-white">{vehicle.model}</h2>
                            <div className="text-slate-400 font-medium">{vehicle.years}</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-sm font-bold uppercase tracking-wider">
                                {t('cars.status') || 'Tested'}
                            </span>
                            {vehicle.forumUrl && (
                                <a
                                    href={vehicle.forumUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors flex items-center gap-2"
                                >
                                    <span>💬</span> {t('cars.forum') || 'Join Discussion'}
                                </a>
                            )}
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
                                        &quot;{vehicle.communityConsensus}&quot;
                                    </p>
                                </div>
                            </section>

                            {/* Community Chatter / Forum Quotes */}
                            {vehicle.forumQuotes && vehicle.forumQuotes.length > 0 && (
                                <section>
                                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">{t('cars.highlights') || 'Forum Highlights'}</h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {vehicle.forumQuotes.map((quote, idx) => (
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
                                                className="appearance-none bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 text-white text-sm font-bold py-2 pl-4 pr-10 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all cursor-pointer w-full"
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
                                    {[
                                        { label: t('cars.setting.model') || 'Driving Model', value: currentConfig.settings.drivingModel, icon: '🧠' },
                                        { label: t('cars.setting.torque') || 'Torque Tuning', value: currentConfig.settings.torqueTuning, icon: '🔒' },
                                        { label: t('cars.setting.lateral') || 'Lateral Control', value: currentConfig.settings.lateralControl, icon: '🔄' },
                                        { label: t('cars.setting.longitudinal') || 'Longitudinal', value: currentConfig.settings.longitudinalControl, icon: '🚀' },
                                        { label: t('cars.setting.mads') || 'MADS', value: currentConfig.settings.mads, icon: '🛡️' },
                                        { label: t('cars.setting.exp') || 'Experimental', value: currentConfig.settings.experimentalMode, icon: '🧪' }
                                    ].map((s, idx) => (
                                        <div key={idx} className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-between">
                                            <div>
                                                <div className="text-xs text-slate-500 mb-0.5">{s.label}</div>
                                                <div className="font-bold text-white">{s.value}</div>
                                            </div>
                                            <span className="text-2xl">{s.icon}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Review Section */}
                            <section>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">{t('cars.reviews') || 'User Reviews'}</h3>
                                <div className="space-y-4">
                                    {vehicle.reviews.map((review, idx) => (
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
                                        <div className="font-bold text-white flex items-center gap-2">
                                            <span>📱</span> {vehicle.hardware.device}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                                        <div className="text-xs text-slate-500 mb-1">{t('cars.harness') || 'Harness'}</div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            <span>🔌</span> {vehicle.hardware.harness}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                                        <div className="text-xs text-slate-500 mb-1">{t('cars.radar') || 'Radar'}</div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            <span>📡</span> {vehicle.hardware.radar}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                                <h4 className="text-cyan-400 font-bold text-sm mb-2">{t('cars.tip.title') || 'Pro Tip'}</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {t('cars.tip.desc') || 'Always verify your calibration after changing settings. Ensure the device is mounted securely for optimal NNLC performance.'}
                                </p>
                            </section>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/50 shrink-0 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all"
                    >
                        {t('cars.close') || 'Close Database'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
