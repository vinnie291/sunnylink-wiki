'use client';

import { useState } from 'react';

import WizardHero from './WizardHero';
import { useLanguage } from '../lib/i18n';

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
    const { t } = useLanguage();
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
        let modelName = 'Certified DTR (Down to Ride)'; // Usually models are untranslated proper nouns, but let's see
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
            category: t('wizard.recipe.category.model'),
            key: 'DrivingModel',
            label: t('wizard.recipe.label.drivingModel'),
            value: modelName,
            reason: modelReason,
        });

        // 2. Lateral Control
        recipe.push({
            category: t('wizard.recipe.category.steering'),
            key: 'MadsEnabled',
            label: t('wizard.recipe.label.madsEnabled'),
            value: true,
            reason: t('wizard.recipe.reason.criticalSp'),
        });

        if (isAdvanced) {
            // Advanced MADS Logic
            recipe.push({
                category: t('wizard.recipe.category.steering'),
                key: 'MadsSteeringMode',
                label: t('wizard.recipe.label.madsSteeringMode'),
                value: answers.madsMode === 'always_on' ? t('wizard.recipe.value.remainActive') : t('wizard.recipe.value.default'),
                reason: answers.madsMode === 'always_on' ? t('wizard.recipe.reason.steerActiveBrake') : t('wizard.recipe.reason.steerDisengageBrake'),
                isAdvanced: true,
            });

            // Advanced Lane Change Logic
            let alcTimer = t('wizard.recipe.value.nudge');
            if (answers.laneChangeType === 'instant') alcTimer = t('wizard.recipe.value.instant');
            // Note: 'assist' effectively means we might disable ALC or set to Nudge with high caution, 
            // but for toggle mapping 'Nudge' is the safe default for Assist-like behavior if ALC is on.
            // If they wanted "Assist Only" we might want to ensure ALC is separate, but we map to Timer here for safety if 'assist' was chosen implies caution.
            if (answers.laneChangeType === 'assist') alcTimer = t('wizard.recipe.value.timer');

            recipe.push({
                category: t('wizard.recipe.category.laneChange'),
                key: 'AutoLaneChangeTimer',
                label: t('wizard.recipe.label.autoLaneChange'),
                value: alcTimer,
                reason: answers.laneChangeType === 'instant' ? t('wizard.recipe.reason.fastChanges') : t('wizard.recipe.reason.safeConfirm'),
                isAdvanced: true,
            });
        }

        if (answers.roadType === 'winding' && isAdvanced) {
            recipe.push({
                category: t('wizard.recipe.category.steering'),
                key: 'NeuralNetworkLateralControl',
                label: t('wizard.recipe.label.nnlc'),
                value: false,
                reason: t('wizard.recipe.reason.notRecommended'),
                isAdvanced: true,
            });
            recipe.push({
                category: t('wizard.recipe.category.cruise'),
                key: 'VisionBasedTurnSpeedControl',
                label: t('wizard.recipe.label.visionTurnSpeed'),
                value: true,
                reason: t('wizard.recipe.reason.slowsCorners'),
                isAdvanced: true,
            });
        }

        // 3. Longitudinal Control
        if (answers.cityDriving) {
            recipe.push({
                category: t('wizard.recipe.category.cruise'),
                key: 'ExperimentalMode',
                label: t('wizard.recipe.label.experimentalMode'),
                value: true,
                reason: t('wizard.recipe.reason.cityHandling'),
            });

            if (isAdvanced) {
                recipe.push({
                    category: t('wizard.recipe.category.cruise'),
                    key: 'AlphaLongitudinal',
                    label: t('wizard.recipe.label.alphaLongitudinal'),
                    value: true,
                    reason: t('wizard.recipe.reason.e2eControl'),
                    isAdvanced: true,
                });
            }

            if (answers.drivingStyle === 'rush_hour') {
                recipe.push({
                    category: t('wizard.recipe.category.cruise'),
                    key: 'DynamicExperimentalControl',
                    label: t('wizard.recipe.label.dynamicExperimental'),
                    value: false,
                    reason: t('wizard.recipe.reason.forceExperimental'),
                    isAdvanced: true,
                });
            } else {
                recipe.push({
                    category: t('wizard.recipe.category.cruise'),
                    key: 'DynamicExperimentalControl',
                    label: t('wizard.recipe.label.dynamicExperimental'),
                    value: true,
                    reason: t('wizard.recipe.reason.switchAuto'),
                    isAdvanced: true,
                });
            }
        } else {
            recipe.push({
                category: t('wizard.recipe.category.cruise'),
                key: 'ExperimentalMode',
                label: t('wizard.recipe.label.experimentalMode'),
                value: false,
                reason: t('wizard.recipe.reason.chillHighway'),
            });
        }

        // 4. Car Specifics
        if (answers.carMake === 'hyundai_kia' && isAdvanced) {
            recipe.push({
                category: t('wizard.recipe.category.car'),
                key: 'HyundaiLongitudinalTuning',
                label: t('wizard.recipe.label.hyundaiLongTuning'),
                value: answers.drivingStyle === 'limo' ? t('wizard.recipe.value.off') : t('wizard.recipe.value.dynamic'),
                reason: t('wizard.recipe.reason.accelProfile'),
                isAdvanced: true,
            });
        }

        // 5. Personality
        let personality = t('wizard.recipe.value.standard');
        if (answers.drivingStyle === 'limo') personality = t('wizard.recipe.value.relaxed');
        if (answers.drivingStyle === 'rush_hour') personality = t('wizard.recipe.value.aggressive');

        recipe.push({
            category: t('wizard.recipe.category.general'),
            key: 'DrivingPersonality',
            label: t('wizard.recipe.label.drivingPersonality'),
            value: personality,
            reason: t('wizard.recipe.reason.matchesVibe', { vibe: answers.drivingStyle }),
        });

        return recipe;
    };

    const updateAnswer = (key: keyof WizardState, value: unknown) => {
        setAnswers(prev => ({ ...prev, [key]: value }));
    };

    const toggleCheck = (key: string) => {
        const newSet = new Set(checkedItems);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setCheckedItems(newSet);
    };

    // --- Render ---



    const StepHeader = ({ title, icon }: { title: string, icon?: string }) => (
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                <span>{title}</span>
                {icon && <span>{icon}</span>}
            </h2>

        </div>
    );

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 relative">
            {/* Feedback Modal */}


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
                <div className="max-w-5xl mx-auto py-6 sm:py-12 px-4 relative animate-fade-in flex flex-col md:flex-row items-center gap-8 md:gap-16">

                    {/* Text Section - Left on Desktop */}
                    <div className="flex-1 text-center md:text-left order-2 md:order-1">
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
                            Sunnylink <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{t('wizard.title')}</span>
                        </h1>

                        <p className="text-lg md:text-xl text-slate-400 mb-8 leading-relaxed max-w-xl mx-auto md:mx-0">
                            {t('wizard.intro.desc1')}
                            {t('wizard.intro.desc2')}
                        </p>

                        <button
                            onClick={(e) => {
                                triggerSparkles(e);
                                setStep('disclaimer');
                            }}
                            className="
                                relative overflow-hidden group
                                px-12 py-5 rounded-2xl
                                bg-gradient-to-r from-cyan-500 to-blue-600
                                hover:from-cyan-400 hover:to-blue-500
                                text-white font-bold text-xl
                                shadow-lg shadow-cyan-500/25
                                transition-all duration-300
                                transform hover:scale-105 hover:-translate-y-1
                                w-full md:w-auto
                            "
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {t('wizard.start')}
                                <span className="animate-bounce-x text-2xl">➔</span>
                            </span>
                            <span className="absolute inset-0 rounded-2xl ring-2 ring-white/30 animate-ping opacity-20" />
                        </button>
                    </div>

                    {/* Image Section - Right on Desktop */}
                    <div className="flex-1 flex justify-center order-1 md:order-2 w-full max-w-sm md:max-w-full">
                        <div className="scale-100 md:scale-125 origin-center">
                            <WizardHero showButton={false} />
                        </div>
                    </div>
                </div>
            )}

            {step === 'disclaimer' && (
                <div className="max-w-2xl mx-auto py-12 px-4 text-center relative animate-fade-in">
                    <div className="absolute top-4 right-4">

                    </div>
                    <h2 className="text-3xl font-bold text-red-500 mb-6">{t('wizard.disclaimer.title')}</h2>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-left mb-8">
                        <p className="text-slate-300 mb-4">
                            {t('wizard.disclaimer.desc1')}
                            <strong> {t('wizard.disclaimer.desc2')}</strong>
                        </p>
                        <ul className="list-disc list-inside text-slate-300 space-y-2">
                            <li>{t('wizard.disclaimer.li1')}</li>
                            <li>{t('wizard.disclaimer.li2')}</li>
                            <li>{t('wizard.disclaimer.li3')}</li>
                            <li>{t('wizard.disclaimer.li4')}</li>
                        </ul>
                    </div>
                    <button
                        onClick={() => setStep('hardware')}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors"
                    >
                        {t('wizard.disclaimer.accept')}
                    </button>
                </div>
            )}

            {step === 'results' && (
                <div className="max-w-3xl mx-auto py-8 px-4 relative animate-fade-in">
                    <div className="absolute top-8 right-4 z-10">

                    </div>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">{t('wizard.results.title')}</h2>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${answers.complexity === 'advanced' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                                {t('wizard.results.setup', { level: answers.complexity })}
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
                                                <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">{t('wizard.recipe.advLabel')}</span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-medium text-white mb-1">{item.label}</h3>
                                        <div className="text-2xl font-bold text-cyan-400 mb-2">
                                            {typeof item.value === 'boolean' ? (item.value ? t('wizard.recipe.value.on') : t('wizard.recipe.value.off')) : item.value}
                                        </div>
                                        <p className="text-sm text-slate-400 italic">&quot;{item.reason}&quot;</p>
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
                            {t('wizard.results.restart')}
                        </button>
                    </div>
                </div>
            )}

            {step === 'hardware' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title={t('wizard.step1.title')} icon="🛠️" />

                    <div className="space-y-4">
                        <h3 className="text-lg text-slate-300">{t('wizard.step1.device')}</h3>
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
                        <h3 className="text-lg text-slate-300">{t('wizard.step1.make')}</h3>
                        <div className="relative">
                            <select
                                value={answers.carMake}
                                onChange={(e) => updateAnswer('carMake', e.target.value)}
                                className="w-full p-4 pr-12 rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-cyan-500 outline-none appearance-none cursor-pointer"
                            >
                                <option value="hyundai_kia">{t('wizard.step1.make.hyundai')}</option>
                                <option value="toyota_lexus">{t('wizard.step1.make.toyota')}</option>
                                <option value="honda_acura">{t('wizard.step1.make.honda')}</option>
                                <option value="subaru">{t('wizard.step1.make.subaru')}</option>
                                <option value="ford">{t('wizard.step1.make.ford')}</option>
                                <option value="vw">{t('wizard.step1.make.vw')}</option>
                                <option value="gm">{t('wizard.step1.make.gm')}</option>
                                <option value="other">{t('wizard.step1.make.other')}</option>
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
                        >{t('wizard.next')} ➔</button>
                    </div>
                </div>
            )}

            {step === 'complexity' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title={t('wizard.step2.title')} icon="🧠" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => updateAnswer('complexity', 'easy')}
                            className={`p-6 rounded-xl border text-left transition-all ${answers.complexity === 'easy' ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-3xl mb-3">🟢</div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('wizard.step2.easy.title')}</h3>
                            <p className="text-sm text-slate-400">{t('wizard.step2.easy.desc')}</p>
                        </button>
                        <button
                            onClick={() => updateAnswer('complexity', 'advanced')}
                            className={`p-6 rounded-xl border text-left transition-all ${answers.complexity === 'advanced' ? 'bg-purple-500/20 border-purple-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-3xl mb-3">🟣</div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('wizard.step2.adv.title')}</h3>
                            <p className="text-sm text-slate-400">{t('wizard.step2.adv.desc')}</p>
                        </button>
                    </div>
                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('hardware')} className="text-slate-500 hover:text-white">← {t('wizard.previous')}</button>
                        <button
                            onClick={() => setStep('vibe')}
                            className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >{t('wizard.next')} ➔</button>
                    </div>
                </div>
            )}

            {step === 'vibe' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title={t('wizard.step3.title')} icon="😎" />
                    <div className="space-y-4">
                        {[
                            { id: 'limo', icon: '🎩', title: t('wizard.step3.limo.title'), desc: t('wizard.step3.limo.desc') },
                            { id: 'standard', icon: '🤖', title: t('wizard.step3.std.title'), desc: t('wizard.step3.std.desc') },
                            { id: 'rush_hour', icon: '🏎️', title: t('wizard.step3.rush.title'), desc: t('wizard.step3.rush.desc') }
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
                        <button onClick={() => setStep('complexity')} className="text-slate-500 hover:text-white">← {t('wizard.previous')}</button>
                        <button onClick={() => setStep('capabilities')} className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors">{t('wizard.next')} ➔</button>
                    </div>
                </div>
            )}

            {step === 'capabilities' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title={t('wizard.step4.title')} icon="🚦" />
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg text-slate-300">{t('wizard.step4.stop.title')}</h3>
                            <div className="flex gap-4">
                                <button onClick={() => updateAnswer('cityDriving', true)} className={`flex-1 p-4 rounded-xl border ${answers.cityDriving ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700'}`}>
                                    <div className="font-bold text-white">{t('wizard.step4.stop.yes')}</div>
                                    <div className="text-xs text-slate-400">{t('wizard.step4.stop.yesDesc')}</div>
                                </button>
                                <button onClick={() => updateAnswer('cityDriving', false)} className={`flex-1 p-4 rounded-xl border ${!answers.cityDriving ? 'bg-slate-700 border-slate-500' : 'bg-slate-800 border-slate-700'}`}>
                                    <div className="font-bold text-white">{t('wizard.step4.stop.no')}</div>
                                    <div className="text-xs text-slate-400">{t('wizard.step4.stop.noDesc')}</div>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg text-slate-300">{t('wizard.step4.road.title')}</h3>
                            <div className="flex gap-4">
                                <button onClick={() => updateAnswer('roadType', 'winding')} className={`flex-1 p-4 rounded-xl border ${answers.roadType === 'winding' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700'}`}>
                                    {t('wizard.step4.road.winding')}
                                </button>
                                <button onClick={() => updateAnswer('roadType', 'straight')} className={`flex-1 p-4 rounded-xl border ${answers.roadType === 'straight' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700'}`}>
                                    {t('wizard.step4.road.straight')}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('vibe')} className="text-slate-500 hover:text-white">← {t('wizard.previous')}</button>
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
                            {answers.complexity === 'advanced' ? `${t('wizard.next')} ➔` : `${t('wizard.step4.generate')}`}
                        </button>
                    </div>
                </div>
            )}

            {step === 'laneChange' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title={t('wizard.step5.title')} icon="↔️" />
                    <div className="space-y-4">
                        {[
                            { id: 'nudge', icon: '👋', title: t('wizard.step5.nudge.title'), desc: t('wizard.step5.nudge.desc') },
                            { id: 'instant', icon: '⚡', title: t('wizard.step5.instant.title'), desc: t('wizard.step5.instant.desc') },
                            { id: 'assist', icon: '🛡️', title: t('wizard.step5.assist.title'), desc: t('wizard.step5.assist.desc') }
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
                        <button onClick={() => setStep('capabilities')} className="text-slate-500 hover:text-white">← {t('wizard.previous')}</button>
                        <button onClick={() => setStep('mads')} className="px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors">{t('wizard.next')} ➔</button>
                    </div>
                </div>
            )}

            {step === 'mads' && (
                <div className="animate-fade-in space-y-8">
                    <StepHeader title={t('wizard.step6.title')} icon="🧠" />
                    <p className="text-slate-400 mb-6">{t('wizard.step6.desc')}</p>
                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => updateAnswer('madsMode', 'default')}
                            className={`p-6 rounded-xl border text-left transition-all ${answers.madsMode === 'default' ? 'bg-slate-700 border-slate-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-3xl mb-3">🛑</div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('wizard.step6.def.title')}</h3>
                            <p className="text-sm text-slate-400">{t('wizard.step6.def.desc')}</p>
                        </button>
                        <button
                            onClick={() => updateAnswer('madsMode', 'always_on')}
                            className={`p-6 rounded-xl border text-left transition-all ${answers.madsMode === 'always_on' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                        >
                            <div className="text-3xl mb-3">🛡️</div>
                            <h3 className="text-xl font-bold text-white mb-2">{t('wizard.step6.always.title')}</h3>
                            <p className="text-sm text-slate-400">{t('wizard.step6.always.desc')}</p>
                        </button>
                    </div>
                    <div className="pt-8 flex justify-between">
                        <button onClick={() => setStep('laneChange')} className="text-slate-500 hover:text-white">← {t('wizard.previous')}</button>
                        <button onClick={() => setStep('results')} className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold shadow-green-500/20 hover:scale-105 transition-transform">{t('wizard.step4.generate')}</button>
                    </div>
                </div>
            )}
        </div>
    );
}

