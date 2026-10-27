'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTextTranslation } from '@/lib/i18n';
import TranslatedText from '@/components/TranslatedText';
import { modelNameToSlug } from '@/lib/modelSlug';
import {
    COMPUTE_TIER_INFO,
    TRAINING_PARADIGM_INFO,
    getCanonicalAlias,
    getModelDisplayName,
    getNamingNotes,
    resolveModelMetadata,
} from '@/lib/modelMetadata';

/**
 * Training-paradigm + compute-tier badges, alias indicator and naming-collision
 * tooltip for a driving model. Values flagged as inferred are drawn with a
 * dashed border and described as estimates in their tooltip.
 */
export default function ModelMetaBadges({ modelName, className = '' }: { modelName: string; className?: string }) {
    const tx = useTextTranslation();
    const meta = useMemo(() => resolveModelMetadata(modelName), [modelName]);
    const paradigm = TRAINING_PARADIGM_INFO[meta.trainingParadigm];
    const paradigmInferred = meta.inferredFields.includes('trainingParadigm');
    const computeInferred = meta.inferredFields.includes('supportedCompute');
    const notes = useMemo(() => getNamingNotes(modelName), [modelName]);
    const canonical = getCanonicalAlias(meta);
    const canonicalName = canonical ? getModelDisplayName(canonical) : undefined;
    const estimate = ' (estimated from release date and tags — not independently verified)';

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`} onClick={e => e.stopPropagation()}>
            <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${paradigm.className} ${paradigmInferred ? 'border-dashed' : ''}`}
                title={tx(`Training paradigm: ${paradigm.description}${paradigmInferred ? estimate : ''}`)}
            >
                <span aria-hidden="true">{paradigmInferred ? '≈' : '✓'}</span>
                <TranslatedText text={paradigm.label} />
            </span>

            {meta.supportedCompute.map(tier => (
                <span
                    key={tier}
                    className={`inline-flex items-center rounded-full border border-slate-600/60 bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold text-slate-200 ${computeInferred ? 'border-dashed' : ''}`}
                    title={tx(`${COMPUTE_TIER_INFO[tier].description}${computeInferred ? estimate : ''}`)}
                >
                    {COMPUTE_TIER_INFO[tier].label}
                </span>
            ))}

            {canonical && canonicalName && (
                <Link
                    href={`/models?model=${modelNameToSlug(canonicalName)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/20"
                    title={tx(meta.aliasNote ?? `Identical weights to ${canonicalName}. This entry is a re-export or alias of that build.`)}
                >
                    <span aria-hidden="true">⧉</span>
                    <TranslatedText text="Alias of" /> {canonicalName}
                </Link>
            )}
            {!canonical && meta.aliases.length > 0 && (
                <span
                    className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/5 px-2 py-0.5 text-[10px] text-fuchsia-300/90"
                    title={tx(`Also listed as: ${meta.aliases.map(getModelDisplayName).join(', ')}`)}
                >
                    <span aria-hidden="true">⧉</span>
                    {meta.aliases.length} <TranslatedText text={meta.aliases.length === 1 ? 'alias' : 'aliases'} />
                </span>
            )}

            {meta.upstreamPrUrl && (
                <a
                    href={meta.upstreamPrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-600/60 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300 hover:text-cyan-300"
                    title={tx('Upstream pull request for this model')}
                >
                    <TranslatedText text="PR ↗" />
                </a>
            )}

            {notes.length > 0 && (
                <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[9px] font-bold text-slate-400 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300"
                    title={tx(notes.join('\n\n'))}
                    aria-label={tx(`Naming note: ${notes.join(' ')}`)}
                >
                    i
                </button>
            )}
        </div>
    );
}
