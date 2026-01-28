'use client';

interface EmptyStateProps {
    searchQuery: string;
    onClearSearch: () => void;
}

export default function EmptyState({ searchQuery, onClearSearch }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            {/* Illustration */}
            <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                    <svg
                        className="w-12 h-12 text-slate-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </div>
                {/* Decorative rings */}
                <div className="absolute inset-0 -m-2 rounded-full border border-slate-700/30 animate-pulse" />
                <div className="absolute inset-0 -m-4 rounded-full border border-slate-700/20" />
            </div>

            {/* Message */}
            <h3 className="text-xl font-semibold text-white mb-2">
                No toggles found
            </h3>
            <p className="text-slate-400 mb-6 max-w-md">
                We couldn&apos;t find any toggles matching &quot;<span className="text-cyan-400 font-medium">{searchQuery}</span>&quot;.
                Try a different search term or browse all categories.
            </p>

            {/* Suggestions */}
            <div className="mb-6">
                <p className="text-sm text-slate-500 mb-3">Try searching for:</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {['MADS', 'lane', 'speed', 'alert'].map((suggestion) => (
                        <button
                            key={suggestion}
                            onClick={() => {
                                // This would need to be passed up, for now just clear
                            }}
                            className="px-3 py-1.5 rounded-lg text-sm bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-white transition-all"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            </div>

            {/* Clear Button */}
            <button
                onClick={onClearSearch}
                className="
          px-6 py-3 rounded-xl font-medium
          bg-gradient-to-r from-cyan-500 to-cyan-600
          text-white shadow-lg shadow-cyan-500/25
          hover:from-cyan-400 hover:to-cyan-500
          transition-all duration-200
          transform hover:scale-105
        "
            >
                Clear Search & Show All
            </button>
        </div>
    );
}
