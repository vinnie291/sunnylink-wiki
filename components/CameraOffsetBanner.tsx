'use client';

import { useMemo } from 'react';
import TranslatedText from '@/components/TranslatedText';
import { useTextTranslation } from '@/lib/i18n';
import { resolveModelMetadata } from '@/lib/modelMetadata';

const BIAS_THRESHOLD = 0.15;

function formatMeters(m: number): string {
    const sign = m > 0 ? '+' : m < 0 ? '−' : '';
    return `${sign}${Math.abs(m).toFixed(2)} m`;
}

/**
 * Explains that lane hugging has two separable causes — the model's own bias
 * and the device's pitch/yaw calibration — and shows the per-device camera
 * offset starting point. Rendered only when a left/right bias is reported.
 */
export default function CameraOffsetBanner({ modelName }: { modelName: string }) {
    const tx = useTextTranslation();
    const meta = useMemo(() => resolveModelMetadata(modelName), [modelName]);
    const bias = meta.telemetryProfile.lateralBias;
    if (Math.abs(bias) < BIAS_THRESHOLD) return null;

    const side = bias < 0 ? 'left' : 'right';
    const offsets = meta.telemetryProfile.recommendedCameraOffset;
    const estimated = meta.inferredFields.includes('telemetryProfile');

    return (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4" aria-labelledby={`cam-${meta.id}`}>
            <h4 id={`cam-${meta.id}`} className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-amber-300">
                <span aria-hidden="true">🎯</span>
                <TranslatedText text={`Reported ${side}-hugging — calibration or model bias?`} />
            </h4>
            <p className="text-xs leading-relaxed text-slate-300">
                <TranslatedText text="Intrinsic model bias is a consistent lane-position preference baked into the weights; it appears on every device. Hardware calibration error (camera pitch/yaw from mounting) shifts any model the same way. Redo calibration first, then use Camera Offset only for the remaining bias." />
            </p>

            {offsets && (offsets.c3x !== undefined || offsets.c4 !== undefined) && (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                    {([['Comma 3X', offsets.c3x], ['Comma 4', offsets.c4]] as const).map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-2 py-2">
                            <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
                            <dd className="font-mono text-sm font-bold text-slate-100">
                                {value === undefined ? '—' : formatMeters(value)}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            <p className="mt-2 text-[10px] leading-snug text-slate-500" title={tx('Offsets are a starting point. Adjust in small steps and re-test on a straight road.')}>
                <TranslatedText text={estimated
                    ? 'Starting offsets are estimated from community reports, not measured per device. Adjust in 0.01 m steps.'
                    : 'Recommended starting offsets. Adjust in 0.01 m steps.'} />
            </p>
        </section>
    );
}
