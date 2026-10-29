'use client';
import TranslatedText from '@/components/TranslatedText';
import { useTextTranslation } from '@/lib/i18n';


import { useEffect, useId, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useLanguage, Locale } from '../lib/i18n';
import { modelNameToSlug } from '../lib/modelSlug';
import type { ModelVoteSummary } from '@/lib/modelVotes';
import {
    deriveSkillRatingsDetail,
    describeAxisEvidence,
    SkillRatings,
    SkillRatingsDetail,
} from '../lib/skillRatings';
import type { ForumActivity } from '../lib/discourse-models-sync';
import ModelMetaBadges from './ModelMetaBadges';
import CameraOffsetBanner from './CameraOffsetBanner';
import ConfidencePill from './ConfidencePill';
import ModelDomainRatings from './ModelDomainRatings';
import { getModelFleetStat } from '@/lib/fleetStats';


const ModelSvgPreview = dynamic(() => import('./ModelSvgPreview'), {
    ssr: false,
    loading: () => (
        <div className="aspect-video w-full bg-slate-950 flex flex-col items-center justify-center text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-2" />
            <span className="font-mono text-[11px] text-slate-400"><TranslatedText text={"Loading drive preview..."} /></span>
        </div>
    ),
});

const ModelTrajectoryVisualizer = dynamic(() => import('./ModelTrajectoryVisualizer'), {
    ssr: false,
    loading: () => (
        <div className="aspect-video w-full bg-slate-950 flex flex-col items-center justify-center text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-2" />
            <span className="font-mono text-[11px] text-slate-400"><TranslatedText text={"Loading trajectory visualizer..."} /></span>
        </div>
    ),
});

const ModelPollSurvey = dynamic(() => import('./ModelPollSurvey'), {
    ssr: false,
    loading: () => (
        <div className="p-8 bg-slate-900/30 rounded-xl flex items-center justify-center text-slate-500 text-xs">
            <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mr-2" />
            <span className="font-mono text-[11px] text-slate-400"><TranslatedText text={"Loading poll..."} /></span>
        </div>
    ),
});

export interface SentimentData {
    great: number;
    good: number;
    ok: number;
    bad: number;
}

export interface Model {
    name: string;
    date: string;
    tags?: string[];
    consensus?: string;
    vibe?: string;
    badge?: string;
    communityScore?: number;
    totalVotes?: number;
    sentiment?: SentimentData;
    bestFor?: string;
    testedOn?: string[];
    steeringFeel?: string;
    note?: string;
    forumUrl?: string;
    positives?: string[];
    negatives?: string[];
    skillRatings?: SkillRatings;
}

interface ModelDetailModalProps {
    model: Model;
    onClose: () => void;
    onExpandVisualizer?: (modelName: string) => void;
    forumActivity?: ForumActivity;
}

const SKILL_LABELS: Record<Locale, Record<keyof SkillRatings, string>> = {
    en: {
        lat: 'Lateral Control',
        stability: 'Highway Stability',
        turns: 'Curve & Turning',
        long: 'Longitudinal Control',
        urban: 'Urban Capability',
        comfort: 'Passenger Comfort',
    },
    ko: {
        lat: '횡방향 제어',
        stability: '고속도로 안정성',
        turns: '곡선 및 회전',
        long: '종방향 제어',
        urban: '도심 주행 능력',
        comfort: '승차감 및 편안함',
    },
    zh: {
        lat: '橫向控制',
        stability: '高速穩定性',
        turns: '彎道與轉向',
        long: '縱向控制',
        urban: '城市路況能力',
        comfort: '乘客舒適度',
    },
    fr: {
        lat: 'Contrôle Latéral',
        stability: 'Stabilité sur Autoroute',
        turns: 'Virages & Courbes',
        long: 'Contrôle Longitudinal',
        urban: 'Capacité Urbaine',
        comfort: 'Confort Passager',
    },
    de: {
        lat: 'Querlenkung',
        stability: 'Autobahnstabilität',
        turns: 'Kurvenverhalten',
        long: 'Längsregelung',
        urban: 'Stadt-Tauglichkeit',
        comfort: 'Fahrkomfort',
    },
    es: {
        lat: 'Control Lateral',
        stability: 'Estabilidad en Autovía',
        turns: 'Curvas y Giros',
        long: 'Control Longitudinal',
        urban: 'Capacidad Urbana',
        comfort: 'Confort del Pasajero',
    },
};

