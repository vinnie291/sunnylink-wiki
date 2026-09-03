'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ModelSurveyAnswers, ModelVoteSummary, QuestionSummary } from '@/lib/modelVotes';
import { useLanguage } from '@/lib/i18n';

interface OptionItem {
    key: string;
    labelKey: string;
}

interface QuestionDef {
    id: keyof ModelSurveyAnswers;
    titleKey: string;
    titleFallback: string;
    type: 'single' | 'multi';
    maxChoices?: number;
    options: OptionItem[];
    hintKey?: string;
    hintFallback?: string;
    skipCondition?: (answers: ModelSurveyAnswers) => boolean;
}

const QUESTIONS: QuestionDef[] = [
    {
        id: 'hasDriven',
        titleKey: 'models.poll.q1.title',
        titleFallback: 'Have you driven this model?',
        type: 'single',
        options: [
            { key: "Yes, I've driven it", labelKey: 'models.poll.q1.opt1' },
            { key: 'Not yet, just viewing', labelKey: 'models.poll.q1.opt2' }
        ],
        hintKey: 'models.poll.q1.hint',
        hintFallback: 'Verified feedback from real-world drivers',
    },
    {
        id: 'hardware',
        titleKey: 'models.poll.q2.title',
        titleFallback: 'Hardware / Device used:',
        type: 'single',
        options: [
            { key: 'comma 3 (C3)', labelKey: 'models.poll.q2.opt1' },
            { key: 'comma 3X (C3X)', labelKey: 'models.poll.q2.opt2' },
            { key: 'comma 4 (C4)', labelKey: 'models.poll.q2.opt3' },
            { key: 'Other / Desktop', labelKey: 'models.poll.q2.opt4' }
        ],
        hintKey: 'models.poll.q2.hint',
        hintFallback: 'Vehicle & comma hardware configuration',
    },
    {
        id: 'rating',
        titleKey: 'models.poll.q3.title',
        titleFallback: 'How is this model?',
        type: 'single',
        options: [
            { key: '5 - Great', labelKey: 'models.poll.q3.opt5' },
            { key: '4 - Good', labelKey: 'models.poll.q3.opt4' },
            { key: '3 - Ok', labelKey: 'models.poll.q3.opt3' },
            { key: '2 - Bad', labelKey: 'models.poll.q3.opt2' },
            { key: '1 - Poor', labelKey: 'models.poll.q3.opt1' }
        ],
        hintKey: 'models.poll.q3.hint',
        hintFallback: 'Overall driver rating (affects community score)',
    },
    {
        id: 'lateral',
        titleKey: 'models.poll.q4.title',
        titleFallback: 'Lateral (steering):',
        type: 'multi',
        maxChoices: 5,
        options: [
            { key: 'Smooth and steady', labelKey: 'models.poll.q4.opt1' },
            { key: 'Felt natural and humanlike', labelKey: 'models.poll.q4.opt2' },
            { key: 'Lane hugging to one side', labelKey: 'models.poll.q4.opt3' },
            { key: 'Ping-pong, wanders, or oscillates', labelKey: 'models.poll.q4.opt4' },
            { key: 'Understeers or gives up mid-turn', labelKey: 'models.poll.q4.opt5' },
            { key: 'Cuts corners or over-steers', labelKey: 'models.poll.q4.opt6' },
            { key: 'Drifts toward exits and lane splits', labelKey: 'models.poll.q4.opt7' }
        ],
        hintKey: 'models.poll.q4.hint',
        hintFallback: 'Choose up to 5 options',
    },
    {
        id: 'longitudinalMode',
        titleKey: 'models.poll.q5.title',
        titleFallback: 'Longitudinal used:',
        type: 'single',
        options: [
            { key: 'Experimental Mode', labelKey: 'models.poll.q5.opt1' },
            { key: 'Chill mode', labelKey: 'models.poll.q5.opt2' },
            { key: 'Stock ACC only', labelKey: 'models.poll.q5.opt3' }
        ],
        hintKey: 'models.poll.q5.hint',
        hintFallback: 'Speed control and braking mode',
    },
    {
        id: 'longitudinalBehaviors',
        titleKey: 'models.poll.q6.title',
        titleFallback: 'Longitudinal (acceleration and braking), skip if stock ACC:',
        type: 'multi',
        maxChoices: 5,
        options: [
            { key: 'Smooth acceleration and braking', labelKey: 'models.poll.q6.opt1' },
            { key: 'Jerky acceleration', labelKey: 'models.poll.q6.opt2' },
            { key: 'Hard or late braking', labelKey: 'models.poll.q6.opt3' },
            { key: 'Overshoots the stop line or rolls through', labelKey: 'models.poll.q6.opt4' },
            { key: 'Does not hold the set speed', labelKey: 'models.poll.q6.opt5' },
            { key: 'Bad in stop and go traffic', labelKey: 'models.poll.q6.opt6' }
        ],
        hintKey: 'models.poll.q6.hint',
        hintFallback: 'Skip if using stock car radar ACC',
        skipCondition: (answers) => answers.longitudinalMode === 'Stock ACC only',
    },
    {
        id: 'steeringControl',
        titleKey: 'models.poll.q7.title',
        titleFallback: 'Steering control:',
        type: 'single',
        options: [
            { key: '1 - Torque based', labelKey: 'models.poll.q7.opt1' },
            { key: '2 - Angle based', labelKey: 'models.poll.q7.opt2' },
            { key: '3 - Pure PID', labelKey: 'models.poll.q7.opt3' },
            { key: '4 - Not sure', labelKey: 'models.poll.q7.opt4' }
        ],
        hintKey: 'models.poll.q7.hint',
        hintFallback: 'Steering actuator controller configuration',
    },
];

