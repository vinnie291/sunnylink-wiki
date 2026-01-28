'use client';

import { useState } from 'react';

// --- Types ---
type WizardStep = 'intro' | 'disclaimer' | 'hardware' | 'complexity' | 'vibe' | 'capabilities' | 'results';

interface WizardState {
    device: 'comma3' | 'comma4';
    carMake: 'hyundai_kia' | 'toyota_lexus' | 'honda_acura' | 'subaru' | 'ford' | 'vw' | 'gm' | 'other';
    complexity: 'easy' | 'advanced';
    drivingStyle: 'limo' | 'standard' | 'rush_hour';
    cityDriving: boolean;
    roadType: 'winding' | 'straight';
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
    });
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    // --- Feedback Logic ---
    const handleFeedback = (currentStep: string) => {
        const subject = encodeURIComponent(`Setup Wizard Feedback - Step: ${currentStep}`);
        const body = encodeURIComponent(`I have feedback about the ${currentStep} step of the Setup Wizard:\n\n`);
        window.open(`https://github.com/vinnie291/sunnylink-wiki/issues/new?title=${subject}&body=${body}`, '_blank');
    };

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

        if (answers.drivingStyle === 'limo') {
            modelName = 'Certified DTR (Down to Ride)';
            modelReason = 'Prioritizes passenger comfort.';
        } else if (answers.drivingStyle === 'rush_hour') {
            modelName = 'North Dakota';
            modelReason = 'More rigid compliance.';
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

        if (answers.roadType === 'winding' && isAdvanced) {
            recipe.push({
                category: '🎯 Steering',
                key: 'nnlc_enabled',
                label: 'Neural Network Consrol (NNLC)',
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
            onClick={() => handleFeedback(step)}
            className="text-slate-500 hover:text-cyan-400 p-2 rounded-full hover:bg-slate-800 transition-colors"
            title="Report an issue with this step"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-8a2 2 0 012-2h14a2 2 0 012 2v8M3 21h18M5 11V7a5 5 0 0110 0v4" /></svg>
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

    if (step === 'intro') {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center relative">
                <div className="absolute top-4 right-4">
                    {renderFeedbackButton()}
                </div>
                <div className="mb-8 text-8xl animate-bounce">🧙‍♂️</div>
                <h1 className="text-4xl font-bold text-white mb-6">Sunnylink Setup Wizard</h1>
                <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                    Personalize your Sunnypilot experience.<br />
                    Answer a few questions to generate a custom configuration.
                </p>
                <div className="relative inline-block group">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                    <button
                        onClick={(e) => {
                            triggerSparkles(e);
                            setStep('disclaimer');
                        }}
                        className="relative px-8 py-4 bg-slate-900 ring-1 ring-slate-900/50 rounded-2xl leading-none flex items-center group-hover:bg-slate-800 transition-colors"
                    >
                        <span className="text-xl font-bold text-cyan-100 group-hover:text-white transition-colors">Start Wizard</span>
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'disclaimer') {
        return (
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
        );
    }

    if (step === 'results') {
        const recipe = generateRecipe();
        const progress = (checkedItems.size / recipe.length) * 100;

        return (
            <div className="max-w-3xl mx-auto py-8 px-4 relative">
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

                <div className="bg-slate-800 rounded-full h-4 mb-8 overflow-hidden">
                    <div
                        className="bg-green-500 h-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="space-y-4">
                    {recipe.map((item, idx) => (
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
                <div className="mt-8 text-center text-sm text-slate-500">
                    <button
                        onClick={() => {
                            setStep('intro');
                            setCheckedItems(new Set());
                        }}
                        className="hover:text-white underline"
                    >
                        Restart Wizard
                    </button>
                </div>
            </div>
        );
    }

    // --- Helper for Wizard Steps ---
    const ProgressBar = () => (
        <div className="flex gap-2 mb-12">
            {['hardware', 'complexity', 'vibe', 'capabilities'].map((s) => {
                const steps = ['hardware', 'complexity', 'vibe', 'capabilities'];
                const currentIndex = steps.indexOf(step as string);
                const targetIndex = steps.indexOf(s);
                const isActive = targetIndex <= currentIndex;

                return (
                    <div key={s} className={`h-2 flex-1 rounded-full ${isActive ? 'bg-cyan-500' : 'bg-slate-800'}`} />
                );
            })}
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 relative">
            <ProgressBar />

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
                        <button onClick={() => setStep('results')} className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold shadow-green-500/20 hover:scale-105 transition-transform">
                            Generate ⚡
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
