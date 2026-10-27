'use client';

import TranslatedText from '@/components/TranslatedText';
import { useTextTranslation } from '@/lib/i18n';
import { CONFIDENCE_STYLES, getConfidenceInfo } from '@/lib/ranking';

/** Confidence / sample-size pill shown on model and car cards. */
export default function ConfidencePill({ reviewCount, routeCount, className = '' }: {
    reviewCount: number;
    routeCount: number;
    className?: string;
}) {
    const tx = useTextTranslation();
    const info = getConfidenceInfo(reviewCount, routeCount);
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CONFIDENCE_STYLES[info.level]} ${className}`}
            title={tx(info.description)}
        >
            <span aria-hidden="true">{info.level === 'high' ? '●' : info.level === 'medium' ? '◐' : '○'}</span>
            <TranslatedText text={info.label} />
        </span>
    );
}
