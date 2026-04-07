const fs = require('fs');
const content = fs.readFileSync('components/ConfigWizard.tsx', 'utf8');

let newContent = content.replace(
  /export type WizardStepId = 'welcome' \| 'car' \| 'driving' \| 'steering' \| 'speed' \| 'visuals' \| 'export';/,
  "export type WizardStepId = 'welcome' | 'car' | 'driving' | 'steering' | 'speed' | 'visuals' | 'review' | 'export';"
);

newContent = newContent.replace(
  /\{ id: 'visuals', icon: '🎨', label: 'Visuals & HUD' \},\n\s+\{ id: 'export', icon: '📦', label: 'Export Config' \},/s,
  "{ id: 'visuals', icon: '🎨', label: 'Visuals & HUD' },\n    { id: 'review', icon: '📋', label: 'Review' },\n    { id: 'export', icon: '📦', label: 'Export Config' },"
);

const reviewExportModalRegex = /function ReviewExportModal\(\{[\s\S]*?\}\) \{\n    const groupedSettings: \{ name: string; settings: \{ key: string; val: string \| number \| boolean \| undefined; meta: SettingMeta \| null \}\[\] \}\[\] = \[\];[\s\S]*?\n\}\n/s;

const reviewStepCode = `function ReviewStep({
    config,
    onBack,
    onNext,
    onChange
}: {
    config: ConfigValues;
    onBack: () => void;
    onNext: () => void;
    onChange: (key: string, value: string | number) => void;
}) {
    const groupedSettings: { name: string; settings: { key: string; val: string | number | boolean | undefined; meta: SettingMeta | null }[] }[] = [];
    const excludeKeys = new Set(['make', 'model', 'year', 'device']);
    
    for (const cat of togglesData.categories) {
        const catSettings = [];
        for (const meta of cat.settings) {
            if (meta.key in config && !excludeKeys.has(meta.key)) {
                catSettings.push({ key: meta.key, val: config[meta.key as keyof ConfigValues], meta: meta as SettingMeta });
            }
        }
        if (catSettings.length > 0) {
            groupedSettings.push({ name: cat.name, settings: catSettings });
        }
    }
    
    const matchedKeys = new Set(groupedSettings.flatMap(g => g.settings.map(s => s.key)));
    const orphans = [];
    for (const [k, v] of Object.entries(config)) {
        if (!excludeKeys.has(k) && !matchedKeys.has(k)) {
            orphans.push({ key: k, val: v, meta: null });
        }
    }
    if (orphans.length > 0) {
        groupedSettings.push({ name: "OTHER", settings: orphans });
    }

    const renderControl = (key: string, value: string | number | boolean | undefined, meta: SettingMeta | null) => {
        if (meta?.type === 'toggle' || value === 'True' || value === 'False' || value === 'true' || value === 'false') {
            const isOn = String(value).toLowerCase() === 'true';
            return (
                <button 
                    onClick={() => onChange(key, isOn ? 'False' : 'True')}
                    className="flex items-center justify-between w-full text-xs font-sans font-medium hover:opacity-80 transition-opacity text-left"
                >
                    <span className={isOn ? 'text-white' : 'text-slate-500'}>{isOn ? '✓ ON' : '✗ OFF'}</span>
                </button>
            );
        }
        if (meta?.type === 'dropdown' && meta.options) {
            return (
                <select 
                    value={String(value)} 
                    onChange={e => onChange(key, e.target.value)}
                    className="bg-transparent text-xs font-sans font-medium text-slate-200 outline-none w-full cursor-pointer hover:text-cyan-400"
                >
                    {meta.options.map(opt => (
                        <option key={opt} value={opt} className="bg-slate-800 text-white">{opt}</option>
                    ))}
                </select>
            );
        }
        if (meta?.type === 'slider' || typeof value === 'number') {
            return (
                <div className="flex items-center gap-1 w-full">
                    <input 
                        type="number"
                        value={value === undefined ? '' : Number(value)}
                        onChange={e => onChange(key, Number(e.target.value))}
                        className="bg-transparent text-xs font-sans font-medium text-slate-200 outline-none w-full hover:text-cyan-400 focus:text-cyan-400"
                        step={meta?.step || 1}
                        min={meta?.min}
                        max={meta?.max}
                    />
                    {meta?.unit && <span className="text-xs text-slate-500">{meta.unit}</span>}
                </div>
            );
        }
        return (
            <input 
                type="text"
                value={String(value)}
                onChange={e => onChange(key, e.target.value)}
                className="bg-transparent text-xs font-sans font-medium text-slate-200 outline-none w-full hover:text-cyan-400 focus:text-cyan-400"
            />
        );
    };

    let totalExported = 0;
    groupedSettings.forEach(g => { totalExported += g.settings.length; });

    return (
        <div className="cw-step-enter space-y-6">
            <div className="text-center space-y-2">
                <div className="text-4xl px-2">📋</div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Review Settings</h2>
                <p className="text-sm text-slate-400">Review and adjust your {totalExported} settings before exporting</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
                {groupedSettings.map(group => (
                    <div key={group.name} className="space-y-2">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-sans">{group.name}</div>
                        <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/20 divide-y divide-slate-700/50">
                            {group.settings.map(s => (
                                <div key={s.key} className="flex min-h-[36px]">
                                    <div className="w-1/2 px-4 py-2 border-r border-slate-700/50 text-slate-300 text-xs font-sans flex items-center">
                                        {s.meta?.label || s.key}
                                    </div>
                                    <div className="w-1/2 px-4 py-2 flex items-center bg-slate-800/40">
                                        {renderControl(s.key, s.val, s.meta)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between max-w-2xl mx-auto pt-4">
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-all">
                    ← Back
                </button>
                <button onClick={onNext}
                    className="px-8 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20 transition-all">
                    Next: Export →
                </button>
            </div>
        </div>
    );
}
`;