interface ModelPollSurveyProps {
    modelName: string;
    baseScore?: number;
    baseVotes?: number;
    baseSentiment?: { great: number; good: number; ok: number; bad: number };
    initialVoteSummary?: ModelVoteSummary;
    onScoreUpdate?: (liveData: {
        communityScore: number;
        totalVotes: number;
        sentiment: { great: number; good: number; ok: number; bad: number };
    }) => void;
}

export default function ModelPollSurvey({
    modelName,
    baseScore,
    baseVotes,
    baseSentiment,
    initialVoteSummary,
    onScoreUpdate,
}: ModelPollSurveyProps) {
    const { t } = useLanguage();
    const [currentStep, setCurrentStep] = useState(0);
    const [viewMode, setViewMode] = useState<'vote' | 'results'>('vote');
    const [userAnswers, setUserAnswers] = useState<ModelSurveyAnswers>({});
    const [summary, setSummary] = useState<ModelVoteSummary | null>(initialVoteSummary || null);
    const [loading, setLoading] = useState(false);
    const [justVoted, setJustVoted] = useState(false);

    // Fetch live summary & user vote on mount
    useEffect(() => {
        let mounted = true;
        const fetchSummary = async () => {
            try {
                const res = await fetch(`/api/models/vote?model=${encodeURIComponent(modelName)}`);
                if (!res.ok) return;
                const json = await res.json();
                if (mounted && json.success && json.data?.stats) {
                    setSummary(json.data.stats);
                    if (json.data.userVote) {
                        setUserAnswers(json.data.userVote);
                    }
                    if (json.data.stats.live && onScoreUpdate) {
                        onScoreUpdate(json.data.stats.live);
                    }
                }
            } catch (err) {
                console.error('Failed to load model vote stats:', err);
            }
        };

        fetchSummary();
        return () => {
            mounted = false;
        };
    }, [modelName, onScoreUpdate]);

    const q = QUESTIONS[currentStep] || QUESTIONS[0];

    // Compute active voter count for current question
    const activeQuestionStats: QuestionSummary | undefined = useMemo(() => {
        if (!summary?.questions) return undefined;
        const qId = q.id;
        return (summary.questions as Record<string, QuestionSummary>)[qId];
    }, [summary, q.id]);

    const voterCount = activeQuestionStats?.voters ?? summary?.totalVoters ?? 0;

    // Check if question answered
    const isQuestionAnswered = useCallback(
        (stepIndex: number): boolean => {
            const def = QUESTIONS[stepIndex];
            if (!def) return false;
            const val = userAnswers[def.id];
            if (val === undefined || val === null) return false;
            if (Array.isArray(val)) return val.length > 0;
            return true;
        },
        [userAnswers]
    );

    // Save vote to backend & trigger live score update
    const persistAnswers = async (updated: ModelSurveyAnswers) => {
        setLoading(true);
        try {
            const res = await fetch('/api/models/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelName,
                    answers: updated,
                }),
            });

            if (res.ok) {
                const json = await res.json();
                if (json.success && json.stats) {
                    setSummary(json.stats);
                    setJustVoted(true);
                    setTimeout(() => setJustVoted(false), 2000);
                    if (json.stats.live && onScoreUpdate) {
                        onScoreUpdate(json.stats.live);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to save vote:', err);
        } finally {
            setLoading(false);
        }
    };

    // Handle single-choice selection
    const handleSelectSingle = async (optionKey: string) => {
        const qId = q.id;
        let val: any = optionKey;

        if (qId === 'hasDriven') {
            const driven = optionKey.startsWith('Yes');
            val = driven;
            const updated = { ...userAnswers, hasDriven: driven };
            setUserAnswers(updated);
            persistAnswers(updated);

            if (!driven) {
                // Not yet driven -> immediately reveal results so they can learn from other drivers
                setViewMode('results');
                return;
            }
            // Auto advance
            setTimeout(() => {
                goToNextStep();
            }, 300);
            return;
        }

        if (qId === 'rating') {
            // "5 - Great" -> 5
            const num = parseInt(optionKey.charAt(0), 10);
            val = Number.isFinite(num) ? num : optionKey;
        }

        const updated = { ...userAnswers, [qId]: val };
        setUserAnswers(updated);
        persistAnswers(updated);

        // Advance to next step smoothly
        setTimeout(() => {
            goToNextStep();
        }, 300);
    };

    // Handle multi-choice toggle
    const handleToggleMulti = (optionKey: string) => {
        const qId = q.id;
        const currentList: string[] = Array.isArray(userAnswers[qId])
            ? ([...(userAnswers[qId] as string[])])
            : [];

        let nextList: string[];
        if (currentList.includes(optionKey)) {
            nextList = currentList.filter((item) => item !== optionKey);
        } else {
            if (currentList.length >= (q.maxChoices || 5)) {
                return; // Max choices reached
            }
            nextList = [...currentList, optionKey];
        }

        const updated = { ...userAnswers, [qId]: nextList };
        setUserAnswers(updated);
    };

    const handleConfirmMulti = () => {
        persistAnswers(userAnswers);
        goToNextStep();
    };

    const goToNextStep = () => {
        if (currentStep < QUESTIONS.length - 1) {
            const nextIdx = currentStep + 1;
            const nextQ = QUESTIONS[nextIdx];
            if (nextQ?.skipCondition && nextQ.skipCondition(userAnswers)) {
                // Auto-skip
                if (nextIdx < QUESTIONS.length - 1) {
                    setCurrentStep(nextIdx + 1);
                } else {
                    setViewMode('results');
                }
            } else {
                setCurrentStep(nextIdx);
            }
        } else {
            // Reached the end! Show results summary
            setViewMode('results');
        }
    };

    const handleSkip = () => {
        goToNextStep();
    };

    // Check if an option is currently selected by the user
    const isOptionSelected = (optKey: string): boolean => {
        const qId = q.id;
        const val = userAnswers[qId];
        if (qId === 'hasDriven') {
            if (optKey.startsWith('Yes') && val === true) return true;
            if (optKey.startsWith('Not yet') && val === false) return true;
            return false;
        }
        if (qId === 'rating') {
            const num = parseInt(optKey.charAt(0), 10);
            return val === num;
        }
        if (Array.isArray(val)) {
            return val.includes(optKey);
        }
        return val === optKey;
    };

    return (
        <div
            className="my-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 p-3.5 sm:p-4 text-slate-200 shadow-md backdrop-blur-md transition-all duration-300 relative group"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header pill / badge */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/70">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 uppercase tracking-wider bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        {t('models.poll.badge') || 'Community Poll'}
                    </span>
                    {justVoted && (
                        <span className="text-[10px] text-emerald-400 font-medium animate-fade-in flex items-center gap-1">
                            <span>✓</span> {t('models.poll.voteRecorded') || 'Vote recorded live!'}
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                    {currentStep + 1} / {QUESTIONS.length}
                </span>
            </div>

            {/* Split layout matching screenshots */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                {/* Left Column: Questions / Options or Results */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-100 mb-2 leading-snug">
                        {t(q.titleKey) || q.titleFallback}
                    </h4>

                    {viewMode === 'vote' ? (
                        <div className="space-y-1.5 min-h-[140px] flex flex-col justify-center">
                            {q.options.map((opt) => {
                                const selected = isOptionSelected(opt.key);
                                const label = t(opt.labelKey) || opt.key;
                                if (q.type === 'single') {
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => handleSelectSingle(opt.key)}
                                            className={`w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-left text-xs sm:text-sm transition-all group/opt ${
                                                selected
                                                    ? 'bg-cyan-950/40 text-cyan-300 font-medium border border-cyan-500/40 shadow-sm'
                                                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                                            }`}
                                        >
                                            <span
                                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                                    selected
                                                        ? 'border-cyan-400 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]'
                                                        : 'border-slate-500 group-hover/opt:border-slate-300'
                                                }`}
                                            >
                                                {selected && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                                                )}
                                            </span>
                                            <span className="truncate">{label}</span>
                                        </button>
                                    );
                                } else {
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => handleToggleMulti(opt.key)}
                                            className={`w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-left text-xs sm:text-sm transition-all group/opt ${
                                                selected
                                                    ? 'bg-cyan-950/40 text-cyan-300 font-medium border border-cyan-500/40 shadow-sm'
                                                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                                            }`}
                                        >
                                            <span
                                                className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-all ${
                                                    selected
                                                        ? 'border-cyan-400 bg-cyan-400 text-slate-950 shadow-[0_0_6px_rgba(34,211,238,0.5)]'
                                                        : 'border-slate-500 group-hover/opt:border-slate-300'
                                                }`}
                                            >
                                                {selected && (
                                                    <svg
                                                        className="w-3 h-3 stroke-[3]"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                                )}
                                            </span>
                                            <span className="truncate">{label}</span>
                                        </button>
                                    );
                                }
                            })}
                        </div>
                    ) : (
                        /* Results View */
                        <div className="space-y-2 min-h-[140px] flex flex-col justify-center">
                            {q.options.map((opt) => {
                                const statKey = q.id === 'rating' ? opt.key.charAt(0) : (q.id === 'hasDriven' ? (opt.key.startsWith('Yes') ? 'yes' : 'no') : opt.key);
                                const stat = activeQuestionStats?.options[statKey] || { count: 0, percentage: 0 };
                                const userChose = isOptionSelected(opt.key);
                                const label = t(opt.labelKey) || opt.key;

                                return (
                                    <div
                                        key={opt.key}
                                        className={`relative rounded-lg overflow-hidden border py-1.5 px-2.5 text-xs transition-colors ${
                                            userChose
                                                ? 'bg-slate-850 border-cyan-500/40 text-cyan-200'
                                                : 'bg-slate-900/60 border-slate-800 text-slate-300'
                                        }`}
                                    >
                                        {/* Filled bar */}
                                        <div
                                            className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-l ${
                                                userChose
                                                    ? 'bg-cyan-500/25 border-r-2 border-cyan-400'
                                                    : 'bg-slate-700/30 border-r-2 border-slate-600/50'
                                            }`}
                                            style={{ width: `${stat.percentage}%` }}
                                        />

                                        <div className="relative flex items-center justify-between gap-2 z-10">
                                            <span className="truncate font-medium flex items-center gap-1.5">
                                                {userChose && (
                                                    <span className="text-cyan-400 font-bold" title={t('models.poll.yourVote') || 'Your vote'}>✓</span>
                                                )}
                                                {label}
                                            </span>
                                            <span className="shrink-0 font-mono text-[11px] text-slate-400">
                                                <strong className="text-slate-200">{stat.percentage}%</strong>{' '}
                                                <span className="text-[10px] text-slate-500">({stat.count})</span>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right Panel matching Discourse forum layout */}
                <div className="border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-3.5 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start min-w-[110px] md:w-[125px] shrink-0 text-left">
                    <div className="flex flex-col">
                        <span className="text-2xl md:text-3xl font-bold text-slate-100 font-mono tracking-tight leading-none">
                            {voterCount}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-1">
                            {t('models.poll.voters') || 'VOTERS'}
                        </span>
                    </div>

                    <div className="hidden md:block w-full h-px bg-slate-800/80 my-2.5" />

                    <div className="flex flex-col gap-1.5 text-[10px] text-slate-400 leading-snug">
                        <div className="flex items-center gap-1.5" title={t('models.poll.optionsCanChange') || 'Options can be added or removed.'}>
                            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="hidden sm:inline">{t('models.poll.optionsCanChange') || 'Options can be added or removed.'}</span>
                        </div>

                        {q.type === 'multi' && (
                            <div className="flex items-center gap-1.5 text-cyan-400/90 font-medium" title={t('models.poll.chooseUpTo', { count: q.maxChoices || 5 })}>
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span>{t('models.poll.chooseUpTo', { count: q.maxChoices || 5 })}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1.5" title={`${t('models.poll.votesAre') || 'Votes are'} ${t('models.poll.public') || 'public'}.`}>
                            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>{t('models.poll.votesAre') || 'Votes are'} <strong className="text-slate-300 font-semibold">{t('models.poll.public') || 'public'}</strong>.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Actions Bar matching Discourse buttons */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    {viewMode === 'vote' ? (
                        <>
                            {q.type === 'multi' && (
                                <button
                                    type="button"
                                    onClick={handleConfirmMulti}
                                    disabled={loading}
                                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {t('models.poll.voteNow') || 'Vote now!'}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setViewMode('results')}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 hover:bg-slate-800/80 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                {t('models.poll.results') || 'Results'}
                            </button>

                            <button
                                type="button"
                                onClick={handleSkip}
                                className="px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-300 text-xs transition-colors"
                                title={t('models.poll.skipTitle') || 'Skip to next question'}
                            >
                                {t('models.poll.skip') || 'Skip →'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setViewMode('vote')}
                            className="px-2.5 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-950/60 text-cyan-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            {isQuestionAnswered(currentStep) ? (t('models.poll.editVote') || 'Edit Vote') : (t('models.poll.vote') || 'Vote')}
                        </button>
                    )}
                </div>

                {/* Dots Progress Stepper */}
                <div className="flex items-center gap-1.5" aria-label={t('models.poll.progressAria') || 'Survey progress'}>
                    {QUESTIONS.map((item, idx) => {
                        const isCurrent = currentStep === idx;
                        const answered = isQuestionAnswered(idx);
                        const stepTitle = `${t('models.poll.step', { step: idx + 1 })}: ${t(item.titleKey) || item.titleFallback} ${answered ? `(${t('models.poll.answered') || 'Answered'})` : ''}`;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setCurrentStep(idx);
                                }}
                                title={stepTitle}
                                className={`h-2 rounded-full transition-all duration-300 ${
                                    isCurrent
                                        ? 'w-5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]'
                                        : answered
                                        ? 'w-2 bg-emerald-400/90 hover:bg-emerald-300'
                                        : 'w-2 bg-slate-700 hover:bg-slate-500'
                                }`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