function relativeTime(iso: string, locale: string): string {
    const timestamp = new Date(iso).getTime();
    if (!Number.isFinite(timestamp)) return '';
    const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    if (minutes < 60) return formatter.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return formatter.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (days < 30) return formatter.format(-days, 'day');
    const months = Math.round(days / 30);
    if (months < 12) return formatter.format(-months, 'month');
    return formatter.format(-Math.round(months / 12), 'year');
}

function getBadgeColor(badge?: string) {
    const colors: Record<string, string> = {
        'FLAGSHIP': 'text-emerald-400 bg-emerald-900/40 border-emerald-500/30',
        'POPULAR': 'text-amber-400 bg-amber-900/40 border-amber-500/30',
        'LEGENDARY': 'text-yellow-400 bg-yellow-900/40 border-yellow-500/30',
        'NEW': 'text-cyan-400 bg-cyan-900/40 border-cyan-500/30',
        'EXPERIMENTAL': 'text-orange-400 bg-orange-900/40 border-orange-500/30',
        'DEV': 'text-red-400 bg-red-900/40 border-red-500/30',
        'HIDDEN GEM': 'text-pink-400 bg-pink-900/40 border-pink-500/30',
    };
    return colors[badge || ''] || 'text-slate-400 bg-slate-800/40 border-slate-600/30';
}

function getScoreColor(score?: number) {
    if (!score) return 'text-slate-400';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
}

function getTagIcon(tag: string) {
    const icons: Record<string, string> = {
        'Smart': '🧠',
        'Aggressive': '⚡',
        'Comfort': '🛋️',
        'Smooth': '🌊',
        'Stiff': '🔒',
        'Highway': '🛣️',
        'City': '🏙️',
        'Curves': '🔄',
        'Trucks': '🚚',
        'Vision': '👁️',
        'Rain': '🌧️',
    };
    return icons[tag] || '•';
}

function getVibeIcon(consensus?: string) {
    if (!consensus) return '🤖';
    const lower = consensus.toLowerCase();
    if (lower.includes('chill') || lower.includes('relaxed') || lower.includes('comfort')) return '🛋️';
    if (lower.includes('smooth') || lower.includes('flow') || lower.includes('graceful')) return '🌊';
    if (lower.includes('crisp') || lower.includes('precise') || lower.includes('sharp')) return '⚡';
    if (lower.includes('aggressive') || lower.includes('spirited') || lower.includes('punchy')) return '🔥';
    if (lower.includes('balanced') || lower.includes('standard') || lower.includes('neutral')) return '⚖️';
    return '🤖';
}

