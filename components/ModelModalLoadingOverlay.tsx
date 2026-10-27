'use client';
import TranslatedText from '@/components/TranslatedText';
import { useTextTranslation } from '@/lib/i18n';


import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

interface ModelModalLoadingOverlayProps {
    modelName?: string;
    onClose?: () => void;
}

export default function ModelModalLoadingOverlay({
    modelName,
    onClose,
}: ModelModalLoadingOverlayProps) {
  const tx = useTextTranslation();
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            {/* Blurred Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={onClose}
                aria-hidden="true"
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Loading Modal Panel */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                role="status"
                aria-live="polite"
                aria-label={tx(modelName ? `Loading ${modelName}` : 'Loading driving model')}
                className="relative flex flex-col items-center justify-center px-8 py-7 rounded-3xl bg-slate-900/90 border border-slate-700/80 shadow-2xl shadow-cyan-950/60 max-w-sm w-full text-center overflow-hidden z-10"
            >
                {/* Ambient glow effects */}
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

                {/* Animated Cybernetic Spinner */}
                <div className="relative w-16 h-16 flex items-center justify-center mb-4">
                    {/* Outer glowing ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-slate-800 border-t-cyan-400 border-r-cyan-400/60 animate-spin [animation-duration:1s]" />
                    {/* Inner reverse accent ring */}
                    <div className="absolute inset-2 rounded-full border-2 border-slate-800/40 border-b-cyan-300 border-l-cyan-300/40 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
                    {/* Center icon / pulse dot */}
                    <div className="relative flex items-center justify-center text-xl animate-pulse">
                        <span>🤖</span>
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold text-slate-100 mb-1 break-words">
                    <TranslatedText text={modelName ? modelName : 'Loading Driving Model'} />
                </h3>

                {/* Subtitle */}
                <p className="text-xs text-slate-400 mb-4 max-w-[240px] leading-relaxed">
                     <TranslatedText text={"Preparing model details, skill ratings & consensus..."} /> </p>

                {/* Shimmer progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                    <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        initial={{ x: '-100%', width: '60%' }}
                        animate={{ x: '200%' }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                    />
                </div>

                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-4 text-[11px] text-slate-500 hover:text-slate-300 font-medium transition-colors"
                    >
                         <TranslatedText text={"Cancel"} /> </button>
                )}
            </motion.div>
        </div>,
        document.body
    );
}
