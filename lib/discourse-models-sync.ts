/**
 * Server-side Discourse sync for per-model topic activity.
 *
 * Each entry in data/models.json carries a forumUrl pointing at a
 * specific topic on community.sunnypilot.ai. This module pulls
 * vote/comment activity for those topics and exposes a serializable
 * snapshot the models page can render.
 *
 * Caches via Next.js fetch revalidation (7 days) — pairs with the
 * `export const revalidate = 604800` declaration on the models route.
 */

const DISCOURSE_BASE = 'https://community.sunnypilot.ai';
const REVALIDATE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const BATCH_SIZE = 6;
const BATCH_DELAY_MS = 250;
const RECENT_COMMENTS = 3;
const SNIPPET_CHARS = 220;

export interface ForumComment {
    postNumber: number;
    username: string;
    displayName: string | null;
    createdAt: string;
    likeCount: number;
    snippet: string;
}

export interface ForumActivity {
    topicId: number;
    voteCount: number; // likes on the OP (post_number === 1)
    replyCount: number; // posts_count excluding the OP
    lastPostedAt: string | null;
    recentComments: ForumComment[];
}

export type ForumActivityMap = Record<number, ForumActivity>;

/** Extract the numeric topic ID from a community.sunnypilot.ai URL. */
export function extractTopicId(forumUrl: string): number | null {
    if (!forumUrl) return null;
    // Matches /t/<slug>/<id> or /t/<id> (with or without trailing path).
    const m = forumUrl.match(/\/t\/(?:[^/]+\/)?(\d+)(?:[/?#]|$)/);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isFinite(id) ? id : null;
}

function stripHtmlToText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function snippet(html: string, max: number): string {
    const text = stripHtmlToText(html);
    if (text.length <= max) return text;
    return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DiscoursePost {
    id: number;
    post_number: number;
    username: string;
    name?: string | null;
    created_at: string;
    cooked: string;
    reply_count?: number;
    actions_summary?: { id: number; count?: number }[];
}

interface DiscourseTopicResponse {
    id: number;
    posts_count?: number;
    last_posted_at?: string | null;
    post_stream?: { posts?: DiscoursePost[] };
}

/** Discourse action id 2 = "like". */
function likesOf(post: DiscoursePost): number {
    const like = post.actions_summary?.find((a) => a.id === 2);
    return like?.count ?? 0;
}

async function fetchTopicActivity(topicId: number): Promise<ForumActivity | null> {
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(`${DISCOURSE_BASE}/t/${topicId}.json`, {
                next: { revalidate: REVALIDATE_SECONDS },
                signal: AbortSignal.timeout(15000),
            });

            if (res.status === 429) {
                const waitMs = (attempt + 1) * 2000;
                console.warn(`[discourse-models-sync] Rate limited on topic ${topicId}, waiting ${waitMs}ms (attempt ${attempt + 1})`);
                await delay(waitMs);
                continue;
            }

            if (!res.ok) {
                console.error(`[discourse-models-sync] Failed to fetch topic ${topicId}: ${res.status}`);
                return null;
            }

            const data = (await res.json()) as DiscourseTopicResponse;
            const posts = data.post_stream?.posts ?? [];
            if (posts.length === 0) return null;

            const op = posts.find((p) => p.post_number === 1) ?? posts[0];
            const replies = posts.filter((p) => p.post_number !== op.post_number);

            // Most recent N replies from whatever Discourse returned in the
            // default window (first ~20 posts). For low-traffic model topics
            // this is the entire conversation.
            const recent = [...replies]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, RECENT_COMMENTS)
                .map<ForumComment>((p) => ({
                    postNumber: p.post_number,
                    username: p.username,
                    displayName: p.name ?? null,
                    createdAt: p.created_at,
                    likeCount: likesOf(p),
                    snippet: snippet(p.cooked, SNIPPET_CHARS),
                }));

            const postsCount = data.posts_count ?? posts.length;
            return {
                topicId,
                voteCount: likesOf(op),
                replyCount: Math.max(0, postsCount - 1),
                lastPostedAt: data.last_posted_at ?? null,
                recentComments: recent,
            };
        } catch (err) {
            console.error(`[discourse-models-sync] Error fetching topic ${topicId}:`, err);
            return null;
        }
    }
    return null;
}

/**
 * Fetch activity for every unique topic ID derived from the given forum URLs.
 * Returns a map keyed by topic ID — empty map if anything goes wrong, so
 * the page still renders without forum data.
 */
export async function fetchModelForumActivity(forumUrls: string[]): Promise<ForumActivityMap> {
    const out: ForumActivityMap = {};
    const topicIds = Array.from(
        new Set(
            forumUrls
                .map(extractTopicId)
                .filter((id): id is number => id !== null),
        ),
    );

    try {
        for (let i = 0; i < topicIds.length; i += BATCH_SIZE) {
            const batch = topicIds.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(batch.map(fetchTopicActivity));
            for (const r of results) {
                if (r.status === 'fulfilled' && r.value) {
                    out[r.value.topicId] = r.value;
                }
            }
            if (i + BATCH_SIZE < topicIds.length) {
                await delay(BATCH_DELAY_MS);
            }
        }
    } catch (err) {
        console.error('[discourse-models-sync] Error fetching activity:', err);
    }

    return out;
}
