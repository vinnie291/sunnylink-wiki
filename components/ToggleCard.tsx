'use client';
import TranslatedText from '@/components/TranslatedText';
import { useTextTranslation } from '@/lib/i18n';


import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useLanguage } from '../lib/i18n';

async function copyTextSafe(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
  return false;
}

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
  discourseHtml?: string;
  deviceAvailability?: 'full' | 'config-hidden' | 'comma-3x-only' | string;
}

interface ToggleCardProps {
  setting: ToggleSetting;
  categoryName: string;
  categoryIcon: string;
  categoryId: string;
  isHighlighted: boolean;
  onFilterCategory?: (categoryId: string) => void;
  onSelectSetting?: (key: string, shouldScroll?: boolean) => void;
}

/* ─────────────────────── Simulators ─────────────────────── */

function ToggleSimulator({ defaultValue, statusText, settingLabel }: { defaultValue: boolean; statusText?: string; settingLabel?: string }) {
  const tx = useTextTranslation();
  const [enabled, setEnabled] = useState(defaultValue);
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-6 flex flex-col items-center gap-4">
      <span className="text-sm font-bold tracking-[0.2em] text-slate-300 uppercase">
        <TranslatedText text={enabled ? t('settings.enabled') : t('settings.disabled')} />
      </span>
      <button
        onClick={() => setEnabled(!enabled)}
        className={`
          relative inline-flex h-9 w-[68px] items-center rounded-full transition-colors duration-300 cursor-pointer
          ${enabled ? 'bg-[#5b36f5]' : 'bg-slate-600'}
        `}
        role="switch"
        aria-checked={enabled}
        type="button"
        aria-label={tx(settingLabel || 'Preview toggle')}
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
          <span className="text-xs font-bold tracking-[0.15em] text-violet-400 uppercase"><TranslatedText text={statusText} /></span>
        </div>
      )}
    </div>
  );
}

function SliderSimulator({
  min,
  max,
  defaultValue,
  unit: _unit,
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
  const tx = useTextTranslation();
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
        <span className="text-sm font-bold tracking-[0.15em] text-slate-400 uppercase"><TranslatedText text={fmt(min)} /></span>
        <span className="text-xl font-bold tracking-[0.2em] text-[#5b36f5]"><TranslatedText text={fmt(value)} /></span>
        <span className="text-sm font-bold tracking-[0.15em] text-slate-400 uppercase"><TranslatedText text={fmt(max)} /></span>
      </div>

      {/* Slider row: − [track] + */}
      <div className="flex items-center gap-3">
        {/* Minus button */}
        <button
          type="button"
          onClick={() => nudge(-1)}
          className="flex-shrink-0 text-xl font-bold text-slate-400 hover:text-slate-100 transition-colors w-6 text-center select-none cursor-pointer"
          aria-label={tx(settingLabel ? `Decrease ${settingLabel}` : 'Decrease value')}
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
            aria-label={tx(settingLabel || 'Value')}
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
          type="button"
          onClick={() => nudge(1)}
          className="flex-shrink-0 text-xl font-bold text-slate-400 hover:text-slate-100 transition-colors w-6 text-center select-none cursor-pointer"
          aria-label={tx(settingLabel ? `Increase ${settingLabel}` : 'Increase value')}
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
          <span className="text-xs font-bold tracking-[0.15em] text-emerald-400 uppercase"><TranslatedText text={statusText} /></span>
        </div>
      )}
    </div>
  );
}

