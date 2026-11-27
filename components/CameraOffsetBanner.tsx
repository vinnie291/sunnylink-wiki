'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
    const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
    const meta = useMemo(() => resolveModelMetadata(modelName), [modelName]);
    const bias = meta.telemetryProfile?.lateralBias ?? 0;
    if (Math.abs(bias) < BIAS_THRESHOLD) return null;

    const side = bias < 0 ? 'left' : 'right';
    const offsets = meta.telemetryProfile?.recommendedCameraOffset;
    const estimated = meta.inferredFields?.includes('telemetryProfile') ?? false;

    const handleCopyOffset = async (label: string, value: number) => {
        const formatted = (value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2));
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(formatted);
                setCopiedLabel(label);
                setTimeout(() => setCopiedLabel(null), 1500);
            }
        } catch {
            // Ignore clipboard errors in restricted webviews
        }
    };

    return (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4" aria-labelledby={`cam-${meta.id}`}>
            <div className="mb-1.5 flex items-center justify-between gap-2 flex-wrap">
                <h4 id={`cam-${meta.id}`} className="flex items-center gap-1.5 text-sm font-bold text-amber-300">
                    <span aria-hidden="true">🎯</span>
                    <TranslatedText text={`Reported ${side}-hugging — calibration or model bias?`} />
                </h4>
                <Link
                    href="/?setting=AdjustCameraOffset#AdjustCameraOffset"
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20 hover:text-white transition-colors"
                    title={tx('Adjust Camera Offset')}
                >
                    <TranslatedText text="Adjust Camera Offset" />
                    <span aria-hidden="true">↗</span>
                </Link>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
                <TranslatedText text="Intrinsic model bias is a consistent lane-position preference baked into the weights; it appears on every device. Hardware calibration error (camera pitch/yaw from mounting) shifts any model the same way. Redo calibration first, then use Camera Offset only for the remaining bias." />
            </p>

            {offsets && (offsets.c3x !== undefined || offsets.c4 !== undefined) && (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                    {([['Comma 3X', offsets.c3x], ['Comma 4', offsets.c4]] as const).map(([label, value]) => (
                        value === undefined ? (
                            <div key={label} className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-2 py-2 select-none">
                                <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
                                <dd className="font-mono text-sm font-bold text-slate-400">—</dd>
                            </div>
                        ) : (
                            <button
                                key={label}
                                type="button"
                                onClick={() => handleCopyOffset(label, value)}
                                title={tx(copiedLabel === label ? 'Copied!' : 'Adjust Camera Offset')}
                                className="rounded-xl border border-slate-700/60 bg-slate-900/60 hover:border-amber-400/40 hover:bg-slate-900 px-2 py-2 transition-colors cursor-pointer"
                            >
                                <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
                                <dd className="font-mono text-sm font-bold text-slate-100">
                                    {copiedLabel === label ? '✓' : formatMeters(value)}
                                </dd>
                            </button>
                        )
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
