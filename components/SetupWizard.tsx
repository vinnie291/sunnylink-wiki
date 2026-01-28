'use client';

import { useState } from 'react';
import FlagFeedback from './FlagFeedback';
import WizardHero from './WizardHero';

// --- Types ---
type WizardStep = 'intro' | 'disclaimer' | 'hardware' | 'complexity' | 'vibe' | 'capabilities' | 'laneChange' | 'mads' | 'results';

interface WizardState {
    device: 'comma3' | 'comma4';
    carMake: 'hyundai_kia' | 'toyota_lexus' | 'honda_acura' | 'subaru' | 'ford' | 'vw' | 'gm' | 'other';
    complexity: 'easy' | 'advanced';
    drivingStyle: 'limo' | 'standard' | 'rush_hour';
    cityDriving: boolean;
    roadType: 'winding' | 'straight';
    laneChangeType: 'nudge' | 'instant' | 'assist';
    madsMode: 'default' | 'always_on';
}

interface RecipeItem {
    category: string;
    key: string;
    label: string;
    value: string | boolean;
    reason: string;
    isAdvanced?: boolean;
}

// --- Component ---
export default function SetupWizard() {
    const [step, setStep] = useState<WizardStep>('intro');
    const [answers, setAnswers] = useState<WizardState>({
        device: 'comma3',
        carMake: 'hyundai_kia',
        complexity: 'easy',
        drivingStyle: 'standard',
        cityDriving: false,
        roadType: 'straight',
        laneChangeType: 'nudge',
        madsMode: 'default',
    });
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [showFeedback, setShowFeedback] = useState(false);

    // --- Sparkle Effect ---
    const triggerSparkles = (e: React.MouseEvent<HTMLButtonElement>) => {
        const btn = e.currentTarget;
        btn.classList.add('animate-ping-once');
        setTimeout(() => btn.classList.remove('animate-ping-once'), 500);
    };

    // --- Logic Engine ---
    const generateRecipe = (): RecipeItem[] => {
        const recipe: RecipeItem[] = [];
        const isAdvanced = answers.complexity === 'advanced';

        // 1. Model Selection
        let modelName = 'Certified DTR (Down to Ride)';
        let modelReason = 'Balanced starting point.';

        // Diverse Model Logic
        if (answers.carMake === 'toyota_lexus') {
            if (answers.drivingStyle === 'rush_hour') {
                modelName = 'North Dakota';
                modelReason = 'Known for better torque handling on Toyotas.';
            } else {
                modelName = 'Tomb Raider';
                modelReason = 'Smooth, popular choice for Toyota fleet.';
            }
        } else if (answers.carMake === 'honda_acura') {
            modelName = 'North Dakota';
            modelReason = 'Stable and reliable for Honda torque limits.';
        } else if (answers.carMake === 'hyundai_kia') {
            if (answers.drivingStyle === 'limo') {
                modelName = 'SunnyPilot Default';
                modelReason = 'Most stable/stock-like feel.';
            } else {
                modelName = 'Certified DTR (Down to Ride)';
                modelReason = 'Great balance for HKG vehicles.';
            }
        }

        recipe.push({
            category: '🧠 Model',
            key: 'model_selector',
            label: 'Driving Model',
            value: modelName,
            reason: modelReason,
        });

        // 2. Lateral Control
        recipe.push({
            category: '🎯 Steering',
            key: 'mads_enabled',
            label: 'MADS Enabled',
            value: true,
            reason: 'Critical for Sunnypilot.',
        });

        if (isAdvanced) {
            // Advanced MADS Logic
            recipe.push({
                category: '🎯 Steering',
                key: 'mads_steering_mode',
                label: 'MADS Steering Mode',
                value: answers.madsMode === 'always_on' ? 'Remain Active' : 'Default',
                reason: answers.madsMode === 'always_on'
                    ? 'Steering stays active while braking.'
                    : 'Steering disengages on brake.',
                isAdvanced: true,
            });

            // Advanced Lane Change Logic
            let alcTimer = 'Nudge';
            if (answers.laneChangeType === 'instant') alcTimer = 'Instant';
            // Note: 'assist' effectively means we might disable ALC or set to Nudge with high caution, 
            // but for toggle mapping 'Nudge' is the safe default for Assist-like behavior if ALC is on.
            // If they wanted "Assist Only" we might want to ensure ALC is separate, but we map to Timer here for safety if 'assist' was chosen implies caution.
            if (answers.laneChangeType === 'assist') alcTimer = 'Timer';

            recipe.push({
                category: '🔄 Lane Change',
                key: 'auto_lane_change_timer',
                label: 'Auto Lane Change',
                value: alcTimer,
                reason: answers.laneChangeType === 'instant' ? 'Fast changes.' : 'Safer confirmation.',
                isAdvanced: true,
            });
        }

        if (answers.roadType === 'winding' && isAdvanced) {
            recipe.push({
                category: '🎯 Steering',
                key: 'nnlc_enabled',
                label: 'Neural Network Control',
                value: true,
                reason: 'Better curve handling.',
                isAdvanced: true,
            });
            recipe.push({
                category: '🚀 Cruise',
                key: 'vision_turn_control',
                label: 'Vision Turn Speed',
                value: true,
                reason: 'Slows for corners.',
                isAdvanced: true,
            });
        }

        // 3. Longitudinal Control
        if (answers.cityDriving) {
            recipe.push({
                category: '🚀 Cruise',
                key: 'experimental_mode',
                label: 'Experimental Mode',
                value: true,
                reason: 'Required for city handling.',
            });

            if (isAdvanced) {
                recipe.push({
                    category: '🚀 Cruise',
                    key: 'alpha_longitudinal',
                    label: 'Alpha Longitudinal',
                    value: true,
                    reason: 'End-to-end control.',
                    isAdvanced: true,
                });
            }

            if (answers.drivingStyle === 'rush_hour') {
                recipe.push({
                    category: '🚀 Cruise',
                    key: 'dynamic_experimental_control',
                    label: 'Dynamic Experimental',
                    value: false,
                    reason: 'Force full experimental for responsiveness.',
                    isAdvanced: true,
                });
            } else {
                recipe.push({
                    category: '🚀 Cruise',
                    key: 'dynamic_experimental_control',
                    label: 'Dynamic Experimental',
                    value: true,
                    reason: 'Switches modes automatically.',
                    isAdvanced: true,
                });
            }
        } else {
            recipe.push({
                category: '🚀 Cruise',
                key: 'experimental_mode',
                label: 'Experimental Mode',
                value: false,
                reason: 'Chill mode for highway.',
            });
        }

        // 4. Car Specifics
        if (answers.carMake === 'hyundai_kia' && isAdvanced) {
            recipe.push({
                category: '🔧 Car Specific',
                key: 'hyundai_longitudinal_tuning',
                label: 'Hyundai Long Tuning',
                value: answers.drivingStyle === 'limo' ? 'Stock' : 'Dynamic',
                reason: 'Adjusts acceleration profile.',
                isAdvanced: true,
            });
        }

        // 5. Personality
        let personality = 'Standard';
        if (answers.drivingStyle === 'limo') personality = 'Relaxed';
        if (answers.drivingStyle === 'rush_hour') personality = 'Aggressive';

        recipe.push({
            category: '⚙️ General',
            key: 'driving_personality',
            label: 'Driving Personality',
            value: personality,
            reason: `Matches '${answers.drivingStyle}' vibe.`,
        });

        return recipe;
    };

    const updateAnswer = (key: keyof WizardState, value: any) => {
        setAnswers(prev => ({ ...prev, [key]: value }));
    };

    const toggleCheck = (key: string) => {
        const newSet = new Set(checkedItems);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setCheckedItems(newSet);
    };

    // --- Render ---

    const renderFeedbackButton = () => (
        <button
            onClick={() => setShowFeedback(true)}
            className="text-slate-500 hover:text-cyan-400 p-2 rounded-full hover:bg-slate-800 transition-colors"
            title="Report an issue with this step"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            <span className="sr-only">Feedback</span>
        </button>
    );

    const StepHeader = ({ title, icon }: { title: string, icon?: string }) => (
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                <span>{title}</span>
                {icon && <span>{icon}</span>}
            </h2>
            {renderFeedbackButton()}
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 relative">
            {/* Feedback Modal */}
            {showFeedback && (
                <FlagFeedback
                    settingKey={`wizard_step_${step}`}
                    settingLabel={`Setup Wizard - Step: ${step.charAt(0).toUpperCase() + step.slice(1)}`}
                    onClose={() => setShowFeedback(false)}
                />
            )}

            {step !== 'intro' && step !== 'results' && step !== 'disclaimer' && (
                <div className="flex gap-2 mb-12">
                    {(() => {
                        const baseSteps = ['hardware', 'complexity', 'vibe', 'capabilities'];
                        const advSteps = ['laneChange', 'mads'];
                        const allSteps = answers.complexity === 'advanced'
                            ? [...baseSteps, ...advSteps]
                            : baseSteps;

                        return allSteps.map((s) => {
                            const currentIndex = allSteps.indexOf(step as string);
                            const targetIndex = allSteps.indexOf(s);
                            const isActive = targetIndex <= currentIndex;
                            return (
                                <div key={s} className={`h-2 flex-1 rounded-full bg-slate-800/50 overflow-hidden`}>
                                    <div className={`h-full transition-all duration-500 ease-out ${isActive ? 'bg-cyan-500 w-full' : 'w-0'}`} />
                                </div>
                            );
                        });
                    })()}
                </div>
            )}

            {step === 'intro' && (
                <div className="max-w-2xl mx-auto py-12 px-4 text-center relative animate-fade-in">
                    <div className="absolute top-4 right-4">
                        {renderFeedbackButton()}
                    </div>

                    <h1 className="text-4xl font-bold text-white mb-6">Sunnylink Setup Wizard</h1>
                    <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                        Personalize your Sunnypilot experience.<br />
                        Answer a few questions to generate a custom configuration.
                    </p>
                    <WizardHero
                        onStart={(e: any) => {
                            triggerSparkles(e);
                            setStep('disclaimer');
                        }}
                    />
                </div>
            )}

            {step === 'disclaimer' && (
                <div className="max-w-2xl mx-auto py-12 px-4 text-center relative animate-fade-in">
                    <div className="absolute top-4 right-4">
                        {renderFeedbackButton()}
                    </div>
                    <h2 className="text-3xl font-bold text-red-500 mb-6">⚠️ Disclaimer</h2>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-left mb-8">
                        <p className="text-slate-300 mb-4">
                            This wizard provides recommendations based on community testing.
                            <strong> Sunnypilot is beta software.</strong>
                        </p>
                        <ul className="list-disc list-inside text-slate-300 space-y-2">
                            <li>You are responsible for the safe operation of your vehicle.</li>
                            <li>Always keep your eyes on the road.</li>
                            <li>Test new settings in a safe environment.</li>
                            <li>Your mileage may vary depending on your specific car model and conditions.</li>
                        </ul>
                    </div>
                    <button
                        onClick={() => setStep('hardware')}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors"
                    >
                        I Understand & Accept
                    </button>
                </div>
            )}

            {step === 'results' && (
                <div className="max-w-3xl mx-auto py-8 px-4 relative animate-fade-in">
                    <div className="absolute top-8 right-4 z-10">
                        {renderFeedbackButton()}
                    </div>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">My Build Sheet</h2>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${answers.complexity === 'advanced' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                                {answers.complexity} Setup
                            </span>
                        </div>
                    </div>

                    {/* Results Progress - Shows how many checkboxes checked */}
                    <div className="bg-slate-800 rounded-full h-4 mb-8 overflow-hidden">
                        <div
                            className="bg-green-500 h-full transition-all duration-500"
                            style={{ width: `${(checkedItems.size / generateRecipe().length) * 100}%` }}
                        />
                    </div>

                    <div className="space-y-4">
                        {generateRecipe().map((item, idx) => (
                            <div
                                key={`${item.key}-${idx}`}
                                onClick={() => toggleCheck(item.key)}
                                className={`
                                    group relative p-6 rounded-2xl border cursor-pointer transition-all duration-200
                                    ${checkedItems.has(item.key)
                                        ? 'bg-green-900/10 border-green-500/50 opacity-75'
                                        : 'bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800'
                                    }
                                `}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`
                                        mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                        ${checkedItems.has(item.key)
                                            ? 'bg-green-500 border-green-500 text-slate-900'
                                            : 'border-slate-500 group-hover:border-cyan-400'
                                        }
                                    `}>
                                        {checkedItems.has(item.key) && (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div className="text-xs font-bold tracking-wider text-slate-500 mb-1 uppercase">{item.category}</div>
                                            {item.isAdvanced && (
                                                <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">ADV</span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-medium text-white mb-1">{item.label}</h3>
                                        <div className="text-2xl font-bold text-cyan-400 mb-2">
                                            {typeof item.value === 'boolean' ? (item.value ? 'ON' : 'OFF') : item.value}
                                        </div>
                                        <p className="text-sm text-slate-400 italic">"{item.reason}"</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12 text-center">
                        <button
                            onClick={() => {
                                setStep('intro');
                                setCheckedItems(new Set());
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="
                                px-6 py-3 rounded-xl 
                                bg-slate-800 text-slate-400 
                                hover:text-white hover:bg-slate-700 
                                transition-all duration-200 
                                font-medium flex items-center justify-center gap-2 mx-auto
                            "
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Restart Wizard
                        </button>
                    </div>
                </div>
            )}

            {step === 'hardware' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title="Step 1: Hardware" icon="🛠️" />

                    <div className="space-y-4">
                        <h3 className="text-lg text-slate-300">Device Model</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => updateAnswer('device', 'comma3')}
                                className={`p-6 rounded-xl border text-left transition-all ${answers.device === 'comma3' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                            >
                                <div className="text-2xl mb-2">📸</div>
                                <div className="font-bold text-white">Comma 3 / 3X</div>
                            </button>
                            <button
                                onClick={() => updateAnswer('device', 'comma4')}
                                className={`p-6 rounded-xl border text-left transition-all ${answers.device === 'comma4' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                            >
                                <div className="text-2xl mb-2">🔮</div>
                                <div className="font-bold text-white">Comma 4</div>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg text-slate-300">Vehicle Make</h3>
                        <div className="relative">
                            <select
                                value={answers.carMake}
                                onChange={(e) => updateAnswer('carMake', e.target.value)}
                                className="w-full p-4 pr-12 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-cyan-500 outline-none appearance-none cursor-pointer"
                            >
                                <option value="hyundai_kia">Hyundai / Kia / Genesis</option>
                                <option value="toyota_lexus">Toyota / Lexus</option>
                                <option value="honda_acura">Honda / Acura</option>
                                <option value="subaru">Subaru</option>
                                <option value="ford">Ford</option>
                                <option value="vw">Volkswagen / Audi</option>
                                <option value="gm">GM / Chevrolet</option>
                                <option value="other">Other / Not Listed</option>
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-cyan-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex justify-end">
                        <button
                            onClick={() => setStep('complexity')}
                            className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >
                            Next ➔
                        </button>
                    </div>
                </div>
            )}

            {step === 'complexity' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title="Step 2: Expertise Level" icon="🧠" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => updateAnswer('complexity', 'easy')}
                            className={`p-6 rounded-xl border text-left transition-all ${answers.complexity === 'easy' ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-3xl mb-3">🟢</div>
                            <h3 className="text-xl font-bold text-white mb-2">Easy Setup</h3>
                            <p className="text-sm text-slate-400">Just the core essentials. Best for new users.</p>
                        </button>
                        <button
                            onClick={() => updateAnswer('complexity', 'advanced')}
                            className={`p-6 rounded-xl border text-left transition-all ${answers.complexity === 'advanced' ? 'bg-purple-500/20 border-purple-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-3xl mb-3">🟣</div>
                            <h3 className="text-xl font-bold text-white mb-2">Advanced Setup</h3>
                            <p className="text-sm text-slate-400">Full control over internal parameters. For power users.</p>
                        </button>
                    </div>
                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('hardware')} className="text-slate-500 hover:text-white">← Back</button>
                        <button
                            onClick={() => setStep('vibe')}
                            className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >
                            Next ➔
                        </button>
                    </div>
                </div>
            )}

            {step === 'vibe' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title="Step 3: Vibe Check" icon="😎" />
                    <div className="space-y-4">
                        {[
                            { id: 'limo', icon: '🎩', title: 'Limo Driver', desc: 'Smooth, slow turns. Comfort first.' },
                            { id: 'standard', icon: '🤖', title: 'Standard', desc: 'Balanced and predictable.' },
                            { id: 'rush_hour', icon: '🏎️', title: 'Rush Hour', desc: 'Aggressive gap closing.' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => updateAnswer('drivingStyle', opt.id)}
                                className={`w-full p-6 rounded-xl border text-left transition-all flex items-center gap-4 ${answers.drivingStyle === opt.id ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                            >
                                <div className="text-4xl">{opt.icon}</div>
                                <div>
                                    <div className="font-bold text-white text-lg">{opt.title}</div>
                                    <div className="text-slate-400 text-sm">{opt.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('complexity')} className="text-slate-500 hover:text-white">← Back</button>
                        <button onClick={() => setStep('capabilities')} className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                            Next ➔
                        </button>
                    </div>
                </div>
            )}

            {step === 'capabilities' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title="Step 4: Capabilities" icon="🚦" />
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg text-slate-300">Stop for lights/signs?</h3>
                            <div className="flex gap-4">
                                <button onClick={() => updateAnswer('cityDriving', true)} className={`flex-1 p-4 rounded-xl border ${answers.cityDriving ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700'}`}>
                                    <div className="font-bold text-white">Yes ✅</div>
                                    <div className="text-xs text-slate-400">City + Highway</div>
                                </button>
                                <button onClick={() => updateAnswer('cityDriving', false)} className={`flex-1 p-4 rounded-xl border ${!answers.cityDriving ? 'bg-slate-700 border-slate-500' : 'bg-slate-800 border-slate-700'}`}>
                                    <div className="font-bold text-white">No 🛣️</div>
                                    <div className="text-xs text-slate-400">Highway Only</div>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg text-slate-300">Road Type?</h3>
                            <div className="flex gap-4">
                                <button onClick={() => updateAnswer('roadType', 'winding')} className={`flex-1 p-4 rounded-xl border ${answers.roadType === 'winding' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700'}`}>
                                    Winding ⛰️
                                </button>
                                <button onClick={() => updateAnswer('roadType', 'straight')} className={`flex-1 p-4 rounded-xl border ${answers.roadType === 'straight' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700'}`}>
                                    Straight 🛤️
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('vibe')} className="text-slate-500 hover:text-white">← Back</button>
                        <button
                            onClick={() => {
                                if (answers.complexity === 'advanced') {
                                    setStep('laneChange');
                                } else {
                                    setStep('results');
                                }
                            }}
                            className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold shadow-green-500/20 hover:scale-105 transition-transform"
                        >
                            {answers.complexity === 'advanced' ? 'Next ➔' : 'Generate ⚡'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'laneChange' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title="Step 5: Lane Changes" icon="↔️" />
                    <div className="space-y-4">
                        {[
                            { id: 'nudge', icon: '👋', title: 'Nudge (Recommended)', desc: 'You confirm the change by nudging the wheel.' },
                            { id: 'instant', icon: '⚡', title: 'Instant', desc: 'Car changes lane immediately when blinker is on.' },
                            { id: 'assist', icon: '🛡️', title: 'Assist Only', desc: 'No auto change, just keeps lane until you steer.' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => updateAnswer('laneChangeType', opt.id as WizardState['laneChangeType'])}
                                className={`w-full p-6 rounded-xl border text-left transition-all flex items-center gap-4 ${answers.laneChangeType === opt.id ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                            >
                                <div className="text-4xl">{opt.icon}</div>
                                <div>
                                    <div className="font-bold text-white text-lg">{opt.title}</div>
                                    <div className="text-slate-400 text-sm">{opt.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('capabilities')} className="text-slate-500 hover:text-white">← Back</button>
                        <button onClick={() => setStep('mads')} className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                            Next ➔
                        </button>
                    </div>
                </div>
            )}

            {step === 'mads' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title="Step 6: MADS Behavior" icon="🧠" />
                    <p className="text-slate-400 mb-6">Modular Automated Driving System (MADS) keeps steering active even when you use the gas or brake.</p>
                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => updateAnswer('madsMode', 'default')}
                            className={`p-6 rounded-xl border text-left transition-all ${answers.madsMode === 'default' ? 'bg-slate-700 border-slate-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-3xl mb-3">🛑</div>
                            <h3 className="text-xl font-bold text-white mb-2">Default MADS</h3>
                            <p className="text-sm text-slate-400">Steering disconnects when you hit the brake.</p>
                        </button>
                        <button
                            onClick={() => updateAnswer('madsMode', 'always_on')}
                            className={`p-6 rounded-xl border text-left transition-all ${answers.madsMode === 'always_on' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-3xl mb-3">🛡️</div>
                            <h3 className="text-xl font-bold text-white mb-2">Always-On Steering (Recommended)</h3>
                            <p className="text-sm text-slate-400">Steering remains active while braking. Great for highway cruising.</p>
                        </button>
                    </div>
                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('laneChange')} className="text-slate-500 hover:text-white">← Back</button>
                        <button onClick={() => setStep('results')} className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold shadow-green-500/20 hover:scale-105 transition-transform">
                            Generate ⚡
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

