'use client';

import { useState, useEffect, useRef } from 'react';
import FlagFeedback from './FlagFeedback';

interface ToggleSetting {
  key: string;
  label: string;
  type: string;
  options?: string[];
  default: boolean | string | number;
  description: string;
  recommended?: boolean | string;
  warning?: string;
  userNote?: string;
  safetyLevel?: 'safe' | 'critical';
  useCase?: string;
  tradeoffs?: string[];
  deepDive?: string;
}

interface ToggleCardProps {
  setting: ToggleSetting;
  categoryName: string;
  categoryIcon: string;
  isHighlighted: boolean;
}

export default function ToggleCard({
  setting,
  categoryName,
  categoryIcon,
  isHighlighted
}: ToggleCardProps) {
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
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

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getTypeColor = (type: string) => {
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

  const getSafetyBadge = () => {
    if (setting.safetyLevel === 'critical') {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
          ⚠️ Critical
        </span>
      );
    }
    if (setting.safetyLevel === 'safe') {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          ✓ Safe
        </span>
      );
    }
    return null;
  };

  const hasAdvancedInfo = setting.useCase || setting.tradeoffs || setting.deepDive;

  return (
    <>
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

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getTypeColor(setting.type)}`}>
                  {setting.type}
                </span>
                {setting.recommended && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ★ Recommended
                  </span>
                )}
                {getSafetyBadge()}
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                {setting.label}
              </h3>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Flag Button */}
              <button
                onClick={() => setShowFeedback(true)}
                className="p-2 rounded-lg text-slate-500 border border-transparent hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-200"
                title="Flag this setting"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
              </button>

              {/* Copy Link Button */}
              <button
                onClick={handleCopyLink}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${copied
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/50 hover:bg-slate-700 hover:text-white'
                  }
                `}
              >
                {copied ? '✓ Copied!' : '🔗 Copy'}
              </button>
            </div>
          </div>

          {/* Category Tag */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <span>{categoryIcon}</span>
            <span>{categoryName}</span>
          </div>

          {/* Description */}
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            {setting.description}
          </p>

          {/* Use Case - Always Visible if exists */}
          {setting.useCase && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-emerald-400 text-sm">
                <span className="font-semibold">📌 When to use:</span> {setting.useCase}
              </p>
            </div>
          )}

          {/* Options for dropdown/slider */}
          {setting.options && (
            <div className="mb-4">
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

          {/* Default value for toggles */}
          {setting.type === 'toggle' && (
            <div className="mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Default: </span>
              <span className={`text-xs font-medium ${setting.default ? 'text-emerald-400' : 'text-slate-400'}`}>
                {setting.default ? 'ON' : 'OFF'}
              </span>
              {setting.recommended !== undefined && (
                <>
                  <span className="text-xs text-slate-600 mx-2">•</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Recommended: </span>
                  <span className="text-xs font-medium text-emerald-400">
                    {typeof setting.recommended === 'boolean' ? (setting.recommended ? 'ON' : 'OFF') : setting.recommended}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Warning */}
          {setting.warning && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-amber-400 text-sm">
                <span className="font-semibold">⚠️ Warning:</span> {setting.warning}
              </p>
            </div>
          )}

          {/* Tradeoffs - Expandable */}
          {setting.tradeoffs && setting.tradeoffs.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => toggleSection('tradeoffs')}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full text-left"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${expandedSection === 'tradeoffs' ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">⚖️ Tradeoffs & Pitfalls</span>
                <span className="text-xs text-slate-600">({setting.tradeoffs.length})</span>
              </button>
              {expandedSection === 'tradeoffs' && (
                <ul className="mt-2 ml-6 space-y-1.5">
                  {setting.tradeoffs.map((tradeoff, idx) => (
                    <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                      <span className="text-rose-400 mt-1">•</span>
                      <span>{tradeoff}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Deep Dive - Expandable */}
          {setting.deepDive && (
            <div className="mb-4">
              <button
                onClick={() => toggleSection('deepdive')}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full text-left"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${expandedSection === 'deepdive' ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">🔬 Technical Deep Dive</span>
              </button>
              {expandedSection === 'deepdive' && (
                <div className="mt-2 ml-6 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                  <p className="text-sm text-slate-400 font-mono leading-relaxed">
                    {setting.deepDive}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* User Note */}
          {setting.userNote && (
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
              <p className="text-slate-400 text-sm">
                <span className="text-cyan-400 font-medium">💡 Tip:</span> {setting.userNote}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedback && (
        <FlagFeedback
          settingKey={setting.key}
          settingLabel={setting.label}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </>
  );
}
