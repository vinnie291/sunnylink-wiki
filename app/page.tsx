import { Metadata } from 'next';
import { fetchAllDiscourseContent } from '../lib/discourse-sync';
import { mapDiscourseContent } from '../lib/discourse-mapper';
import HomeClient from '../components/HomeClient';
import togglesData from '@/data/toggles.json';

const SITE_URL = 'https://sunnylink.wiki';

export const metadata: Metadata = {
  title: 'Sunnypilot Settings Database | Sunnylink Wiki',
  description: 'Searchable database of 100+ Sunnypilot settings, toggles, parameters, defaults, and community tips. Filter by category, search by acronym, and find vehicle-specific presets.',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'Sunnypilot Settings Database | Sunnylink Wiki',
    description: 'Searchable database of 100+ Sunnypilot settings, toggles, parameters, and defaults.',
    url: SITE_URL,
    siteName: 'Sunnylink Wiki',
    type: 'website',
  },
};

const settingsJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Sunnypilot Settings and Toggles',
  description: 'Complete list of Sunnypilot settings and configuration parameters.',
  numberOfItems: togglesData.categories.reduce((acc, c) => acc + c.settings.length, 0),
  itemListElement: togglesData.categories.flatMap((cat, catIdx) =>
    cat.settings.map((s, idx) => ({
      '@type': 'ListItem',
      position: catIdx * 100 + idx + 1,
      name: s.label,
      description: s.description ?? s.label,
      url: `${SITE_URL}/#${s.key}`,
    }))
  ),
};

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
    discourseSettings = Object.fromEntries(mapped.settings);
  } catch (err) {
    console.error('[page] Failed to fetch Discourse content:', err);
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(settingsJsonLd) }}
      />
      <HomeClient discourseSettings={discourseSettings} />
    </>
  );
}
