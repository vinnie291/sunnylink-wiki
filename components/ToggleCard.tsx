'use client';

import { useState, useEffect, useRef } from 'react';


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
  categoryId: string;
  isHighlighted: boolean;
}

export default function ToggleCard({
  setting,
  categoryName,
  categoryIcon,
  categoryId,
  isHighlighted
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
      case 'models':
        return `${baseUrl}/models#${slug}`;
      case 'device':
        return `${baseUrl}/settings/device#${slug}`;
      case 'toggles':
        return `${baseUrl}/settings/toggles#${slug}`;
      case 'steering':
        return `${baseUrl}/settings/steering#${slug}`;
      case 'cruise':
        return `${baseUrl}/settings/cruise#${slug}`;
      case 'visuals':
        return `${baseUrl}/settings/visuals#${slug}`;
      case 'developer':
        return `${baseUrl}/settings/developer#${slug}`;
      case 'other':
        return `${baseUrl}/settings/other#${slug}`;
      default:
        return `${baseUrl}/settings/device#${slug}`;
    }
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
          <div className="mb-3 sm:pr-[280px]">
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

          {/* Action Buttons - Bottom on Mobile, Top Right on Desktop */}
          <div className="flex items-center mt-6 pt-4 border-t border-slate-700/50 w-full justify-between sm:absolute sm:top-5 sm:right-5 sm:mt-0 sm:pt-0 sm:border-0 sm:w-auto sm:justify-end">
            {/* Flag Button - Left on mobile */}
            <button
              onClick={handleReportIssue}
              className="p-2 rounded-lg text-slate-500 border border-transparent hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-200"
              title="Flag this setting"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>

            {/* Right Group: Copy & View - Grouped on mobile */}
            <div className="flex items-center gap-2">
              {/* Share Link Button */}
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg text-slate-500 border border-transparent hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all duration-200"
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

              {/* Sunnylink Dashboard Button */}
              <a
                href={getSunnylinkUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  px-3 py-1.5 rounded-lg text-sm font-medium 
                  bg-[#5b36f5] text-white hover:bg-[#4a2bd0] 
                  transition-all duration-200 flex items-center gap-1.5 
                  shadow-lg shadow-[#5b36f5]/25
                "
              >
                <span>View in sunnylink</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>


    </>
  );
}
