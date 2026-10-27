'use client';

import { useCallback, useMemo, useState } from 'react';
import TranslatedText from '@/components/TranslatedText';
import { useTextTranslation } from '@/lib/i18n';
import type { ModelVoteSummary } from '@/lib/modelVotes';
import type { SkillRatings } from '@/lib/skillRatings';
import {
    DOMAIN_INFO,
    DOMAIN_KEYS,
    HARDWARE_LABELS,
    HARDWARE_TIERS,
    LATERAL_CONTROLLERS,
    LONGITUDINAL_MODES,
    LONGITUDINAL_MODE_LABELS,
    STACK_ANSWER_KEYS,
    blendDomainRating,
    deriveDomainPriors,
    type DomainKey,
} from '@/lib/controlStack';

interface Props {
    modelName: string;
    skills: SkillRatings;
    summary?: ModelVoteSummary;
    onSummaryUpdate?: (summary: ModelVoteSummary) => void;
    /** Compact = bars only (model cards). Full adds the reviewer form. */
    variant?: 'compact' | 'full';
}

function StarBar({ label, hint, value, caption, gradient, compact }: {
    label: string; hint: string; value: number; caption: string; gradient: string; compact?: boolean;
}) {
    const tx = useTextTranslation();
    return (
        <div className="space-y-1" title={tx(`${hint} ${caption}`)}>
            <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="truncate font-medium text-slate-300"><TranslatedText text={label} /></span>
                <span className="shrink-0 rounded border border-slate-700/30 bg-slate-800/60 px-1 py-0.5 font-mono font-bold text-slate-200">
                    {value.toFixed(1)}<span aria-hidden="true" className="text-yellow-400"> ★</span>
                </span>
            </div>
            <div
                role="meter"
                aria-label={tx(label)}
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={Number(value.toFixed(1))}
                className={`w-full overflow-hidden rounded-full border border-slate-800/40 bg-slate-950/60 ${compact ? 'h-1.5' : 'h-2'}`}
            >
                <div style={{ width: `${((value - 1) / 4) * 100}%` }} className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${gradient}`} />
            </div>
            {!compact && <div className="text-[10px] text-slate-500"><TranslatedText text={caption} /></div>}
        </div>
    );
}

function StarInput({ value, onChange, label }: { value?: number; onChange: (n: number) => void; label: string }) {
    const tx = useTextTranslation();
    return (
        <div role="radiogroup" aria-label={tx(label)} className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={value === n}
                    aria-label={tx(`${n} of 5`)}
                    onClick={() => onChange(n)}
                    className={`h-6 w-6 rounded text-sm leading-none transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 ${
                        value !== undefined && n <= value ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-200'
                    }`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

const selectClass = 'w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 focus-visible:outline-2 focus-visible:outline-cyan-300';

/**
 * Splits the overall model rating into three control domains so a great
 * lateral model is not marked down for a reviewer's radar-long complaints.
 * Until reviewers rate a domain the bar shows a prior derived from the
 * existing skill bars; reviewer ratings then take over by sample size.
 */
export default function ModelDomainRatings({ modelName, skills, summary, onSummaryUpdate, variant = 'full' }: Props) {
    const tx = useTextTranslation();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [open, setOpen] = useState(false);
    const compact = variant === 'compact';

    const priors = useMemo(() => deriveDomainPriors(skills), [skills]);
    const userVote = (summary?.userVote ?? {}) as Record<string, unknown>;

    const submit = useCallback(async (answers: Record<string, unknown>) => {
        setSaving(true);
        setError(false);
        try {
            const res = await fetch('/api/models/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelName, answers }),
            });
            const json = res.ok ? await res.json() : null;
            if (json?.success && json.stats) onSummaryUpdate?.(json.stats);
            else setError(true);
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    }, [modelName, onSummaryUpdate]);

    const selectValue = (key: string) => (typeof userVote[key] === 'string' ? (userVote[key] as string) : '');

    return (
        <div className={`rounded-xl border border-slate-800/40 bg-slate-950/20 ${compact ? 'p-3 my-3.5' : 'p-3.5'}`} onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <TranslatedText text="Ratings by control domain" />
                </span>
                <span className="text-[10px] font-mono text-slate-500">1–5</span>
            </div>
            <div className={compact ? 'space-y-2' : 'space-y-3'}>
                {DOMAIN_KEYS.map((key: DomainKey) => {
                    const stat = summary?.domains?.[key] ?? { count: 0, average: null };
                    const value = blendDomainRating(priors[key], stat);
                    const caption = stat.count > 0
                        ? `${stat.count} reviewer ${stat.count === 1 ? 'rating' : 'ratings'}, blended with the derived estimate.`
                        : 'Derived estimate from feedback — no reviewer ratings yet.';
                    return (
                        <StarBar
                            key={key}
                            label={DOMAIN_INFO[key].label}
                            hint={DOMAIN_INFO[key].hint}
                            value={value}
                            caption={caption}
                            gradient={DOMAIN_INFO[key].bar}
                            compact={compact}
                        />
                    );
                })}
            </div>

            {!compact && (
                <div className="mt-3 border-t border-slate-800/60 pt-2.5">
                    <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpen(o => !o)}
                        className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300"
                    >
                        {open ? '− ' : '+ '}<TranslatedText text="Rate this model by domain & tag your setup" />
                    </button>
                    {open && (
                        <div className="mt-3 space-y-3">
                            <div className="space-y-2">
                                {DOMAIN_KEYS.map(key => (
                                    <div key={key} className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-slate-300"><TranslatedText text={DOMAIN_INFO[key].label} /></span>
                                        <StarInput
                                            label={DOMAIN_INFO[key].label}
                                            value={Number(userVote[DOMAIN_INFO[key].answerKey]) || undefined}
                                            onChange={n => submit({ [DOMAIN_INFO[key].answerKey]: n })}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <label className="space-y-1 text-[10px] text-slate-400">
                                    <span><TranslatedText text="Lateral controller" /></span>
                                    <select className={selectClass} value={selectValue(STACK_ANSWER_KEYS.lateral)} onChange={e => e.target.value && submit({ [STACK_ANSWER_KEYS.lateral]: e.target.value })}>
                                        <option value="">{tx('Select…')}</option>
                                        {LATERAL_CONTROLLERS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1 text-[10px] text-slate-400">
                                    <span><TranslatedText text="Longitudinal mode" /></span>
                                    <select className={selectClass} value={selectValue(STACK_ANSWER_KEYS.longitudinal)} onChange={e => e.target.value && submit({ [STACK_ANSWER_KEYS.longitudinal]: e.target.value })}>
                                        <option value="">{tx('Select…')}</option>
                                        {LONGITUDINAL_MODES.map(c => <option key={c} value={c}>{tx(LONGITUDINAL_MODE_LABELS[c])}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1 text-[10px] text-slate-400">
                                    <span><TranslatedText text="Hardware" /></span>
                                    <select className={selectClass} value={selectValue(STACK_ANSWER_KEYS.hardware)} onChange={e => e.target.value && submit({ [STACK_ANSWER_KEYS.hardware]: e.target.value })}>
                                        <option value="">{tx('Select…')}</option>
                                        {HARDWARE_TIERS.map(c => <option key={c} value={c}>{HARDWARE_LABELS[c]}</option>)}
                                    </select>
                                </label>
                            </div>
                            <p className="text-[10px] leading-snug text-slate-500" role="status" aria-live="polite">
                                {error
                                    ? <TranslatedText text="Could not save — please try again." />
                                    : saving
                                        ? <TranslatedText text="Saving…" />
                                        : <TranslatedText text="Rate only the domains you actually used. Tags let others filter models by control stack." />}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
