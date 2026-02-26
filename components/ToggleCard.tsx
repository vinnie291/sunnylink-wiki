'use client';

import { useState, useEffect, useRef } from 'react';

interface ToggleSetting {
  key: string;
  label: string;
  type: string;
  options?: string[];
  default: boolean | string | number;
  min?: number;
  max?: number;
  unit?: string;
  description: string;
  recommended?: boolean | string;
  warning?: string;
  userNote?: string;
  safetyLevel?: 'safe' | 'critical';
  useCase?: string;
  tradeoffs?: string[];
  deepDive?: string;
  helpText?: string;
  dependencies?: { key: string; label: string }[];
}

interface ToggleCardProps {
  setting: ToggleSetting;
  categoryName: string;
  categoryIcon: string;
  categoryId: string;
  isHighlighted: boolean;
}

/* ─────────────────────── Simulators ─────────────────────── */

function ToggleSimulator({ defaultValue, statusText }: { defaultValue: boolean; statusText?: string }) {
  const [enabled, setEnabled] = useState(defaultValue);
  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-6 flex flex-col items-center gap-4">
      <span className="text-sm font-bold tracking-[0.2em] text-slate-300 uppercase">
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
      <button
        onClick={() => setEnabled(!enabled)}
        className={`
          relative inline-flex h-9 w-[68px] items-center rounded-full transition-colors duration-300 cursor-pointer
          ${enabled ? 'bg-[#5b36f5]' : 'bg-slate-600'}
        `}
        aria-label={enabled ? 'Disable' : 'Enable'}
      >
        <span
          className={`
            inline-block h-7 w-7 rounded-full bg-white shadow-lg transition-all duration-300
            ${enabled ? 'ml-[36px]' : 'ml-1'}
          `}
        />
      </button>
      {statusText && (
        <div className="flex items-center gap-2 mt-1">
          <svg className="w-4 h-4 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold tracking-[0.15em] text-violet-400 uppercase">{statusText}</span>
        </div>
      )}
    </div>
  );
}

function SliderSimulator({
  min,
  max,
  defaultValue,
  unit,
  statusText,
  settingLabel,
}: {
  min: number;
  max: number;
  defaultValue: number;
  unit?: string;
  statusText?: string;
  settingLabel?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const range = max - min;
  const percentage = ((value - min) / range) * 100;
  const step = range <= 1 ? 0.01 : range <= 10 ? 0.1 : 1;

  const nudge = (dir: number) => {
    const next = Math.round((value + dir * step) * 100) / 100;
    setValue(Math.max(min, Math.min(max, next)));
  };

  // Format value: use integers when step >= 1
  const fmt = (v: number) => (step >= 1 ? String(Math.round(v)) : v.toFixed(2));

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-5">
      {/* Top row: min — value — max */}
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-sm font-bold tracking-[0.15em] text-slate-500 uppercase">{fmt(min)}</span>
        <span className="text-xl font-bold tracking-[0.2em] text-[#5b36f5]">{fmt(value)}</span>
        <span className="text-sm font-bold tracking-[0.15em] text-slate-500 uppercase">{fmt(max)}</span>
      </div>

      {/* Slider row: − [track] + */}
      <div className="flex items-center gap-3">
        {/* Minus button */}
        <button
          onClick={() => nudge(-1)}
          className="flex-shrink-0 text-xl font-bold text-slate-400 hover:text-white transition-colors w-6 text-center select-none cursor-pointer"
          aria-label="Decrease"
        >
          −
        </button>

        {/* Track */}
        <div className="relative flex-1 h-3 bg-slate-800 rounded-full">
          {/* Filled portion */}
          <div
            className="absolute h-full bg-[#5b36f5] rounded-full"
            style={{ width: `${percentage}%` }}
          />
          {/* Hidden range input */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value))}
            aria-label={settingLabel ? `Adjust ${settingLabel}` : 'Adjust value'}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Default Value Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-slate-500/50 rounded-full"
            style={{ left: `calc(${((defaultValue - min) / range) * 100}% - 2px)` }}
          />
          {/* Knob */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-[3px] border-[#5b36f5] shadow-md pointer-events-none"
            style={{ left: `calc(${percentage}% - 8px)` }}
          />
        </div>

        {/* Plus button */}
        <button
          onClick={() => nudge(1)}
          className="flex-shrink-0 text-xl font-bold text-slate-400 hover:text-white transition-colors w-6 text-center select-none cursor-pointer"
          aria-label="Increase"
        >
          +
        </button>
      </div>

      {/* Status label */}
      {statusText && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold tracking-[0.15em] text-emerald-400 uppercase">{statusText}</span>
        </div>
      )}
    </div>
  );
}

