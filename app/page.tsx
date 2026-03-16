import { fetchAllDiscourseContent } from '../lib/discourse-sync';
import { mapDiscourseContent } from '../lib/discourse-mapper';
import HomeClient from '../components/HomeClient';

/**
 * Server component that fetches Discourse documentation data
 * and passes it to the client-side HomeClient component.
 * Uses ISR with 1-hour revalidation.
 */
export default async function Home() {
  let discourseSettings: Record<string, string> = {};

  try {
    const contentMap = await fetchAllDiscourseContent();
    const mapped = mapDiscourseContent(contentMap);

    // Convert Map to plain object for serialization across server→client boundary
    discourseSettings = Object.fromEntries(mapped.settings);
  } catch (err) {
    console.error('[page] Failed to fetch Discourse content:', err);
    // Graceful degradation — render with local data only
  }

  return <HomeClient discourseSettings={discourseSettings} />;
}
