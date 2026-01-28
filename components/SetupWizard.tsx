'use client';

import { useState } from 'react';

// --- Types ---
type WizardStep = 'intro' | 'hardware' | 'vibe' | 'capabilities' | 'results';

interface WizardState {
    device: 'comma3' | 'comma2';
    carMake: 'hyundai_kia' | 'toyota_lexus' | 'honda_acura' | 'other';
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
}

// --- Component ---
export default function SetupWizard() {
    const [step, setStep] = useState<WizardStep>('intro');
    const [answers, setAnswers] = useState<WizardState>({
        device: 'comma3',
        carMake: 'hyundai_kia',
        drivingStyle: 'standard',
        cityDriving: false,
        roadType: 'straight',
    });
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    // --- Logic Engine ---
    const generateRecipe = (): RecipeItem[] => {
        const recipe: RecipeItem[] = [];

        // 1. Model Selection
        let modelName = 'Certified DTR (Down to Ride)'; // Default fallback
        let modelReason = 'Balanced starting point.';

        if (answers.drivingStyle === 'limo') {
            modelName = 'Certified DTR (Down to Ride)';
            modelReason = 'Prioritizes passenger comfort and smooth inputs.';
        } else if (answers.drivingStyle === 'rush_hour') {
            modelName = 'North Dakota'; // Often associated with stricter lane keeping, though simplifying here
            modelReason = 'More rigid adherence to lane, good for decisive traffic moves.';
        }

        recipe.push({
            category: '🧠 Model',
            key: 'model_selector',
            label: 'Driving Model',
            value: modelName,
            reason: modelReason,
        });

        // 2. Lateral Control (Steering)
        recipe.push({
            category: '🎯 Steering',
            key: 'mads_enabled',
            label: 'MADS Enabled',
            value: true,
            reason: 'Critical for all Sunnypilot features.',
        });

        if (answers.roadType === 'winding') {
            recipe.push({
                category: '🎯 Steering',
                key: 'nnlc_enabled',
                label: 'Neural Network Lateral Control (NNLC)',
                value: true,
                reason: 'Handles curves better than stock PID.',
            });
            recipe.push({
                category: '🚀 Cruise',
                key: 'vision_turn_control',
                label: 'Vision-Based Turn Speed Control',
                value: true,
                reason: 'Slows down automatically for sharp corners.',
            });
        }

        // 3. Longitudinal Control (Gas/Brake)
        if (answers.cityDriving) {
            recipe.push({
                category: '🚀 Cruise',
                key: 'experimental_mode',
                label: 'Experimental Mode',
                value: true,
                reason: 'Required for traffic light and stop sign handling in city.',
            });
            recipe.push({
                category: '🚀 Cruise',
                key: 'alpha_longitudinal',
                label: 'Alpha Longitudinal',
                value: true,
                reason: 'Optimized for end-to-end longitudinal control.',
            });

            if (answers.drivingStyle === 'rush_hour') {
                recipe.push({
                    category: '🚀 Cruise',
                    key: 'dynamic_experimental_control',
                    label: 'Dynamic Experimental Control',
                    value: false, // Force full experimental
                    reason: 'You want aggressive response; Dynamic might be too chill.',
                });
            } else {
                recipe.push({
                    category: '🚀 Cruise',
                    key: 'dynamic_experimental_control',
                    label: 'Dynamic Experimental Control',
                    value: true, // Use dynamic
                    reason: 'Automatically switches between Chill (Highway) and City modes.',
                });
            }

        } else {
            // Highway/Chill
            recipe.push({
                category: '🚀 Cruise',
                key: 'experimental_mode',
                label: 'Experimental Mode',
                value: false,
                reason: 'You preferred highway cruising; Chill mode is smoother.',
            });
        }

        // 4. Car Specifics
        if (answers.carMake === 'hyundai_kia') {
            recipe.push({
                category: '🔧 Car Specific',
                key: 'hyundai_longitudinal_tuning',
                label: 'Hyundai Longitudinal Tuning',
                value: answers.drivingStyle === 'limo' ? 'Stock' : 'Dynamic',
                reason: answers.drivingStyle === 'limo' ? 'Keep stock for gentler acceleration.' : 'Fixes sluggish stock acceleration.',
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
            reason: `Matches your '${answers.drivingStyle}' vibe preference.`,
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

    // --- Render Steps ---

    if (step === 'intro') {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center">
                <div className="mb-8 text-8xl">🧙‍♂️</div>
                <h1 className="text-4xl font-bold text-white mb-6">Sunnylink Setup Wizard</h1>
                <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                    Not sure which settings to pick? <br />
                    Answer a few simple questions about your car and driving style, and we'll generate a custom configuration for you.
                </p>
                <button
                    onClick={() => setStep('hardware')}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl text-xl font-bold shadow-lg shadow-cyan-500/20 hover:scale-105 transition-transform"
                >
                    Start Wizard
                </button>
            </div>
        );
    }

    if (step === 'results') {
        const recipe = generateRecipe();
        const progress = (checkedItems.size / recipe.length) * 100;

        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">Your Build Sheet</h2>
                        <p className="text-slate-400">Apply these settings in your car.</p>
                    </div>
                    <button
                        onClick={() => {
                            setStep('intro');
                            setCheckedItems(new Set());
                        }}
                        className="text-sm text-slate-500 hover:text-white underline"
                    >
                        Restart
                    </button>
                </div>


                {/* Progress Bar */}
                <div className="bg-slate-800 rounded-full h-4 mb-8 overflow-hidden">
                    <div
                        className="bg-green-500 h-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="space-y-6">
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
                                <div>
                                    <div className="text-xs font-bold tracking-wider text-slate-500 mb-1 uppercase">{item.category}</div>
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

                <div className="mt-12 p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                    <h4 className="text-blue-400 font-bold mb-2">🏁 Test Drive Verification</h4>
                    <p className="text-slate-300 text-sm">
                        After applying these settings, go for a short drive. If the car feels like it's "ping-ponging" (bouncing between lane lines),
                        switch <strong>Neural Network Lateral Control</strong> to <strong>OFF</strong>.
                    </p>
                </div>
            </div>
        );
    }

    // --- Wizard Questions ---
    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            {/* Progress */}
            <div className="flex gap-2 mb-12">
                {['hardware', 'vibe', 'capabilities'].map((s, i) => {
                    const steps = ['hardware', 'vibe', 'capabilities'];
                    const currentIndex = steps.indexOf(step as string);
                    const targetIndex = steps.indexOf(s);
                    const isActive = targetIndex <= currentIndex;

                    return (
                        <div key={s} className={`h-2 flex-1 rounded-full ${isActive ? 'bg-cyan-500' : 'bg-slate-800'}`} />
                    );
                })}
            </div>

            {step === 'hardware' && (
                <div className="animate-fade-in space-y-8">
                    <h2 className="text-3xl font-bold text-white">Step 1: The Hardware Handshake 🤝</h2>

                    <div className="space-y-4">
                        <h3 className="text-lg text-slate-300">Which device do you have?</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => updateAnswer('device', 'comma3')}
                                className={`p-6 rounded-xl border text-left transition-all ${answers.device === 'comma3' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                            >
                                <div className="text-2xl mb-2">📸</div>
                                <div className="font-bold text-white">Comma 3 / 3X</div>
                            </button>
                            <button
                                onClick={() => updateAnswer('device', 'comma2')}
                                className={`p-6 rounded-xl border text-left transition-all ${answers.device === 'comma2' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                            >
                                <div className="text-2xl mb-2">📱</div>
                                <div className="font-bold text-white">Comma 2 / Other</div>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg text-slate-300">What vehicle are you driving?</h3>
                        <select
                            value={answers.carMake}
                            onChange={(e) => updateAnswer('carMake', e.target.value)}
                            className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-cyan-500 outline-none"
                        >
                            <option value="hyundai_kia">Hyundai / Kia / Genesis</option>
                            <option value="toyota_lexus">Toyota / Lexus</option>
                            <option value="honda_acura">Honda / Acura</option>
                            <option value="other">Other / Not Listed</option>
                        </select>
                    </div>

                    <div className="pt-8 flex justify-end">
                        <button
                            onClick={() => setStep('vibe')}
                            className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >
                            Next Step ➔
                        </button>
                    </div>
                </div>
            )}

            {step === 'vibe' && (
                <div className="animate-fade-in space-y-8">
                    <h2 className="text-3xl font-bold text-white">Step 2: The Vibe Check 😎</h2>
                    <p className="text-slate-400">How do you want the car to drive?</p>

                    <div className="space-y-4">
                        {[
                            { id: 'limo', icon: '🎩', title: 'Like a Limo Driver', desc: 'Smooth, slow turns, gentle braking. Prioritizes comfort.' },
                            { id: 'standard', icon: '🤖', title: 'Like Me (Standard)', desc: 'Balanced and predictable. Good for everyday.' },
                            { id: 'rush_hour', icon: '🏎️', title: 'Rush Hour Commuter', desc: 'Aggressive. Closes gaps, accelerates fast.' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => updateAnswer('drivingStyle', opt.id)}
                                className={`w-full p-6 rounded-xl border text-left transition-all flex items-center gap-4 ${answers.drivingStyle === opt.id ? 'bg-cyan-500/20 border-cyan-500 ring-1 ring-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
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
                        <button onClick={() => setStep('hardware')} className="text-slate-500 hover:text-white">← Back</button>
                        <button
                            onClick={() => setStep('capabilities')}
                            className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >
                            Next Step ➔
                        </button>
                    </div>
                </div>
            )}

            {step === 'capabilities' && (
                <div className="animate-fade-in space-y-8">
                    <h2 className="text-3xl font-bold text-white">Step 3: Capabilities 🚦</h2>

                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg text-slate-300">Do you want stopping for red lights/stop signs?</h3>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => updateAnswer('cityDriving', true)}
                                    className={`flex-1 p-4 rounded-xl border transition-all ${answers.cityDriving ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div className="text-center font-bold text-white">Yes ✅</div>
                                    <div className="text-center text-xs text-slate-400 mt-1">Full City Handling</div>
                                </button>
                                <button
                                    onClick={() => updateAnswer('cityDriving', false)}
                                    className={`flex-1 p-4 rounded-xl border transition-all ${!answers.cityDriving ? 'bg-slate-700 border-slate-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div className="text-center font-bold text-white">No 🛣️</div>
                                    <div className="text-center text-xs text-slate-400 mt-1">Highway Cruising Only</div>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg text-slate-300">Typical road type?</h3>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => updateAnswer('roadType', 'winding')}
                                    className={`flex-1 p-4 rounded-xl border transition-all ${answers.roadType === 'winding' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div className="text-center font-bold text-white">Winding / Curves ⛰️</div>
                                </button>
                                <button
                                    onClick={() => updateAnswer('roadType', 'straight')}
                                    className={`flex-1 p-4 rounded-xl border transition-all ${answers.roadType === 'straight' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div className="text-center font-bold text-white">Mostly Straight 🛤️</div>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('vibe')} className="text-slate-500 hover:text-white">← Back</button>
                        <button
                            onClick={() => setStep('results')}
                            className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-green-500/20 hover:scale-105 transition-transform"
                        >
                            Generate Build Sheet ⚡
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