function DropdownSimulator({
  options,
  defaultValue,
  recommended,
}: {
  options: string[];
  defaultValue: string;
  recommended?: string;
}) {
  const [selected, setSelected] = useState(defaultValue);

  return (
    <div className="space-y-1">
      {/* Option list */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-700/50 overflow-hidden">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => setSelected(option)}
            className={`
              w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors
              ${option === selected
                ? 'text-white bg-slate-800/50'
                : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-300'
              }
              ${option !== options[options.length - 1] ? 'border-b border-slate-700/30' : ''}
            `}
          >
            {option === selected ? (
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="w-4 h-4 flex-shrink-0" />
            )}
            <span className={`flex-1 ${option === selected ? 'font-semibold' : ''}`}>
              {option}
              {option === recommended && option !== selected && (
                <span className="ml-2 text-xs text-emerald-400">★</span>
              )}
            </span>
            {option === defaultValue && (
              <span className="text-xs text-slate-500 font-medium ml-auto">(Default)</span>
            )}
          </button>
        ))}
      </div>

      {/* Dropdown select */}
      <div className="rounded-xl bg-slate-900/70 border border-slate-700/50 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-white">{selected}</span>
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────── Main Component ─────────────────────── */

export default function ToggleCard({
  setting,
  categoryName,
  categoryIcon,
  categoryId,
  isHighlighted,
}: ToggleCardProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(setting.key)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.history.replaceState(null, '', `#${encodeURIComponent(setting.key)}`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleReportIssue = () => {
    const title = encodeURIComponent(`Issue with ${setting.label}`);
    const body = encodeURIComponent(`Flagged from section: ${categoryName}\n\nDescribe the issue here:`);
    const issueUrl = `https://github.com/vinnie291/sunnylink-wiki/issues/new?title=${title}&body=${body}`;
    window.open(issueUrl, '_blank');
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Map category ID to Sunnylink dashboard path
  const getSunnylinkUrl = () => {
    const baseUrl = 'https://www.sunnylink.ai/dashboard';
    const slug = setting.key;
    switch (categoryId) {
      case 'models': return `${baseUrl}/models#${slug}`;
      case 'device': return `${baseUrl}/settings/device#${slug}`;
      case 'toggles': return `${baseUrl}/settings/toggles#${slug}`;
      case 'steering': return `${baseUrl}/settings/steering#${slug}`;
      case 'cruise': return `${baseUrl}/settings/cruise#${slug}`;
      case 'visuals': return `${baseUrl}/settings/visuals#${slug}`;
      case 'developer': return `${baseUrl}/settings/developer#${slug}`;
      case 'other': return `${baseUrl}/settings/other#${slug}`;
      default: return `${baseUrl}/settings/device#${slug}`;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'toggle': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'dropdown': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
      case 'slider': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'action': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'text': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'readonly': return 'bg-slate-600/20 text-slate-400 border-slate-600/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  // Map setting type to a user-friendly label for the badge
  const getTypeBadgeLabel = (type: string) => {
    switch (type) {
      case 'toggle': return 'toggle';
      case 'dropdown': return 'selector';
      case 'slider': return 'slider';
      case 'action': return 'action';
      case 'text': return 'text input';
      case 'readonly': return 'info';
      default: return type;
    }
  };

  // Tradeoffs are now always-visible in the right column (no accordion needed)

  // Status/Range alert box for right column
  const getAlertBox = () => {
    if (setting.type === 'slider' && setting.helpText) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-emerald-400 text-sm font-medium">{setting.helpText}</span>
        </div>
      );
    }
    if (setting.type === 'toggle') {
      const statusText = setting.helpText
        ? setting.helpText
        : `Default: ${setting.default ? 'ON' : 'OFF'}${setting.recommended !== undefined
          ? ` · Recommended: ${typeof setting.recommended === 'boolean' ? (setting.recommended ? 'ON' : 'OFF') : setting.recommended}`
          : ''
        }`;
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <svg className="w-5 h-5 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-violet-400 text-sm font-medium">{statusText}</span>
        </div>
      );
    }
    if (setting.type === 'dropdown') {
      const defaultLabel = setting.default ? String(setting.default) : 'Not set';
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <svg className="w-5 h-5 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-violet-400 text-sm font-medium">Default: {defaultLabel}</span>
        </div>
      );
    }
    // Fallback for other types with helpText
    if (setting.helpText) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
          <svg className="w-5 h-5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-cyan-400 text-sm font-medium">{setting.helpText}</span>
        </div>
      );
    }
    return null;
  };

  // Render the control simulator based on setting type
  // Build status text for simulator labels
  const getSimulatorStatusText = () => {
    if (setting.type === 'toggle') {
      if (setting.helpText) return setting.helpText;
      const parts: string[] = [];
      parts.push(`Default: ${setting.default ? 'ON' : 'OFF'}`);
      if (setting.recommended !== undefined) {
        parts.push(`Recommended: ${typeof setting.recommended === 'boolean' ? (setting.recommended ? 'ON' : 'OFF') : setting.recommended}`);
      }
      return parts.join(' · ');
    }
    if (setting.type === 'slider' && setting.helpText) return setting.helpText;
    if (setting.type === 'dropdown') {
      const defaultLabel = setting.default ? String(setting.default) : 'Not set';
      return `Default: ${defaultLabel}`;
    }
    return undefined;
  };

  const renderSimulator = () => {
    switch (setting.type) {
      case 'toggle':
        return <ToggleSimulator defaultValue={setting.default === true} statusText={getSimulatorStatusText()} />;
      case 'slider':
        return (
          <SliderSimulator
            min={setting.min ?? 0}
            max={setting.max ?? 1}
            defaultValue={typeof setting.default === 'number' ? setting.default : 0}
            unit={setting.unit}
            statusText={getSimulatorStatusText()}
            settingLabel={setting.label}
          />
        );
      case 'dropdown':
        if (setting.options && setting.options.length > 0) {
          return (
            <DropdownSimulator
              options={setting.options}
              defaultValue={String(setting.default || setting.options[0])}
              recommended={typeof setting.recommended === 'string' ? setting.recommended : undefined}
            />
          );
        }
        return null;
      default:
        return null;
    }
  };

  const hasRightColumn = setting.type === 'toggle' || setting.type === 'slider' || (setting.type === 'dropdown' && setting.options) || setting.useCase || getAlertBox() || (setting.tradeoffs && setting.tradeoffs.length > 0);

  return (
    <div
      ref={cardRef}
      id={setting.key}
      className={`
        relative group rounded-2xl border backdrop-blur-sm transition-all duration-500 ease-out
        ${isHighlighted
          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-500/30 animate-highlight'
          : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-600/50'
        }
      `}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative p-5 lg:p-7">

        {/* ──── HEADER: Full Width ──── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          {/* Left: Badge + Title + Category */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getTypeBadgeStyle(setting.type)}`}>
                {getTypeBadgeLabel(setting.type)}
              </span>
              {setting.recommended && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ★ Recommended
                </span>
              )}
              {setting.safetyLevel === 'critical' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  ⚠️ Critical
                </span>
              )}
              {setting.safetyLevel === 'safe' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ✓ Safe
                </span>
              )}
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-white group-hover:text-cyan-400 transition-colors leading-tight">
              {setting.label}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
              <span>{categoryIcon}</span>
              <span>{categoryName}</span>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* Flag */}
              <button
                onClick={handleReportIssue}
                className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-200"
                title="Flag this setting"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
              </button>
              {/* Share */}
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-200"
                title={copied ? "Copied!" : "Share this setting"}
              >
                {copied ? (
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
              </button>
            </div>
            {/* CTA */}
            <a
              href={getSunnylinkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${setting.label} in sunnylink`}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#5b36f5] text-white hover:bg-[#4a2bd0] transition-all duration-200 flex items-center gap-1.5 shadow-lg shadow-[#5b36f5]/25 whitespace-nowrap"
            >
              <span>View in sunnylink</span>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>

        {/* ──── BODY: 2-Column Grid ──── */}
        <div className={`grid grid-cols-1 ${hasRightColumn ? 'lg:grid-cols-12 lg:gap-8' : ''}`}>

          {/* ──── LEFT COLUMN ──── */}
          <div className={hasRightColumn ? 'lg:col-span-7' : 'lg:col-span-12'}>

            {/* Description */}
            <p className="text-slate-300 text-sm lg:text-base leading-relaxed mb-5">
              {setting.description}
            </p>

            {/* Warning */}
            {setting.warning && (
              <div className="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-400 text-sm">
                  <span className="font-semibold">⚠️ Warning:</span> {setting.warning}
                </p>
              </div>
            )}

            {/* Dependencies */}
            {setting.dependencies && setting.dependencies.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-5">
                <span className="text-amber-400 text-xs">🔗</span>
                <span className="text-amber-400 text-xs font-medium">
                  Requires: {setting.dependencies.map(d => d.label).join(', ')}
                </span>
              </div>
            )}

            {/* Collapsible: Deep Dive (stays as accordion under description) */}
            {setting.deepDive && (
              <div className="mb-5">
                <button
                  onClick={() => toggleSection('deepdive')}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full text-left"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedSection === 'deepdive' ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium">🔬 Technical Deep Dive</span>
                </button>
                {expandedSection === 'deepdive' && (
                  <div className="mt-3 ml-6 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                    <p className="text-sm text-slate-400 font-mono leading-relaxed">
                      {setting.deepDive}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Control Simulator — placed under description / deep dive */}
            {renderSimulator() && (
              <div className="mb-5">
                {renderSimulator()}
              </div>
            )}

            {/* Options for dropdown without option-list simulator */}
            {setting.options && setting.type !== 'dropdown' && (
              <div className="mb-5">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Options:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {setting.options.map((option) => (
                    <span
                      key={option}
                      className={`
                        px-2 py-0.5 text-xs rounded-md border
                        ${option === setting.default
                          ? 'bg-slate-700 text-white border-slate-600'
                          : option === setting.recommended
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                        }
                      `}
                    >
                      {option}
                      {option === setting.default && ' (default)'}
                      {option === setting.recommended && ' ★'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Default value (shown for types without simulator) */}
            {setting.type !== 'toggle' && setting.type !== 'slider' && setting.type !== 'dropdown' && setting.type !== 'action' && typeof setting.default !== 'undefined' && (
              <div className="mb-5">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Default: </span>
                <span className={`text-xs font-medium ${setting.default ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {String(setting.default)}
                </span>
              </div>
            )}

            {/* Tip Box */}
            {setting.userNote && (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">💡</span>
                  <div>
                    <span className="text-amber-400 font-semibold text-sm">Tip</span>
                    <p className="text-slate-400 text-sm mt-1">{setting.userNote}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ──── RIGHT COLUMN ──── */}
          {hasRightColumn && (
            <div className="lg:col-span-5 mt-5 lg:mt-0 space-y-4">

              {/* Alert Box — only for types not already showing status in their simulator */}
              {setting.type !== 'toggle' && setting.type !== 'slider' && getAlertBox()}

              {/* When to use */}
              {setting.useCase && (
                <div className="rounded-xl bg-slate-900/60 border border-slate-700/40 p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-base">📌</span>
                    <span className="text-sm font-semibold text-white">When to use:</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed pl-7">
                    {setting.useCase}
                  </p>
                </div>
              )}

              {/* Tradeoffs / Safety — listed out (not accordion) */}
              {setting.tradeoffs && setting.tradeoffs.length > 0 && (
                <div className="rounded-xl bg-slate-900/60 border border-slate-700/40 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-base">⚖️</span>
                    <span className="text-sm font-semibold text-white">
                      {setting.safetyLevel === 'critical' ? 'Safety Considerations' : 'Tradeoffs & Pitfalls'}
                    </span>
                  </div>
                  <ul className="space-y-2 pl-7">
                    {setting.tradeoffs.map((tradeoff, idx) => (
                      <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <span>{tradeoff}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
