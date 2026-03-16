/**
 * Server-side Discourse API fetching service.
 * Uses Next.js ISR (revalidate: 3600) for 1-hour caching.
 * No API key required — public endpoints only.
 */

const DISCOURSE_BASE = 'https://community.sunnypilot.ai';
const CATEGORY_ID = 114; // Documentation category
const REVALIDATE_SECONDS = 3600; // 1 hour

export interface DiscourseTopic {
    id: number;
    title: string;
    slug: string;
    categoryId: number;
}

export interface DiscourseTopicContent {
    id: number;
    title: string;
    slug: string;
    cookedHtml: string;
}

/**
 * Fetch all topics from the Documentation category (paginated).
 */
export async function fetchDiscourseTopics(): Promise<DiscourseTopic[]> {
    const allTopics: DiscourseTopic[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const url = page === 0
                ? `${DISCOURSE_BASE}/c/documentation/${CATEGORY_ID}.json`
                : `${DISCOURSE_BASE}/c/documentation/${CATEGORY_ID}.json?page=${page}`;

            const res = await fetch(url, {
                next: { revalidate: REVALIDATE_SECONDS },
            });

            if (!res.ok) {
                console.error(`[discourse-sync] Failed to fetch topics page ${page}: ${res.status}`);
                break;
            }

            const data = await res.json();
            const topics = data?.topic_list?.topics;

            if (!topics || topics.length === 0) {
                hasMore = false;
                break;
            }

            for (const topic of topics) {
                allTopics.push({
                    id: topic.id,
                    title: topic.title,
                    slug: topic.slug,
                    categoryId: topic.category_id,
                });
            }

            // Check if there are more pages
            hasMore = !!data?.topic_list?.more_topics_url;
            page++;
        } catch (err) {
            console.error(`[discourse-sync] Error fetching topics page ${page}:`, err);
            break;
        }
    }

    return allTopics;
}

/**
 * Fetch the first post's cooked HTML for a given topic ID.
 * Includes retry logic for rate-limited requests.
 */
export async function fetchTopicContent(topicId: number): Promise<DiscourseTopicContent | null> {
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(`${DISCOURSE_BASE}/t/${topicId}.json`, {
                next: { revalidate: REVALIDATE_SECONDS },
            });

            if (res.status === 429) {
                // Rate limited — wait and retry
                const waitMs = (attempt + 1) * 2000;
                console.warn(`[discourse-sync] Rate limited on topic ${topicId}, waiting ${waitMs}ms (attempt ${attempt + 1})`);
                await delay(waitMs);
                continue;
            }

            if (!res.ok) {
                console.error(`[discourse-sync] Failed to fetch topic ${topicId}: ${res.status}`);
                return null;
            }

            const data = await res.json();
            const firstPost = data?.post_stream?.posts?.[0];

            if (!firstPost?.cooked) {
                return null;
            }

            return {
                id: data.id,
                title: data.title,
                slug: data.slug,
                cookedHtml: firstPost.cooked,
            };
        } catch (err) {
            console.error(`[discourse-sync] Error fetching topic ${topicId}:`, err);
            return null;
        }
    }

    console.error(`[discourse-sync] Exhausted retries for topic ${topicId}`);
    return null;
}

/** Simple delay helper */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch all topics AND their content in one pass.
 * Returns a map of topic title (lowercase) → cooked HTML.
 * Uses small batches with delays to respect Discourse rate limits.
 */
export async function fetchAllDiscourseContent(): Promise<Map<string, string>> {
    const contentMap = new Map<string, string>();

    try {
        const topics = await fetchDiscourseTopics();

        // Fetch topic content in small batches with delays to avoid rate limits
        const BATCH_SIZE = 3;
        const BATCH_DELAY_MS = 1000;

        for (let i = 0; i < topics.length; i += BATCH_SIZE) {
            const batch = topics.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map((topic) => fetchTopicContent(topic.id))
            );

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    contentMap.set(result.value.title.toLowerCase().trim(), result.value.cookedHtml);
                }
            }

            // Add delay between batches (skip after last batch)
            if (i + BATCH_SIZE < topics.length) {
                await delay(BATCH_DELAY_MS);
            }
        }
    } catch (err) {
        console.error('[discourse-sync] Error fetching all content:', err);
    }

    return contentMap;
}

