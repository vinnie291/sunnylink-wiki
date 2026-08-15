'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Fuse from 'fuse.js';

import ViewToggle from './ViewToggle';
import SearchFilter from './SearchFilter';
import MobileCategorySidebar from './MobileCategorySidebar';
import SidebarInlineControls from './SidebarInlineControls';
import DriveSimulation, { deriveDrivingProfile } from './DriveSimulation';
import FullScreenDriveVisualizer from './FullScreenDriveVisualizer';
import { useViewMode } from '../hooks/useViewMode';
import { useStickySearch } from '../hooks/useStickySearch';
import { useDesktopSidebarSticky } from '../hooks/useDesktopSidebarSticky';
import { useLanguage, Locale } from '../lib/i18n';
import { useTranslatedModels } from '../lib/useTranslatedData';
import {
    deriveSkillRatings,
    deriveSkillRatingsDetail,
    describeAxisEvidence,
    SkillRatings,
    SkillRatingsDetail,
} from '../lib/skillRatings';
import type { ForumActivity, ForumActivityMap } from '../lib/discourse-models-sync';

export { deriveSkillRatings };
export type { SkillRatings };

function extractTopicId(forumUrl: string): number | null {
    const m = forumUrl.match(/\/t\/(?:[^/]+\/)?(\d+)(?:[/?#]|$)/);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isFinite(id) ? id : null;
}

const CategorySidebarButton = dynamic(() => import('./CategorySidebarButton'), { ssr: false });

interface SentimentData {
    great: number;
    good: number;
    ok: number;
    bad: number;
}

interface Model {
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

interface ModelCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    models: Model[];
}

interface VibeGuide {
    title: string;
    includes: string;
    vibe: string;
    bestFor: string;
    recommendation?: string;
}

// Sentiment Bar Component
function SentimentBar({ sentiment }: { sentiment: SentimentData }) {
    return (
        <div className="w-full h-1.5 flex rounded-full overflow-hidden" title="Great / Good / OK / Bad">
            <div style={{ width: `${sentiment.great}%` }} className="bg-emerald-500" />
            <div style={{ width: `${sentiment.good}%` }} className="bg-blue-500" />
            <div style={{ width: `${sentiment.ok}%` }} className="bg-yellow-500" />
            <div style={{ width: `${sentiment.bad}%` }} className="bg-red-500" />
        </div>
    );
}

const SKILL_LABELS: Record<Locale, Record<keyof SkillRatings, string>> = {
    en: {
        lat: 'Lateral Control',
        stability: 'Highway Stability',
        turns: 'Curve & Turning',
        long: 'Longitudinal Control',
        urban: 'Urban Capability',
        comfort: 'Passenger Comfort'
    },
    ko: {
        lat: '측면 제어',
        stability: '고속도로 안정성',
        turns: '곡선 및 회전',
        long: '종방향 제어',
        urban: '도심 주행 능력',
        comfort: '승차감 및 편안함'
    },
    zh: {
        lat: '横向控制',
        stability: '高速稳定性',
        turns: '弯道与转向',
        long: '纵向控制',
        urban: '城市路况能力',
        comfort: '乘客舒适度'
    },
    fr: {
        lat: 'Contrôle Latéral',
        stability: 'Stabilité sur Autoroute',
        turns: 'Virages & Courbes',
        long: 'Contrôle Longitudinal',
        urban: 'Capacité Urbaine',
        comfort: 'Confort Passager'
    },
    de: {
        lat: 'Querlenkung',
        stability: 'Autobahnstabilität',
        turns: 'Kurvenverhalten',
        long: 'Längslenkung',
        urban: 'Stadt-Tauglichkeit',
        comfort: 'Fahrkomfort'
    },
    es: {
        lat: 'Control Lateral',
        stability: 'Estabilidad en Autovía',
        turns: 'Curvas y Giros',
        long: 'Control Longitudinal',
        urban: 'Capacidad Urbana',
        comfort: 'Confort del Pasajero'
    }
};

// Glowing Skill Bar Component
function SkillBar({ label, value, colorClass, evidence }: { label: string; value: number; colorClass: string; evidence?: string }) {
    return (
        <div className="space-y-1" title={evidence ? `${label} — ${value}/99\n${evidence}` : undefined}>
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-medium truncate pr-1">{label}</span>
                <span className="text-slate-300 font-bold font-mono text-[9px] bg-slate-800/40 px-1 py-0.2 rounded border border-slate-700/20 shrink-0">
                    {value}/99
                </span>
            </div>
            <div className="h-1.5 w-full bg-slate-950/50 rounded-full overflow-hidden border border-slate-800/30 relative">
                <div
                    style={{ width: `${(value / 99) * 100}%` }}
                    className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${colorClass}`}
                />
            </div>
        </div>
    );
}

// Grid of 6 Skill Bars
function SkillRatingsGrid({ detail }: { detail: SkillRatingsDetail }) {
    const { locale } = useLanguage();
    const labels = SKILL_LABELS[locale as Locale] || SKILL_LABELS.en;
    const ratings = detail.ratings;

    const skills = [
        { key: 'lat' as const, color: 'from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(34,211,238,0.3)]' },
        { key: 'stability' as const, color: 'from-emerald-400 to-teal-500 shadow-[0_0_8px_rgba(52,211,153,0.3)]' },
        { key: 'turns' as const, color: 'from-indigo-400 to-violet-500 shadow-[0_0_8px_rgba(129,140,248,0.3)]' },
        { key: 'long' as const, color: 'from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(251,191,36,0.3)]' },
        { key: 'urban' as const, color: 'from-rose-400 to-pink-500 shadow-[0_0_8px_rgba(251,113,133,0.3)]' },
        { key: 'comfort' as const, color: 'from-sky-400 to-indigo-500 shadow-[0_0_8px_rgba(56,189,248,0.3)]' },
    ];

    return (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 my-3.5 bg-slate-950/20 backdrop-blur-md p-3 rounded-lg border border-slate-800/40">
            {skills.map((skill) => (
                <SkillBar
                    key={skill.key}
                    label={labels[skill.key]}
                    value={ratings[skill.key]}
                    colorClass={skill.color}
                    evidence={describeAxisEvidence(detail, skill.key)}
                />
            ))}
        </div>
    );
}

function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const diff = Date.now() - then;
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.round(months / 12)}y ago`;
}

function ForumActivityPanel({ activity, forumUrl }: { activity?: ForumActivity; forumUrl: string }) {
    return (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
            {activity && (
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                            <span aria-hidden>💬</span>
                            <span className="text-slate-300 font-medium">{activity.replyCount}</span>
                            <span>replies</span>
                        </span>
                        {activity.lastPostedAt && (
                            <span className="hidden sm:inline">active {relativeTime(activity.lastPostedAt)}</span>
                        )}
                    </p>
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider">synced weekly</span>
                </div>
            )}

            {activity && activity.recentComments.length > 0 && (
                <ul className="space-y-2 mb-3">
                    {activity.recentComments.map((c) => (
                        <li key={c.postNumber} className="text-xs">
                            <a
                                href={`${forumUrl.replace(/\/$/, '')}/${c.postNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="block rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 px-2.5 py-2 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-cyan-300 font-medium truncate">
                                        @{c.username}
                                    </span>
                                    <span className="text-slate-500">{relativeTime(c.createdAt)}</span>
                                    {c.likeCount > 0 && (
                                        <span className="ml-auto text-slate-500">❤️ {c.likeCount}</span>
                                    )}
                                </div>
                                <p className="text-slate-300 leading-snug line-clamp-2 break-words">
                                    {c.snippet}
                                </p>
                            </a>
                        </li>
                    ))}
                </ul>
            )}

            {forumUrl && (
                <div className={activity ? "mt-3" : ""}>
                    <a
                        href={forumUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
                    >
                        <span>💬</span> Discuss
                    </a>
                </div>
            )}
        </div>
    );
}

// Model Card Component
function ModelCard({
    model,
    onExpand,
    forumActivity,
}: {
    model: Model;
    onExpand?: (modelName: string) => void;
    forumActivity?: ForumActivity;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/models?model=${encodeURIComponent(model.name)}`;
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share({
                    title: `${model.name} — openpilot Driving Model`,
                    text: `Check out the ${model.name} openpilot driving model simulation on Sunnylink Wiki:`,
                    url,
                });
                return;
            } catch (err: any) {
                if (err.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('model', model.name);
            window.history.replaceState(null, '', newUrl.toString());
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };


    const getBadgeColor = (badge?: string) => {
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
    };

    const getScoreColor = (score?: number) => {
        if (!score) return 'text-slate-400';
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-blue-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getTagIcon = (tag: string) => {
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
    };

    const profile = deriveDrivingProfile(model);

    return (
        <div
            id={model.name}
            className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all duration-300 group"
        >
            {/* Animated drive simulation hero */}
            <div className="relative">
                <DriveSimulation profile={profile} seedKey={model.name} disableRainbow={true} scenarioOverride="gauntlet" mini />
                {onExpand && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onExpand(model.name);
                        }}
                        aria-label={`Expand ${model.name} in fullscreen visualizer`}
                        title="Expand to fullscreen visualizer"
                        className="absolute top-2 right-2 z-10 h-8 w-8 rounded-lg bg-black/40 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center transition-colors border border-white/10"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="p-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold text-slate-100 truncate">{model.name}</h3>
                            {model.badge && (
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getBadgeColor(model.badge)}`}>
                                    {model.badge}
                                </span>
                            )}

                            {/* Flag Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const title = encodeURIComponent(`Issue with Model: ${model.name}`);
                                    const body = encodeURIComponent(`describe the issue with this model here...`);
                                    window.open(`https://github.com/vinnie291/sunnylink-wiki/issues/new?title=${title}&body=${body}`, '_blank');
                                }}
                                className="p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                title="Flag this model"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                            </button>

                            {/* Share Button */}
                            <button
                                onClick={handleCopyLink}
                                className="p-1 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                title={copied ? 'Copied!' : 'Share this model'}
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

                        </div>
                        <span className="text-xs text-slate-500">{model.date}</span>
                    </div>
                    {model.communityScore !== undefined && (
                        <div className="flex flex-col items-end shrink-0">
                            <span className={`text-2xl font-bold ${getScoreColor(model.communityScore)}`}>
                                {model.communityScore}%
                            </span>
                            {model.totalVotes && (
                                <span className="text-[10px] text-slate-500">{model.totalVotes} votes</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Sentiment Bar */}
                {model.sentiment && (
                <div className="mb-4">
                    <SentimentBar sentiment={model.sentiment} />
                    <div className="grid grid-cols-4 text-[9px] text-slate-600 mt-1">
                        <span>Great {model.sentiment.great}%</span>
                        <span className="text-center">Good {model.sentiment.good}%</span>
                        <span className="text-center">OK {model.sentiment.ok}%</span>
                        <span className="text-right">Bad {model.sentiment.bad}%</span>
                    </div>
                </div>
            )}

            {/* Tags */}
            {((model.tags && model.tags.length > 0) || model.bestFor || model.steeringFeel) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {model.tags?.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-slate-800/60 text-slate-300 border border-slate-700/50"
                        >
                            <span>{getTagIcon(tag)}</span>
                            <span>{tag}</span>
                        </span>
                    ))}
                    {model.bestFor && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            <span>🎯</span> Best for: {model.bestFor}
                        </span>
                    )}
                    {model.steeringFeel && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/50">
                            <span>🎮</span> {model.steeringFeel}
                        </span>
                    )}
                </div>
            )}

            {/* Vibe Check / Consensus */}
            <p className="text-sm text-slate-300 leading-relaxed mb-3 break-words">
                {model.consensus}
                {model.note && (
                    <span className="text-yellow-300/80 italic"> {model.note}</span>
                )}
            </p>

            {/* Skill Attributes Grid */}
            <SkillRatingsGrid detail={deriveSkillRatingsDetail(model)} />

            {/* Tested On — always visible */}
            {model.testedOn && model.testedOn.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">🚗 Tested on:</p>
                    <div className="flex flex-wrap gap-1">
                        {model.testedOn.map((car, i) => (
                            <span key={`${car}-${i}`} className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400">
                                {car}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Forum activity — votes (OP likes) + most recent comments,
                synced weekly from community.sunnypilot.ai. */}
            {model.forumUrl && (
                <ForumActivityPanel activity={forumActivity} forumUrl={model.forumUrl} />
            )}
            </div>
        </div>
    );
}

// Helper for Vibe Icons
// Skeleton + lazy mount — keeps the model grid cheap while scrolling.
// Each card mounts (and starts its DriveSimulation) only when it lands
// within ~400px of the viewport, then fades in.
function ModelCardSkeleton() {
    return (
        <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl overflow-hidden h-full animate-pulse">
            <div className="aspect-video bg-slate-800/50" />
            <div className="p-4 space-y-3">
                <div className="h-5 w-3/5 bg-slate-800 rounded" />
                <div className="h-1.5 bg-slate-800 rounded" />
                <div className="flex gap-2">
                    <div className="h-5 w-14 bg-slate-800 rounded-full" />
                    <div className="h-5 w-20 bg-slate-800 rounded-full" />
                </div>
                <div className="h-10 bg-slate-800/60 rounded" />
                <div className="flex gap-2">
                    <div className="h-7 w-24 bg-slate-800/60 rounded-lg" />
                    <div className="h-7 w-20 bg-slate-800/60 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

function LazyModelCard({ children }: { children: React.ReactNode }) {
    const [shown, setShown] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (shown) return;
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') {
            setShown(true);
            return;
        }
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShown(true);
                    io.disconnect();
                }
            },
            { rootMargin: '400px 0px', threshold: 0 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [shown]);

    return (
        <div ref={ref} className="h-full">
            {shown ? (
                <div className="h-full animate-fade-in">
                    {children}
                </div>
            ) : (
                <ModelCardSkeleton />
            )}
        </div>
    );
}

const getVibeIcon = (consensus?: string) => {
    switch (consensus?.toLowerCase()) {
        case 'aggressive': return '🚀';
        case 'standard': return '⚖️';
        case 'relaxed': return '🛋️';
        case 'comfort': return '🧸';
        default: return '🤖';
    }
};

export default function ModelLibrary({ forumActivity }: { forumActivity?: ForumActivityMap } = {}) {
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [showVibeGuide, setShowVibeGuide] = useState(false);
    const [showMobileCategories, setShowMobileCategories] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [visualizerModelName, setVisualizerModelName] = useState<string | null>(null);
    const vibeGuideRef = useRef<HTMLDivElement>(null);
    const [vibeGuideHeight, setVibeGuideHeight] = useState(0);
    const { t } = useLanguage();


    // Keyboard shortcut handled by SearchFilter component

    const handleOpenVisualizer = (modelName: string) => {
        setVisualizerModelName(modelName);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('model', modelName);
            window.history.pushState({ visualizerModel: modelName }, '', url.toString());
        }
    };

    const handleCloseVisualizer = () => {
        setVisualizerModelName(null);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('model');
            url.searchParams.delete('sim');
            url.hash = '';
            window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
        }
    };

    const [sortBy, setSortBy] = useState<string>('date-desc');
    const { viewMode, setViewMode } = useViewMode('models_page', 'grid');
    const { sentinelRef, isSticky } = useStickySearch();
    const { sidebarSentinelRef, isSidebarSticky } = useDesktopSidebarSticky();

    const modelsData = useTranslatedModels();
    const rawCategories = modelsData.categories as ModelCategory[];
    const vibeGuide = modelsData.vibeGuide as Record<string, VibeGuide>;

    // Measure vibe guide content height for smooth open/close without sporadic scrolling
    useEffect(() => {
        const el = vibeGuideRef.current;
        if (!el) return;
        const measure = () => setVibeGuideHeight(el.scrollHeight);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [vibeGuide]);

    const categories = useMemo(() => {
        const uniqueModels = new Map<string, Model>();
        rawCategories.flatMap(c => c.models).forEach(m => {
            if (!uniqueModels.has(m.name)) uniqueModels.set(m.name, m);
        });

        const allCategory: ModelCategory = {
            id: 'all',
            name: t('models.allModels'),
            description: t('models.allModelsDescription'),
            icon: '📚',
            models: Array.from(uniqueModels.values())
        };

        return [allCategory, ...rawCategories];
    }, [rawCategories, t]);

    // Deep-link to open visualizer or scroll to model when URL contains ?model=... or #...
    useEffect(() => {
        const checkUrlParams = () => {
            if (typeof window === 'undefined') return;
            const params = new URLSearchParams(window.location.search);
            const queryModel = params.get('model') || params.get('sim');
            const hashModel = window.location.hash && window.location.hash.length > 1
                ? decodeURIComponent(window.location.hash.slice(1))
                : null;
            const target = queryModel || hashModel;

            if (target && categories[0]?.models) {
                const found = categories[0].models.find(
                    m => m.name.toLowerCase() === target.toLowerCase()
                );
                if (found) {
                    setVisualizerModelName(found.name);
                    return;
                }
            }

            if (hashModel) {
                const el = document.getElementById(hashModel);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-cyan-500/70');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-500/70'), 3000);
                }
            }
        };

        checkUrlParams();

        const handlePopState = () => {
            if (typeof window === 'undefined') return;
            const params = new URLSearchParams(window.location.search);
            const modelParam = params.get('model') || params.get('sim');
            if (modelParam && categories[0]?.models) {
                const found = categories[0].models.find(
                    m => m.name.toLowerCase() === modelParam.toLowerCase()
                );
                if (found) {
                    setVisualizerModelName(found.name);
                    return;
                }
            }
            setVisualizerModelName(null);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [categories]);

    // Filter models based on search

    // Badges that qualify as "recommended"
    const RECOMMENDED_BADGES = ['FLAGSHIP', 'POPULAR', 'LEGENDARY', 'COMMUNITY CHOICE'];

    const handleToggleFilter = (filterId: string) => {
        setActiveFilters(prev =>
            prev.includes(filterId)
                ? prev.filter(f => f !== filterId)
                : [...prev, filterId]
        );
    };

    const baseModels = searchQuery
        ? categories[0].models // search across 'All Models'
        : categories.find(c => c.id === activeCategory)?.models || [];

    // Fuzzy search using Fuse.js for models (searches name, consensus, tags)
    const modelsToDisplay = useMemo(() => {
        let result = baseModels;

        // Apply recommended filter
        if (activeFilters.includes('recommended')) {
            result = result.filter(m => m.badge && RECOMMENDED_BADGES.includes(m.badge));
        }

        if (!searchQuery || searchQuery.trim().length === 0) return result;

        const fuse = new Fuse(result, {
            keys: ['name', 'consensus', 'tags'],
            threshold: 0.3,
            includeScore: true,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });

        return fuse.search(searchQuery).map(r => r.item);
    }, [baseModels, searchQuery, activeFilters]);

    const activeModels = useMemo(() => {
        const sorted = [...modelsToDisplay].sort((a, b) => {
            let diff = 0;
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();

            switch (sortBy) {
                case 'name-asc':
                    diff = a.name.localeCompare(b.name);
                    break;
                case 'name-desc':
                    diff = b.name.localeCompare(a.name);
                    break;
                case 'score-asc':
                    diff = (a.communityScore || 0) - (b.communityScore || 0);
                    break;
                case 'score-desc':
                    diff = (b.communityScore || 0) - (a.communityScore || 0);
                    break;
                case 'date-asc': // Oldest first
                    diff = dateA - dateB;
                    break;
                case 'date-desc': // Newest first
                    diff = dateB - dateA;
                    break;
                default: diff = 0;
            }
            return diff;
        });
        return sorted;
    }, [modelsToDisplay, sortBy]);

    const handleSort = (key: 'name' | 'score' | 'date') => {
        // Toggle logic for table headers
        if (key === 'name') {
            setSortBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc');
        } else if (key === 'score') {
            setSortBy(prev => prev === 'score-desc' ? 'score-asc' : 'score-desc');
        } else if (key === 'date') {
            setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc');
        }
    };

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
    // While the user has an expanded section open (Vibe Guide or Categories),
    // don't collapse/pin the mobile filters wrapper — collapsing mid-scroll
    // shrinks the page and snaps the viewport down into "All Models",
    // making the guide unreadable on iOS.
    const stickyCollapseActive = effectiveIsSticky && !showVibeGuide && !showMobileCategories;

    return (
        <div className="lg:flex lg:gap-8">
            {/* Mobile Category Sidebar */}
            <MobileCategorySidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                categories={categories}
                mode="models"
                activeCategory={activeCategory}
                activeCategories={activeFilters}
                onToggleCategory={handleToggleFilter}
                onSelectCategory={(id) => {
                    setActiveCategory(id);
                    setSearchQuery('');
                }}
                searchQuery={searchQuery}
            />
            <CategorySidebarButton
                onClick={() => setSidebarOpen(!sidebarOpen)}
                isSticky={effectiveIsSticky}
                isSidebarOpen={sidebarOpen}
            />

            {/* Sidebar - Desktop Only */}
            <aside className="hidden lg:block lg:w-72 lg:shrink-0">
                {/* Sentinel: detects when sidebar becomes sticky */}
                <div ref={sidebarSentinelRef} className="h-0" />
                <div className="sticky top-8 space-y-6">
                    {/* Inline GlobalControls — visible when sidebar is sticky */}
                    <SidebarInlineControls visible={isSidebarSticky} />
                    {/* Search */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <SearchFilter
                            value={searchQuery}
                            onChange={setSearchQuery}
                            resultCount={activeModels.length}
                            totalCount={categories[0].models.length} // All models count
                            itemLabel="models"
                        />
                    </div>

                    {/* Vibe Guide Toggle */}
                    <button
                        onClick={() => setShowVibeGuide(!showVibeGuide)}
                        className={`
                            w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all
                            ${showVibeGuide
                                ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border-cyan-500/30 text-slate-100'
                                : 'bg-slate-800/30 border-slate-700/50 text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                            }
                        `}
                    >
                        <span className="font-medium text-sm">📖 {t('models.vibeGuide')}</span>
                        <svg className={`w-4 h-4 transition-transform ${showVibeGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Categories */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">{t('filter.categories')}</h2>
                        <div className="space-y-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setActiveCategory(cat.id);
                                        setSearchQuery('');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left
                                        transition-all duration-200 border
                                        ${activeCategory === cat.id && !searchQuery
                                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                            : 'bg-slate-700/30 text-slate-400 border-transparent hover:bg-slate-700/50 hover:text-slate-100'
                                        }
                                    `}
                                >
                                    <span className="shrink-0 text-lg">{cat.icon}</span>
                                    <span className="flex-1 break-words">{cat.name}</span>
                                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs ${activeCategory === cat.id && !searchQuery ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                                        {cat.models.length}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
                {/* Sentinel: marks the search bar's natural position */}
                <div ref={sentinelRef} className="lg:hidden h-0" />

                {/* Mobile Filters - Sticky only after scrolling past natural position */}
                <div className="lg:hidden -mx-4 px-4 pt-2 pb-4 space-y-4 mb-6 transition-all duration-300 sticky top-16 sm:top-24 z-20">
                    <SearchFilter
                        value={searchQuery}
                        onChange={setSearchQuery}
                        resultCount={activeModels.length}
                        totalCount={categories[0].models.length}
                        itemLabel="models"
                    />

                    <div className={`transition-all duration-300 overflow-hidden ${stickyCollapseActive ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="space-y-4 pt-2">
                            <button
                                onClick={() => setShowVibeGuide(!showVibeGuide)}
                                className="flex items-center justify-between w-full text-left"
                            >
                                <span className="text-sm text-slate-500 uppercase tracking-wider font-medium">{t('models.vibeGuide')}</span>
                                <svg
                                    className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${showVibeGuide ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <div
                                style={{ height: showVibeGuide ? vibeGuideHeight : 0 }}
                                className={`overflow-hidden transition-[height,opacity] duration-300 ease-in-out ${showVibeGuide ? 'opacity-100 mt-2 pb-4' : 'opacity-0 mt-0'}`}
                            >
                                <div ref={vibeGuideRef} className="grid gap-2">
                                    {Object.entries(vibeGuide).map(([key, guide]) => (
                                        <div key={key} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                            <h4 className="text-slate-100 font-semibold text-xs mb-1">{guide.title}</h4>
                                            <p className="text-[10px] text-slate-500 mb-1">{guide.includes}</p>
                                            <p className="text-[10px] text-slate-400 mb-1">{guide.vibe}</p>
                                            <p className="text-[10px] text-emerald-400">
                                                <span className="font-medium">Best:</span> {guide.bestFor}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => setShowMobileCategories(!showMobileCategories)}
                                    className="flex items-center justify-between w-full text-left"
                                >
                                    <span className="text-sm text-slate-500 uppercase tracking-wider font-medium">{t('filter.categories')}</span>
                                    <svg
                                        className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${showMobileCategories ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                <div className={`flex flex-wrap gap-2 transition-all duration-300 overflow-hidden ${showMobileCategories ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                setActiveCategory(cat.id);
                                                setSearchQuery('');
                                            }}
                                            className={`
                                                max-w-full flex items-center justify-between shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all text-left border
                                                ${activeCategory === cat.id && !searchQuery
                                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                                                }
                                            `}
                                        >
                                            <span className="shrink-0 mr-2">{cat.icon}</span>
                                            <span className="flex-1 break-words">{cat.name}</span>
                                            <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded-md text-xs ${activeCategory === cat.id && !searchQuery ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                                                {cat.models.length}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Header with Sort */}
                <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-100 mb-2 flex items-center gap-3">
                            {searchQuery ? (
                                <><span>🔍</span> {t('models.title')}</>
                            ) : (
                                <>
                                    <span>{categories.find(c => c.id === activeCategory)?.icon || '📚'}</span>
                                    {categories.find(c => c.id === activeCategory)?.name || 'All Models'}
                                </>
                            )}
                        </h2>
                        <p className="text-slate-400 text-sm">
                            {searchQuery
                                ? `Found ${activeModels.length} models matching "${searchQuery}"`
                                : categories.find(c => c.id === activeCategory)?.description
                            }
                        </p>
                    </div>

                    {/* Sort Dropdown & View Toggle */}
                    <div className="flex flex-wrap items-center gap-4">
                        <ViewToggle viewMode={viewMode} onChange={setViewMode} id="models-view" />

                        <div className="relative group flex items-center bg-slate-800/50 border border-slate-700/50 rounded-xl focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all hover:bg-slate-800 cursor-pointer">
                            <div className="pl-3 flex items-center pointer-events-none whitespace-nowrap">
                                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">
                                    {t('settings.sort') || 'Sort:'}
                                </span>
                            </div>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="
                                    appearance-none outline-none bg-transparent w-full
                                    pl-2 pr-10 py-2.5 text-sm font-medium text-slate-100
                                    cursor-pointer
                                "
                            >
                                <option value="date-desc">{t('settings.sortDateNewest')}</option>
                                <option value="date-asc">{t('settings.sortDateOldest')}</option>
                                <option value="name-asc">{t('settings.sortNameAZ')}</option>
                                <option value="name-desc">{t('settings.sortNameZA')}</option>
                                <option value="score-desc">{t('settings.sortScoreHighLow')}</option>
                                <option value="score-asc">{t('settings.sortScoreLowHigh')}</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vibe Guide Content (Shows above grid if active) */}
                {showVibeGuide && (
                    <div className="hidden lg:grid mb-8 gap-3 md:grid-cols-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        {Object.entries(vibeGuide).map(([key, guide]) => (
                            <div key={key} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                <h4 className="text-slate-100 font-semibold text-sm mb-1">{guide.title}</h4>
                                <p className="text-xs text-slate-500 mb-2">{guide.includes}</p>
                                <p className="text-xs text-slate-400 mb-2">{guide.vibe}</p>
                                <p className="text-xs text-emerald-400">
                                    <span className="font-medium">Best for:</span> {guide.bestFor}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Model Grid / List */}
                <div>
                {activeModels.length > 0 ? (
                    <AnimatePresence mode="wait">
                        {viewMode === 'list' ? (
                            <motion.div
                                key="list-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden"
                            >
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800/80 text-slate-400 text-sm uppercase tracking-wider">
                                                <th className="p-3 md:p-4 font-medium cursor-pointer hover:text-slate-100" onClick={() => handleSort('name')}>Name</th>
                                                <th className="p-3 md:p-4 font-medium cursor-pointer hover:text-slate-100 whitespace-nowrap" onClick={() => handleSort('date')}>Date</th>
                                                <th className="p-3 md:p-4 font-medium cursor-pointer hover:text-slate-100 whitespace-nowrap" onClick={() => handleSort('score')}>Score</th>
                                                <th className="hidden md:table-cell p-4 font-medium">Badges</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {activeModels.map((model) => (
                                                <motion.tr
                                                    key={model.name}
                                                    onClick={() => handleOpenVisualizer(model.name)}
                                                    className="group hover:bg-slate-800/50 cursor-pointer transition-colors"
                                                >
                                                    <td className="p-3 md:p-4 font-medium text-slate-100">
                                                        <div className="flex items-center gap-2 md:gap-3">
                                                            <span className="text-lg md:text-2xl">{getVibeIcon(model.consensus)}</span>
                                                            <span className="text-sm md:text-base">{model.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 md:p-4 text-slate-400 text-xs md:text-sm whitespace-nowrap">{model.date}</td>
                                                    <td className="p-3 md:p-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-cyan-400 font-bold text-sm">{model.communityScore}</span>
                                                            <div className="hidden sm:block w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                                <div className="h-full bg-cyan-500" style={{ width: `${(model.communityScore || 0) * 10}%` }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="hidden md:table-cell p-4">
                                                        {model.badge && (
                                                            <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                                {model.badge}
                                                            </span>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="grid-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2"
                            >
                                {activeModels.map((model) => {
                                    const topicId = model.forumUrl ? extractTopicId(model.forumUrl) : null;
                                    const activity = topicId && forumActivity ? forumActivity[topicId] : undefined;
                                    return (
                                        <div key={model.name} className="h-full">
                                            <LazyModelCard>
                                                <ModelCard model={model} onExpand={handleOpenVisualizer} forumActivity={activity} />
                                            </LazyModelCard>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                ) : (
                    <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                        <span className="text-4xl mb-4 block">🔍</span>
                        <h3 className="text-xl font-medium text-slate-100 mb-2">No models found</h3>
                        <p className="text-slate-400">Try adjusting your search terms</p>
                    </div>
                )}
                </div>

            </div>

            <FullScreenDriveVisualizer
                isOpen={visualizerModelName !== null}
                onClose={handleCloseVisualizer}
                models={categories[0].models}
                initialModelName={visualizerModelName ?? undefined}
            />
        </div>
    );
}

