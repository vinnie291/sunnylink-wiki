/**
 * Confidence-weighted ranking (Bayesian average) for /models and /cars.
 *
 * A raw average lets a 5.0 from one review outrank a 4.6 from 25 reviews and
 * thousands of recorded routes. Shrinking each item toward the global mean by
 * its effective sample size fixes that: few observations ≈ the global mean,
 * many observations ≈ the item's own rating.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Mean star rating assumed when a dataset's real mean is unknown. */
export const DEFAULT_GLOBAL_MEAN_RATING = 4.1;
export const DEFAULT_MIN_CONFIDENCE_THRESHOLD = 5;

/** Weight a route-volume count contributes, on the same scale as one review. */
export function routeConfidenceWeight(routeCount: number): number {
    return Math.log10(Math.max(1, routeCount || 0)) * 0.75;
}

/** Effective sample weight: reviews plus log-scaled route telemetry. */
export function effectiveSampleWeight(reviewCount: number, routeCount: number): number {
    return Math.max(0, reviewCount || 0) + routeConfidenceWeight(routeCount);
}

/**
 * Calculates a confidence-weighted Bayesian score combining review ratings and route telemetry volume.
 * @param rating Average star rating for the item (1-5)
 * @param reviewCount Number of user reviews (v)
 * @param routeCount Number of logged sunnylink routes
 * @param globalMeanRating Mean rating across all models/cars (C, default ~4.1)
 * @param minConfidenceThreshold Minimum effective sample weight (m, default 5)
 */
export function calculateConfidenceScore(
    rating: number,
    reviewCount: number,
    routeCount: number,
    globalMeanRating = DEFAULT_GLOBAL_MEAN_RATING,
    minConfidenceThreshold = DEFAULT_MIN_CONFIDENCE_THRESHOLD,
): number {
    const effectiveWeight = effectiveSampleWeight(reviewCount, routeCount);
    const denominator = effectiveWeight + minConfidenceThreshold;
    if (denominator <= 0) return globalMeanRating;
    return (
        (effectiveWeight / denominator) * rating
        + (minConfidenceThreshold / denominator) * globalMeanRating
    );
}

/** Weighted mean rating across items, ignoring items with no reviews. */
export function computeGlobalMean(
    items: { rating: number; reviewCount: number }[],
    fallback = DEFAULT_GLOBAL_MEAN_RATING,
): number {
    let weight = 0;
    let sum = 0;
    for (const item of items) {
        if (item.reviewCount > 0 && Number.isFinite(item.rating)) {
            weight += item.reviewCount;
            sum += item.rating * item.reviewCount;
        }
    }
    return weight > 0 ? sum / weight : fallback;
}

export interface ConfidenceInfo {
    level: ConfidenceLevel;
    /** Effective sample weight used for the level. */
    weight: number;
    reviewCount: number;
    routeCount: number;
    /** Short pill text, e.g. "High Confidence • 8.4k routes". */
    label: string;
    /** Longer explanation for tooltips / aria-label. */
    description: string;
}

const HIGH_WEIGHT = 15;
const MEDIUM_WEIGHT = 6;

function compactCount(n: number): string {
    if (n >= 10000) return `${Math.round(n / 1000)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString('en-US');
}

/** Describes how battle-tested an entry is for the Confidence / Sample Size pill. */
export function getConfidenceInfo(reviewCount: number, routeCount: number): ConfidenceInfo {
    const reviews = Math.max(0, Math.round(reviewCount || 0));
    const routes = Math.max(0, Math.round(routeCount || 0));
    const weight = effectiveSampleWeight(reviews, routes);
    const level: ConfidenceLevel = weight >= HIGH_WEIGHT ? 'high' : weight >= MEDIUM_WEIGHT ? 'medium' : 'low';

    const evidence: string[] = [];
    if (routes > 0) evidence.push(`${compactCount(routes)} routes`);
    if (reviews > 0 || routes === 0) evidence.push(`${compactCount(reviews)} ${reviews === 1 ? 'review' : 'reviews'}`);

    const prefix = level === 'high' ? 'High Confidence' : level === 'medium' ? 'Medium Confidence' : 'Low Sample';
    // Low-sample entries lead with the weakest evidence so the warning reads clearly.
    const detail = level === 'low' && reviews > 0 ? evidence.slice().reverse().join(' • ') : evidence.join(' • ');

    return {
        level,
        weight,
        reviewCount: reviews,
        routeCount: routes,
        label: `${prefix} • ${detail}`,
        description: `Confidence-weighted ranking: ${reviews} review${reviews === 1 ? '' : 's'} and ${routes.toLocaleString('en-US')} recorded routes. Entries with little evidence are pulled toward the overall average.`,
    };
}

export const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
    high: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    medium: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
    low: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
};

/** Maps a 0-100 community score onto the 1-5 star scale used by the ranking. */
export function scoreToStars(score: number): number {
    return 1 + (Math.min(100, Math.max(0, score)) / 100) * 4;
}