newContent = newContent.replace(reviewExportModalRegex, reviewStepCode);

// Handle ExportStep props and state
newContent = newContent.replace(
  /function ExportStep\(\{ config, onBack, onRestart, onChange \}: \{ config: ConfigValues; onBack: \(\) => void; onRestart: \(\) => void; onChange: \(key: string, value: string \| number\) => void \}\) \{\n    const \[copied, setCopied\] = useState\(false\);\n    const \[showJson, setShowJson\] = useState\(false\);\n    const \[showReview, setShowReview\] = useState\(false\);/,
  `function ExportStep({ config, onBack, onRestart }: { config: ConfigValues; onBack: () => void; onRestart: () => void }) {
    const [copied, setCopied] = useState(false);
    const [showJson, setShowJson] = useState(false);`
);

// Replace download logic
const downloadOriginal = `    const handleDownload = useCallback(() => {
        setShowReview(true);
    }, []);

    const performDownload = useCallback(() => {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sunnypilot-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowReview(false);
    }, [jsonStr]);`;

const downloadReplaced = `    const handleDownload = useCallback(() => {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sunnypilot-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [jsonStr]);`;

newContent = newContent.replace(downloadOriginal, downloadReplaced);

const exportModalRenderOriginal = `            {showReview && (
                <ReviewExportModal 
                    config={config} 
                    exportObj={exportObj} 
                    onClose={() => setShowReview(false)} 
                    onConfirm={performDownload} 
                    onChange={onChange}
                />
            )}`;

newContent = newContent.replace(exportModalRenderOriginal, "");

const mainOrchestratorReplacement = `            {currentStepId === 'visuals' && (
                <SettingsStep title="Visuals & HUD" icon="🎨" description="Customize your on-screen display, alerts, and visual feedback"
                    settingKeys={visualKeys} config={config} onChange={handleChange}
                    onNext={goNext} onBack={goBack} isAdvancedMode={isAdvancedMode} communityKeys={communityKeys} />
            )}
            {currentStepId === 'review' && <ReviewStep config={config} onBack={goBack} onNext={goNext} onChange={handleChange} />}
            {currentStepId === 'export' && <ExportStep config={config} onBack={goBack} onRestart={restart} />}`;

newContent = newContent.replace(
  /\{currentStepId === 'visuals' && \([\s\S]*?communityKeys=\{communityKeys\} \/>\n            \)\}\n            \{currentStepId === 'export' && <ExportStep config=\{config\} onBack=\{goBack\} onRestart=\{restart\} onChange=\{handleChange\} \/>\}/,
  mainOrchestratorReplacement
);

fs.writeFileSync('components/ConfigWizard.tsx', newContent);
