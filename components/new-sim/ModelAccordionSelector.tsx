'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { MODEL_CATEGORIES, getModelProfile, type ModelCategoryGroup } from '@/lib/new-sim/modelProfiles';
import styles from './ModelAccordionSelector.module.css';

interface ModelAccordionSelectorProps {
  activeModelId?: string;
  onSelectModel: (modelId: string) => void;
}

const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'chestnut_gpu', label: 'GPU' },
  { id: 'world_2026', label: 'WMI 2026' },
  { id: 'aggressive_exp', label: 'Aggressive' },
  { id: 'comfort', label: 'Comfort' },
  { id: 'tomb_raider', label: 'Tomb Raider' },
  { id: 'legacy', label: 'Legacy' },
];

const curvePace = (patience: number) => (patience > 2.4 ? 'Spirited' : patience < 1.8 ? 'Cautious' : 'Balanced');

export default function ModelAccordionSelector({ activeModelId, onSelectModel }: ModelAccordionSelectorProps) {
  const activeModel = useMemo(() => getModelProfile(activeModelId), [activeModelId]);
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set([activeModel.category]));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const listRef = useRef<HTMLDivElement>(null);
  const query = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (activeModel?.category) {
      setOpenCategories(prev => {
        if (prev.has(activeModel.category)) return prev;
        const next = new Set(prev);
        next.add(activeModel.category);
        return next;
      });
    }
  }, [activeModel?.category]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (!next.delete(categoryId)) next.add(categoryId);
      return next;
    });
  };

  const filteredCategories = useMemo(() => {
    return MODEL_CATEGORIES.map(group => {
      if (activeFilter !== 'all' && group.id !== activeFilter) return null;
      if (!query) return group;
      const groupMatches = group.name.toLowerCase().includes(query) || group.description.toLowerCase().includes(query);
      const models = group.models.filter(model => groupMatches
        || model.name.toLowerCase().includes(query)
        || model.tags.some(tag => tag.toLowerCase().includes(query))
        || model.steeringFeel.toLowerCase().includes(query)
        || model.bestFor.toLowerCase().includes(query)
        || model.badge?.toLowerCase().includes(query)
        || model.consensus.toLowerCase().includes(query)
        || model.testedOn?.some(vehicle => vehicle.toLowerCase().includes(query)));
      return models.length ? { ...group, models } : null;
    }).filter((group): group is ModelCategoryGroup => group !== null);
  }, [query, activeFilter]);

  const matchCount = filteredCategories.reduce((total, category) => total + category.models.length, 0);

  return (
    <div className={styles.container}>
      {/* What is driving right now, in one line of traits. */}
      <div className={styles.active}>
        <div className={styles.activeTop}>
          <span className={styles.dot} style={{ backgroundColor: activeModel.pathColor }} />
          <strong>{activeModel.name}</strong>
          <span className={styles.score}>{activeModel.communityScore}</span>
        </div>
        <p className={styles.activeTraits}>
          {activeModel.headway.toFixed(1)}s gap
          <i /> {curvePace(activeModel.lateralPatience)} curves
          <i /> {activeModel.steeringFeel} steering
        </p>
      </div>

      <div className={styles.search}>
        <Search size={13} />
        <input
          type="text"
          placeholder={`Search ${matchCount} models`}
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
          aria-label="Search models"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
            <X size={12} />
          </button>
        )}
      </div>

      <div className={styles.filters} role="tablist" aria-label="Model series">
        {QUICK_FILTERS.map(chip => (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={activeFilter === chip.id}
            className={activeFilter === chip.id ? styles.filterActive : ''}
            onClick={() => {
              setActiveFilter(chip.id);
              // Picking a series should show its models, not leave the one
              // matching category collapsed behind a second tap.
              if (chip.id !== 'all') setOpenCategories(prev => new Set(prev).add(chip.id));
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className={styles.list} ref={listRef}>
        {filteredCategories.length === 0 ? (
          <div className={styles.empty}>
            <p>Nothing matches “{searchQuery}”.</p>
            <button type="button" onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}>Reset</button>
          </div>
        ) : (
          filteredCategories.map(category => {
            // A search opens whatever it matched, without writing to state.
            const isOpen = query ? true : openCategories.has(category.id);
            return (
              <section key={category.id} className={styles.category}>
                <button
                  type="button"
                  className={styles.categoryHeader}
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={isOpen}
                >
                  <span className={styles.categoryIcon}>{category.icon}</span>
                  <span className={styles.categoryName}>{category.name}</span>
                  <span className={styles.count}>{category.models.length}</span>
                  <ChevronDown size={13} className={isOpen ? styles.chevronOpen : ''} />
                </button>

                {isOpen && (
                  <div className={styles.rows} role="listbox" aria-label={category.name}>
                    {category.models.map(model => {
                      const selected = model.id === activeModel.id;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          data-model-id={model.id}
                          className={`${styles.row} ${selected ? styles.rowActive : ''}`}
                          onClick={() => onSelectModel(model.id)}
                        >
                          <span className={styles.dot} style={{ backgroundColor: model.pathColor }} />
                          <span className={styles.rowBody}>
                            <span className={styles.rowTop}>
                              <b>{model.name}</b>
                              {model.badge && <em>{model.badge}</em>}
                              <span className={styles.score}>{model.communityScore}</span>
                            </span>
                            <span className={styles.rowTraits}>
                              {model.bestFor}
                              <i /> {model.headway.toFixed(1)}s
                              <i /> {curvePace(model.lateralPatience)}
                              <i /> {model.comfortDecel < -2.8 ? 'Firm' : 'Gliding'} braking
                            </span>
                            {selected && (
                              <span className={styles.rowNote}>
                                {model.consensus}
                                {model.testedOn?.length ? ` · Tested on ${model.testedOn[0]}${model.testedOn.length > 1 ? ` +${model.testedOn.length - 1}` : ''}` : ''}
                              </span>
                            )}
                          </span>
                          {selected && <Check size={13} className={styles.rowCheck} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
