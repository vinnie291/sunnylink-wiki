'use client';
import TranslatedText from '@/components/TranslatedText';


import { useEffect, useState } from 'react';
import { TrendingUp, Pause, Play } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

const EXAMPLE_SETS = [
    ['braking', 'highway', 'position', 'laneChanges', 'rivian'],
    ['traffic', 'curves', 'following', 'steering', 'experimental'],
] as const;

export default function SearchSuggestions({ onSelect }: { onSelect: (query: string) => void }) {
    const { t } = useLanguage();
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let timer: ReturnType<typeof setInterval> | undefined;
        const update = () => {
            clearInterval(timer);
            if (!paused && !hovered && !focused && !motion.matches) {
                timer = setInterval(() => setActive(index => (index + 1) % EXAMPLE_SETS.length), 30_000);
            }
        };
        update();
        motion.addEventListener('change', update);
        return () => { clearInterval(timer); motion.removeEventListener('change', update); };
    }, [paused, hovered, focused]);

    return (
        <div className="max-h-[60vh] overflow-y-auto px-2 pb-3 pt-5 sm:px-3">
            <div className="px-3 pb-4">
                <p className="text-base font-medium text-slate-200">{t('search.startTyping')}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{t('search.description')}</p>
            </div>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocusCapture={() => setFocused(true)}
                onBlurCapture={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
                }}
            >
                <div className="mb-1 flex items-center justify-between px-3">
                    <p className="text-xs font-medium text-slate-400">{t('search.tryExample')}</p>
                    <button
                        type="button"
                        onClick={() => setPaused(value => !value)}
                        aria-label={t(paused ? 'search.resumeExamples' : 'search.pauseExamples')}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                        {paused ? <Play aria-hidden="true" size={14} /> : <Pause aria-hidden="true" size={14} />}
                    </button>
                </div>
                <ul>
                    {EXAMPLE_SETS[active].map(key => {
                        const example = t(`search.example.${key}`);
                        return (
                            <li key={key}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(example)}
                                    className="flex min-h-12 w-full items-center gap-4 rounded-lg px-3 py-3 text-left text-sm font-medium leading-relaxed text-slate-200 transition-colors hover:bg-slate-700/60 focus-visible:bg-slate-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 sm:text-base"
                                >
                                    <TrendingUp aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-400" />
                                    <span><TranslatedText text={example} /></span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
