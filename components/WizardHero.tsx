'use client';

import { motion } from 'framer-motion';

interface WizardHeroProps {
    onStart?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    showButton?: boolean;
}

export default function WizardHero({ onStart, showButton = true }: WizardHeroProps) {
    return (
        <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto mb-6 sm:mb-8">
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 mb-4 sm:mb-8 flex items-center justify-center">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 rounded-full blur-3xl animate-pulse" />

                <motion.img
                    src="/wizard-car.png"
                    alt="Wizard driving a red tailored convertible"
                    className="relative z-10 w-full h-full object-contain drop-shadow-2xl"
                    animate={{
                        x: [0, -8, 0, 8, 0], // Lateral Sway (Lane Keeping)
                        scale: [1, 1.02, 1, 1.01, 1], // Longitudinal Feel (Speed/Breathing)
                        rotate: [0, -1, 0, 1, 0] // Tiny rotation for suspension feel
                    }}
                    transition={{
                        duration: 7, // User requested 7 seconds
                        ease: "easeInOut", // Natural physics feel
                        repeat: Infinity,
                        times: [0, 0.25, 0.5, 0.75, 1]
                    }}
                />
            </div>

            {showButton && onStart && (
                <button
                    onClick={onStart}
                    className="
                        relative overflow-hidden group
                        px-10 py-4 rounded-2xl
                        bg-gradient-to-r from-cyan-500 to-blue-600
                        hover:from-cyan-400 hover:to-blue-500
                        text-white font-bold text-xl
                        shadow-lg shadow-cyan-500/25
                        transition-all duration-300
                        transform hover:scale-105 hover:-translate-y-1
                    "
                >
                    <span className="relative z-10 flex items-center gap-2">
                        Start Setup
                        <motion.span
                            animate={{ x: [0, 4, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        >
                            ➔
                        </motion.span>
                    </span>

                    {/* Button Pulse Ring */}
                    <span className="absolute inset-0 rounded-2xl ring-2 ring-white/30 animate-ping opacity-20" />
                </button>
            )}
        </div>
    );
}