export default function ModelDetailModal({
    model,
    onClose,
    onExpandVisualizer,
    forumActivity,
}: ModelDetailModalProps) {
  const tx = useTextTranslation();
    const { t, locale } = useLanguage();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    const [copied, setCopied] = useState(false);
    const [userVoteData, setUserVoteData] = useState<{
        modelName: string;
        communityScore: number;
        totalVotes: number;
        sentiment: SentimentData;
    } | null>(null);
    const [simulationVotes, setSimulationVotes] = useState<ModelVoteSummary>();
    const [simView, setSimView] = useState<'perspective' | 'trajectory'>('perspective');
    const [isPulsing, setIsPulsing] = useState(false);

    const liveScore = userVoteData?.modelName === model.name ? userVoteData.communityScore : model.communityScore;
    const liveVotes = userVoteData?.modelName === model.name ? userVoteData.totalVotes : model.totalVotes;
    const liveSentiment = userVoteData?.modelName === model.name ? userVoteData.sentiment : model.sentiment;

    const handleScoreUpdate = useCallback((liveData: {
        communityScore: number;
        totalVotes: number;
        sentiment: SentimentData;
    }) => {
        setUserVoteData({ modelName: model.name, ...liveData });
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 1500);
    }, [model.name]);

    const handleCopyLink = async () => {
        const slug = modelNameToSlug(model.name);
        const url = `${window.location.origin}/models?model=${slug}`;
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share({
                    title: `${model.name} — openpilot Driving Model`,
                    text: `Check out the ${model.name} openpilot driving model on Sunnylink Wiki:`,
                    url,
                });
                return;
            } catch (err: unknown) {
                if (err instanceof Error && err.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        const previousBodyOverflow = document.body.style.overflow;
        const previousRootOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        panelRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key !== 'Tab' || !panelRef.current) return;
            const focusable = panelRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === panelRef.current)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousRootOverflow;
            opener?.focus?.({ preventScroll: true });
        };
    }, [onClose]);

    if (typeof document === 'undefined') return null;

    const labels = SKILL_LABELS[locale as Locale] || SKILL_LABELS.en;
    const skillDetail: SkillRatingsDetail = deriveSkillRatingsDetail(model);
    const ratings = skillDetail.ratings;

    const skills = [
        { key: 'lat' as const, color: 'from-cyan-400 to-blue-500' },
        { key: 'stability' as const, color: 'from-emerald-400 to-teal-500' },
        { key: 'turns' as const, color: 'from-indigo-400 to-violet-500' },
        { key: 'long' as const, color: 'from-amber-400 to-orange-500' },
        { key: 'urban' as const, color: 'from-rose-400 to-pink-500' },
        { key: 'comfort' as const, color: 'from-sky-400 to-indigo-500' },
    ];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={onClose}
                aria-hidden="true"
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Modal Panel */}
            <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl xl:max-w-7xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl outline-none sm:max-h-[90dvh]"
            >
                {/* Header */}
                <div className="shrink-0 border-b border-slate-800 p-4 sm:p-5 pr-14 sm:pr-20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                {model.badge && (
                                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${getBadgeColor(model.badge)}`}>
                                        <TranslatedText text={model.badge} />
                                    </span>
                                )}
                                <span className="text-xs text-slate-500 font-medium"><TranslatedText text={model.date} /></span>
                            </div>
                            <h2 id={titleId} className="text-2xl sm:text-3xl font-bold text-slate-100 break-words flex items-center gap-2.5">
                                <span><TranslatedText text={getVibeIcon(model.consensus)} /></span>
                                <span>{model.name}</span>
                            </h2>
                            <ModelMetaBadges modelName={model.name} />
                        </div>

                        {/* Actions & Rating */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {liveScore !== undefined && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                                    <span className={`text-xl sm:text-2xl font-bold transition-transform duration-300 ${getScoreColor(liveScore)} ${isPulsing ? 'scale-110 text-cyan-400' : ''}`}>
                                        {liveScore}%
                                    </span>
                                    {liveVotes && (
                                        <div className="text-[10px] text-slate-400 leading-tight">
                                            <div className="font-semibold">{t('models.rating') || 'Rating'}</div>
                                            <div>{liveVotes} {t('models.votes') || 'votes'}</div>
                                        </div>
                                    )}
                                    <ConfidencePill
                                        reviewCount={liveVotes ?? model.totalVotes ?? 0}
                                        routeCount={getModelFleetStat(model.name)?.routes ?? 0}
                                    />
                                </div>
                            )}

                            {/* Flag Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    const title = encodeURIComponent(`Issue with Model: ${model.name}`);
                                    const body = encodeURIComponent(`describe the issue with this model here...`);
                                    window.open(`https://github.com/vinnie291/sunnylink-wiki/issues/new?title=${title}&body=${body}`, '_blank');
                                }}
                                className="p-2 rounded-xl text-slate-400 hover:text-amber-400 bg-slate-800/80 hover:bg-amber-500/10 border border-slate-700/50 transition-colors"
                                title={tx("Flag issue with this model")}
                                aria-label={tx("Flag issue")}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                            </button>

                            {/* Share Button */}
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 bg-slate-800/80 hover:bg-cyan-500/10 border border-slate-700/50 transition-colors"
                                title={tx(copied ? 'Copied URL!' : 'Share model link')}
                                aria-label={tx("Share model link")}
                            >
                                {copied ? (
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                )}
                            </button>

                            {model.forumUrl && (
                                <a
                                    href={model.forumUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700/50"
                                >
                                    <span>💬</span>
                                    <span>{t('cars.forum') || 'Forum'}</span>
                                    <span className="text-[10px] text-cyan-400">↗</span>
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Close Button in Top Right */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('models.closeDetails') || 'Close model details'}
                    className="absolute top-4 right-4 sm:top-5 sm:right-5 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors z-20"
                >
                    <X size={18} />
                </button>

                {/* Scrollable Body: Balanced 3-Column Desktop Grid */}
                <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6">
                        {/* Column 1: Live Simulation & Driving Personality */}
                        <div className="min-w-0 space-y-5">
                            {/* Live Simulation Preview */}
                            <section className="rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950/40 relative">
                                <div className="p-3 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                        <span>🛣️</span> {t('models.simulationPreview') || 'Drive Simulation'}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <div role="tablist" aria-label={tx('Simulation view mode')} className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={simView === 'perspective'}
                                                onClick={() => setSimView('perspective')}
                                                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${
                                                    simView === 'perspective' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                <TranslatedText text="3D Road" />
                                            </button>
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={simView === 'trajectory'}
                                                onClick={() => setSimView('trajectory')}
                                                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${
                                                    simView === 'trajectory' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                <TranslatedText text="Trajectory & Rack" />
                                            </button>
                                        </div>
                                        {onExpandVisualizer && (
                                            <button
                                                type="button"
                                                onClick={() => onExpandVisualizer(model.name)}
                                                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors"
                                            >
                                                <span><TranslatedText text={"Full Simulator"} /></span>
                                                <span>↗</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    {simView === 'perspective' ? (
                                        <ModelSvgPreview modelName={model.name} votes={simulationVotes} />
                                    ) : (
                                        <ModelTrajectoryVisualizer modelName={model.name} />
                                    )}
                                </div>
                            </section>

                            {/* Steering Feel & Best For */}
                            {((model.tags && model.tags.length > 0) || model.bestFor || model.steeringFeel) && (
                                <section className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                        <span>🎮</span> {t('models.drivingCharacteristics') || 'Characteristics & Feel'}
                                    </h3>

                                    <div className="grid grid-cols-1 gap-2.5">
                                        {model.steeringFeel && (
                                            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="text-[11px] text-slate-400 mb-0.5">{t('models.steeringFeel') || 'Steering Feel'}</div>
                                                    <div className="font-bold text-slate-100 text-xs sm:text-sm"><TranslatedText text={model.steeringFeel} /></div>
                                                </div>
                                                <span className="text-xl">🎮</span>
                                            </div>
                                        )}
                                        {model.bestFor && (
                                            <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="text-[11px] text-violet-300 mb-0.5 font-medium">{t('models.bestFor') || 'Best For'}</div>
                                                    <div className="font-bold text-slate-100 text-xs sm:text-sm"><TranslatedText text={model.bestFor} /></div>
                                                </div>
                                                <span className="text-xl">🎯</span>
                                            </div>
                                        )}
                                    </div>

                                    {model.tags && model.tags.length > 0 && (
                                        <div className="pt-2 border-t border-slate-700/40">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
                                                {t('models.tags') || 'Tags & Traits'}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {model.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-slate-800/80 text-slate-200 border border-slate-700/60"
                                                    >
                                                        <span><TranslatedText text={getTagIcon(tag)} /></span>
                                                        <span><TranslatedText text={tag} /></span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                            <CameraOffsetBanner modelName={model.name} />

                            {/* Tested On Vehicles */}
                            {model.testedOn && model.testedOn.length > 0 && (
                                <section className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2.5 flex items-center gap-1.5">
                                        <span>🚗</span> {t('models.testedOn') || 'Tested On Vehicles'}
                                    </h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {model.testedOn.map((car, i) => (
                                            <Link
                                                key={`${car}-${i}`}
                                                href={`/cars?search=${encodeURIComponent(car)}`}
                                                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800/80 hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-300 border border-slate-700/50 hover:border-cyan-500/30 transition-colors inline-flex items-center gap-1"
                                                title={tx(`View ${car} configs`)}
                                            >
                                                <span><TranslatedText text={car} /></span>
                                                <span className="text-[10px] text-cyan-400">↗</span>
                                            </Link>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Column 2: Skill Ratings & Vibe Consensus */}
                        <div className="min-w-0 space-y-5">
                            {/* Consensus Section */}
                            <section>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-3">
                                    {t('models.consensus') || 'Community Consensus & Vibe'}
                                </h3>
                                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 relative overflow-hidden">
                                    <div className="absolute top-2 right-2 text-3xl opacity-10 pointer-events-none">💬</div>
                                    <p className="text-sm text-slate-200 leading-relaxed italic relative z-10">
                                         <TranslatedText text={"\""} /><TranslatedText text={model.consensus} /><TranslatedText text={"\""} /> </p>
                                    {model.note && (
                                        <div className="mt-2.5 pt-2.5 border-t border-slate-700/40 text-xs text-yellow-300/90 font-medium flex items-center gap-1.5">
                                            <span>⚠️</span>
                                            <span><TranslatedText text={model.note} /></span>
                                        </div>
                                    )}
                                </div>
                            </section>


                            {/* Skill Attributes Breakdown */}
                            <section className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                                        <span>📊</span> {t('models.skillRatings') || 'Skill Attributes'}
                                    </h3>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                                         <TranslatedText text={"0–99 Scale"} /> </span>
                                </div>

                                <div className="space-y-3 bg-slate-950/30 p-3.5 rounded-xl border border-slate-800/50">
                                    {skills.map((skill) => {
                                        const value = ratings[skill.key];
                                        const evidence = describeAxisEvidence(skillDetail, skill.key);
                                        return (
                                            <div
                                                key={skill.key}
                                                className="space-y-1"
                                                title={tx(evidence ? `${labels[skill.key]} — ${value}/99\n${evidence}` : undefined)}
                                            >
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-300 font-medium truncate pr-2"><TranslatedText text={labels[skill.key]} /></span>
                                                    <span className="text-cyan-400 font-bold font-mono text-xs bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/30 shrink-0">
                                                        {value}/99
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                                                    <div
                                                        style={{ width: `${(value / 99) * 100}%` }}
                                                        className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${skill.color}`}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-3.5">
                                    <ModelDomainRatings
                                        modelName={model.name}
                                        skills={ratings}
                                        summary={simulationVotes}
                                        onSummaryUpdate={setSimulationVotes}
                                    />
                                </div>
                            </section>

                            {/* Sentiment Distribution */}
                            {liveSentiment && (
                                <section className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-2.5 flex items-center gap-1.5">
                                        <span>🗳️</span> {t('models.communitySentiment') || 'Community Sentiment'}
                                    </h3>
                                    <div className="w-full h-2 flex rounded-full overflow-hidden mb-2">
                                        <div style={{ width: `${liveSentiment.great}%` }} className="bg-emerald-500" title={tx(`Great: ${liveSentiment.great}%`)} />
                                        <div style={{ width: `${liveSentiment.good}%` }} className="bg-blue-500" title={tx(`Good: ${liveSentiment.good}%`)} />
                                        <div style={{ width: `${liveSentiment.ok}%` }} className="bg-yellow-500" title={tx(`OK: ${liveSentiment.ok}%`)} />
                                        <div style={{ width: `${liveSentiment.bad}%` }} className="bg-red-500" title={tx(`Bad: ${liveSentiment.bad}%`)} />
                                    </div>
                                    <div className="grid grid-cols-4 text-[10px] text-slate-400 font-medium">
                                        <span className="text-emerald-400"><TranslatedText text={"Great"} /> {liveSentiment.great}%</span>
                                        <span className="text-blue-400 text-center"><TranslatedText text={"Good"} /> {liveSentiment.good}%</span>
                                        <span className="text-yellow-400 text-center"><TranslatedText text={"OK"} /> {liveSentiment.ok}%</span>
                                        <span className="text-red-400 text-right"><TranslatedText text={"Bad"} /> {liveSentiment.bad}%</span>
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Column 3: Interactive Voting Poll & Community Chatter */}
                        <div className="min-w-0 space-y-5 md:col-span-2 xl:col-span-1">
                            {/* Interactive Discourse-Style Voting Survey */}
                            <section className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-3 flex items-center gap-1.5">
                                    <span>🗳️</span> {t('models.survey') || 'Community Model Poll'}
                                </h3>
                                <ModelPollSurvey
                                    modelName={model.name}
                                    baseScore={model.communityScore}
                                    baseVotes={model.totalVotes}
                                    baseSentiment={model.sentiment}
                                    onScoreUpdate={handleScoreUpdate}
                                    onSummaryUpdate={setSimulationVotes}
                                />
                            </section>

                            {/* Forum Activity */}
                            {model.forumUrl && (
                                <section className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                                            <span>💬</span> {t('models.forumDiscussion') || 'Forum Discussion'}
                                        </h3>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{t('models.syncedWeekly') || 'synced weekly'}</span>
                                    </div>

                                    {forumActivity && (
                                        <div className="flex items-center justify-between text-xs text-slate-300 mb-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="text-cyan-400 font-bold">{forumActivity.replyCount}</span>
                                                <span className="text-slate-400">{t('models.replies') || 'replies'}</span>
                                            </span>
                                            {forumActivity.lastPostedAt && (
                                                <span className="text-slate-400 text-xs">
                                                    {t('models.active', { time: relativeTime(forumActivity.lastPostedAt, locale) }) || `active ${relativeTime(forumActivity.lastPostedAt, locale)}`}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <a
                                        href={model.forumUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-slate-700/50"
                                    >
                                        <span><TranslatedText text={"💬 Discuss on Sunnypilot Forum"} /></span>
                                        <span className="text-cyan-400">↗</span>
                                    </a>
                                </section>
                            )}

                            {/* Pro Tip */}
                            <section className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                                <h4 className="text-cyan-400 font-bold text-sm mb-1.5 flex items-center gap-1.5">
                                    <span>💡</span> {t('models.tipTitle') || 'Pro Tip'}
                                </h4>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {t('models.tipDesc') || 'Different driving models emphasize different steering personalities. Test in clear weather conditions first to find the model that best matches your vehicle mounting and driving style.'}
                                </p>
                            </section>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