function DropdownSimulator({
  options,
  defaultValue,
  recommended,
  settingLabel,
}: {
  options: string[];
  defaultValue: string;
  recommended?: string;
  settingLabel?: string;
}) {
  const tx = useTextTranslation();
  const [selected, setSelected] = useState(defaultValue);

  return (
    <div className="space-y-1.5">
      {/* Option list */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-700/50 overflow-hidden">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSelected(option)}
            className={`
              w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors cursor-pointer
              ${option === selected
                ? 'text-slate-100 bg-slate-800/50'
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
              <TranslatedText text={option} />
              {option === recommended && option !== selected && (
                <span className="ml-2 text-xs text-emerald-400">★</span>
              )}
            </span>
            {option === defaultValue && (
              <span className="text-xs text-slate-500 font-medium ml-auto"><TranslatedText text={"(Default)"} /></span>
            )}
          </button>
        ))}
      </div>

      {/* Interactive Dropdown select */}
      <div className="relative rounded-xl bg-slate-900/70 border border-slate-700/50 hover:border-slate-600/70 transition-colors">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label={tx(settingLabel || 'Value')}
          className="w-full appearance-none bg-transparent px-4 py-3 pr-10 text-sm text-slate-100 outline-none cursor-pointer"
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-slate-900 text-slate-100">
              {tx(option)}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
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
  onFilterCategory,
  onSelectSetting,
}: ToggleCardProps) {
  const tx = useTextTranslation();
  const [copied, setCopied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    if (!isHighlighted) return null;
    if (setting.deepDive) return 'deepdive';
    if (setting.discourseHtml) return 'discourse';
    return null;
  });
  const [prevHighlighted, setPrevHighlighted] = useState(Boolean(isHighlighted));
  if (Boolean(isHighlighted) !== prevHighlighted) {
    setPrevHighlighted(Boolean(isHighlighted));
    if (isHighlighted) {
      if (setting.deepDive) {
        setExpandedSection((prev) => prev ?? 'deepdive');
      } else if (setting.discourseHtml) {
        setExpandedSection((prev) => prev ?? 'discourse');
      }
    }
  }
  const [deviceNoteOpen, setDeviceNoteOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const handleCopyLink = async () => {
    const encodedKey = encodeURIComponent(setting.key);
    const url = `${window.location.origin}${window.location.pathname}?setting=${encodedKey}#${encodedKey}`;
    const ok = await copyTextSafe(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    try {
      window.history.replaceState(null, '', `?setting=${encodedKey}#${encodedKey}`);
    } catch {
      // Ignore history state errors in restricted webviews
    }
    onSelectSetting?.(setting.key, false);
  };

  const handleReportIssue = () => {
    const title = encodeURIComponent(`Issue with ${setting.label}`);
    const body = encodeURIComponent(`Flagged from section: ${categoryName}\n\nDescribe the issue here:`);
    const issueUrl = `https://github.com/vinnie291/sunnylink-wiki/issues/new?title=${title}&body=${body}`;
    try {
      window.open(issueUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Ignore popup blockers
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleTitleOrCardAction = () => {
    if (setting.deepDive) {
      setExpandedSection((prev) => (prev === 'deepdive' ? null : 'deepdive'));
    } else if (setting.discourseHtml) {
      setExpandedSection((prev) => (prev === 'discourse' ? null : 'discourse'));
    }
    onSelectSetting?.(setting.key, false);
  };

  const handleCardSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('button, a, input, select, textarea, label, [role="switch"]')) return;
    if (typeof window !== 'undefined' && (window.getSelection()?.toString().length ?? 0) > 0) return;
    handleTitleOrCardAction();
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
          <span className="text-emerald-400 text-sm font-medium"><TranslatedText text={setting.helpText} /></span>
        </div>
      );
    }
    if (setting.type === 'toggle') {
      const statusText = setting.helpText
        ? setting.helpText
        : `${t('settings.default')}: ${setting.default ? t('settings.on') : t('settings.off')}${setting.recommended !== undefined
          ? ` · ${t('settings.recommended')}: ${typeof setting.recommended === 'boolean' ? (setting.recommended ? t('settings.on') : t('settings.off')) : setting.recommended}`
          : ''
        }`;
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <svg className="w-5 h-5 text-violet-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-violet-400 text-sm font-medium"><TranslatedText text={statusText} /></span>
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
          <span className="text-violet-400 text-sm font-medium">{t('settings.default')}: <TranslatedText text={defaultLabel} /></span>
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
          <span className="text-cyan-400 text-sm font-medium"><TranslatedText text={setting.helpText} /></span>
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
      parts.push(`${t('settings.default')}: ${setting.default ? t('settings.on') : t('settings.off')}`);
      if (setting.recommended !== undefined) {
        parts.push(`${t('settings.recommended')}: ${typeof setting.recommended === 'boolean' ? (setting.recommended ? t('settings.on') : t('settings.off')) : setting.recommended}`);
      }
      return parts.join(' · ');
    }
    if (setting.type === 'slider' && setting.helpText) return setting.helpText;
    if (setting.type === 'dropdown') {
      const defaultLabel = setting.default ? String(setting.default) : 'Not set';
      return `${t('settings.default')}: ${defaultLabel}`;
    }
    return undefined;
  };

  const renderSimulator = () => {
    switch (setting.type) {
      case 'toggle':
        return <ToggleSimulator defaultValue={setting.default === true} statusText={getSimulatorStatusText()} settingLabel={setting.label} />;
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
              settingLabel={setting.label}
            />
          );
        }
        return null;
      default:
        return null;
    }
  };

  const simulatorNode = renderSimulator();
  const alertBoxNode = getAlertBox();
  const hasRightColumn = setting.type === 'toggle' || setting.type === 'slider' || (setting.type === 'dropdown' && setting.options) || setting.useCase || alertBoxNode || (setting.tradeoffs && setting.tradeoffs.length > 0);

  return (
    <div
      ref={cardRef}
      id={setting.key}
      data-setting-key={setting.key}
      onClick={handleCardSurfaceClick}
      className={`
        relative group rounded-2xl border transition-colors duration-200 ease-out scroll-mt-32
        ${isHighlighted
          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-500/30 animate-highlight'
          : 'bg-slate-800/80 border-slate-700/50 hover:bg-slate-800/90 hover:border-slate-600/50'
        }
      `}
    >
      {setting.key === 'AdjustCameraOffset' && (
        <>
          <span id="CameraOffset" className="sr-only" />
          <span id="camera-offset" className="sr-only" />
        </>
      )}
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative p-5 lg:p-7">

        {/* ──── HEADER: Full Width ──── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          {/* Left: Badge + Title + Category */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border select-none ${getTypeBadgeStyle(setting.type)}`}>
                <TranslatedText text={getTypeBadgeLabel(setting.type)} />
              </span>
              {setting.recommended && (
                onFilterCategory ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFilterCategory('recommended');
                    }}
                    title={tx('Recommended')}
                    className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                  >
                    ★ {t('settings.recommended')}
                  </button>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 select-none">
                    ★ {t('settings.recommended')}
                  </span>
                )
              )}
              {setting.safetyLevel === 'critical' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 select-none">
                  ⚠️ {t('settings.critical')}
                </span>
              )}
              {setting.safetyLevel === 'safe' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 select-none">
                  ✓ {t('settings.safe')}
                </span>
              )}
              {setting.deviceAvailability === 'comma-3x-only' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeviceNoteOpen((prev) => !prev);
                  }}
                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors cursor-pointer"
                  title={tx("Supported on comma 3X/3 only. Not supported on comma four screen or UI.")}
                >
                  <TranslatedText text={"comma 3X/3 only"} />
                </button>
              )}
              {setting.deviceAvailability === 'config-hidden' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeviceNoteOpen((prev) => !prev);
                  }}
                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-colors cursor-pointer"
                  title={tx("Supported on all devices. comma four users configure via sunnylink.")}
                >
                  <TranslatedText text={"comma four via sunnylink"} />
                </button>
              )}
            </div>
            {deviceNoteOpen && (
              <p className="mb-2 rounded-lg border border-sky-500/25 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300">
                <TranslatedText
                  text={
                    setting.deviceAvailability === 'comma-3x-only'
                      ? 'Supported on comma 3X/3 only. Not supported on comma four screen or UI.'
                      : 'Supported on all devices. comma four users configure via sunnylink.'
                  }
                />
              </p>
            )}
            <h2 className="text-xl lg:text-2xl font-bold text-slate-100 leading-tight">
              <a
                href={`/?setting=${encodeURIComponent(setting.key)}#${encodeURIComponent(setting.key)}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTitleOrCardAction();
                }}
                className="text-left hover:text-cyan-400 transition-colors inline-flex items-center gap-2"
                title={tx(setting.label)}
              >
                <span><TranslatedText text={setting.label} /></span>
                <span className="text-sm text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity font-mono">#</span>
              </a>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5">
              {onFilterCategory && categoryId ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterCategory(categoryId);
                  }}
                  className="inline-flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer"
                  title={tx(categoryName)}
                >
                  <span><TranslatedText text={categoryIcon} /></span>
                  <span><TranslatedText text={categoryName} /></span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <span><TranslatedText text={categoryIcon} /></span>
                  <span><TranslatedText text={categoryName} /></span>
                </div>
              )}
              <span className="text-slate-600">•</span>
              <span className="font-mono text-[11px] text-slate-500">{setting.key}</span>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* Flag */}
              <button
                type="button"
                onClick={handleReportIssue}
                className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-200 cursor-pointer"
                title={tx("Flag this setting")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
              </button>
              {/* Share */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-200 cursor-pointer"
                title={tx(copied ? "Copied!" : "Share this setting")}
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
              aria-label={tx(`${t('settings.viewInSunnylink')}: ${setting.label}`)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#5b36f5] text-white hover:bg-[#4a2bd0] transition-all duration-200 flex items-center gap-1.5 shadow-lg shadow-[#5b36f5]/25 whitespace-nowrap"
            >
              <span>{t('settings.viewInSunnylink')}</span>
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
              <TranslatedText text={setting.description} />
            </p>

            {/* Official Discourse Documentation */}
            {setting.discourseHtml && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => toggleSection('discourse')}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors w-full text-left cursor-pointer"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedSection === 'discourse' ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium"><TranslatedText text={"📄 Official Documentation"} /></span>
                </button>
                {expandedSection === 'discourse' && (
                  <div className="mt-3 ml-6 p-4 rounded-lg bg-slate-900/50 border border-slate-700/30">
                    <div
                      className="discourse-content text-sm text-slate-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(setting.discourseHtml) }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Warning */}
            {setting.warning && (
              <div className="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-400 text-sm">
                  <span className="font-semibold">⚠️ {t('settings.warning')}:</span> <TranslatedText text={setting.warning} />
                </p>
              </div>
            )}

            {/* Dependencies */}
            {setting.dependencies && setting.dependencies.length > 0 && (
              <div className="inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-5">
                <span className="text-amber-400 text-xs">🔗</span>
                <span className="text-amber-400 text-xs font-medium">
                  <TranslatedText text={"Requires:"} />
                </span>
                {setting.dependencies.map((dep, idx) => (
                  <a
                    key={dep.key}
                    href={`/?setting=${encodeURIComponent(dep.key)}#${encodeURIComponent(dep.key)}`}
                    onClick={(e) => {
                      if (onSelectSetting) {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectSetting(dep.key, true);
                      }
                    }}
                    className="text-amber-300 hover:text-cyan-300 underline decoration-amber-400/50 hover:decoration-cyan-300 text-xs font-semibold transition-colors"
                    title={tx(dep.label)}
                  >
                    <TranslatedText text={dep.label} />
                    {idx < setting.dependencies!.length - 1 ? ',' : ''}
                  </a>
                ))}
              </div>
            )}

            {/* Collapsible: Deep Dive (stays as accordion under description) */}
            {setting.deepDive && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={() => toggleSection('deepdive')}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors w-full text-left cursor-pointer"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedSection === 'deepdive' ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium">🔬 {t('settings.technicalDeepDive')}</span>
                </button>
                {expandedSection === 'deepdive' && (
                  <div className="mt-3 ml-6 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                    <p className="text-sm text-slate-400 font-mono leading-relaxed">
                      <TranslatedText text={setting.deepDive} />
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Control Simulator — placed under description / deep dive */}
            {simulatorNode && (
              <div className="mb-5">
                {simulatorNode}
              </div>
            )}

            {/* Options for dropdown without option-list simulator */}
            {setting.options && setting.type !== 'dropdown' && (
              <div className="mb-5">
                <span className="text-xs text-slate-400 uppercase tracking-wide">{t('settings.options')}:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {setting.options.map((option) => (
                    <span
                      key={option}
                      className={`
                        px-2 py-0.5 text-xs rounded-md border
                        ${option === setting.default
                          ? 'bg-slate-700 text-slate-100 border-slate-600'
                          : option === setting.recommended
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                        }
                      `}
                    >
                      <TranslatedText text={option} />
                      {option === setting.default && ` (${t('settings.default')})`}
                      {option === setting.recommended && ' ★'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Default value (shown for types without simulator) */}
            {setting.type !== 'toggle' && setting.type !== 'slider' && setting.type !== 'dropdown' && setting.type !== 'action' && typeof setting.default !== 'undefined' && (
              <div className="mb-5">
                <span className="text-xs text-slate-400 uppercase tracking-wide">{t('settings.default')}: </span>
                <span className={`text-xs font-medium ${setting.default ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <TranslatedText text={String(setting.default)} />
                </span>
              </div>
            )}

            {/* Tip Box */}
            {setting.userNote && (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">💡</span>
                  <div>
                    <span className="text-amber-400 font-semibold text-sm">{t('settings.tip')}</span>
                    <p className="text-slate-400 text-sm mt-1"><TranslatedText text={setting.userNote} /></p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ──── RIGHT COLUMN ──── */}
          {hasRightColumn && (
            <div className="lg:col-span-5 mt-5 lg:mt-0 space-y-4">

              {/* Alert Box — only for types not already showing status in their simulator */}
              {setting.type !== 'toggle' && setting.type !== 'slider' && alertBoxNode}

              {/* When to use */}
              {setting.useCase && (
                <div className="rounded-xl bg-slate-900/60 border border-slate-700/40 p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-base">📌</span>
                    <span className="text-sm font-semibold text-slate-100">{t('settings.whenToUse')}:</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed pl-7">
                    <TranslatedText text={setting.useCase} />
                  </p>
                </div>
              )}

              {/* Tradeoffs / Safety — listed out (not accordion) */}
              {setting.tradeoffs && setting.tradeoffs.length > 0 && (
                <div className="rounded-xl bg-slate-900/60 border border-slate-700/40 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-base">⚖️</span>
                    <span className="text-sm font-semibold text-slate-100">
                      <TranslatedText text={setting.safetyLevel === 'critical' ? t('settings.safetyConsiderations') : t('settings.tradeoffsPitfalls')} />
                    </span>
                  </div>
                  <ul className="space-y-2 pl-7">
                    {setting.tradeoffs.map((tradeoff, idx) => (
                      <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <span><TranslatedText text={tradeoff} /></span>
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
