'use client';

interface Category {
    id: string;
    name: string;
    icon: string;
    count: number;
}

interface CategoryFilterProps {
    categories: Category[];
    activeCategories: string[];
    onToggleCategory: (categoryId: string) => void;
    onClearAll: () => void;
}

export default function CategoryFilter({
    categories,
    activeCategories,
    onToggleCategory,
    onClearAll
}: CategoryFilterProps) {
    const isAllActive = activeCategories.length === 0;
    const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 uppercase tracking-wider font-medium">Categories</span>
                {!isAllActive && (
                    <button
                        onClick={onClearAll}
                        className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                        Show all
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {/* All Button */}
                <button
                    onClick={onClearAll}
                    className={`
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
            transition-all duration-200 border
            ${isAllActive
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                        }
          `}
                >
                    <span>🏠</span>
                    <span>All</span>
                    <span className={`
            px-1.5 py-0.5 rounded-md text-xs
            ${isAllActive ? 'bg-cyan-500/30' : 'bg-slate-700/50'}
          `}>
                        {totalCount}
                    </span>
                </button>

                {/* Category Buttons */}
                {categories.map((category) => {
                    const isActive = activeCategories.includes(category.id);
                    return (
                        <button
                            key={category.id}
                            onClick={() => onToggleCategory(category.id)}
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                transition-all duration-200 border
                ${isActive
                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                                }
              `}
                        >
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
                            <span className={`
                px-1.5 py-0.5 rounded-md text-xs
                ${isActive ? 'bg-cyan-500/30' : 'bg-slate-700/50'}
              `}>
                                {category.count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
