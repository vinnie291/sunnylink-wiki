import PageShell from '@/components/PageShell';
import FeatureGuide from '@/components/FeatureGuide';
import { fetchAllDiscourseContent } from '@/lib/discourse-sync';
import { mapDiscourseContent } from '@/lib/discourse-mapper';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Feature Guide | Sunnylink',
    description: 'Detailed guide to Sunnypilot features. Learn about Always-On MADS, Dynamic Lane Profile, and more.',
    keywords: ['sunnylink', 'sunnylink features', 'sunnypilot', 'sunnypilot features', 'sunnypilot wiki', 'sunnylink app', 'sunnypilot settings', 'sunnypilot sunnylink', 'sunnylink sunnypilot latest version', 'MADS', 'Dynamic Lane Profile'],
    openGraph: {
        title: 'Sunnylink Feature Guide',
        description: 'Master your Sunnypilot experience with our detailed feature guide.',
    }
};

export default async function FeaturesPage() {
    let discourseFeatures: Record<string, string> = {};

    try {
        const contentMap = await fetchAllDiscourseContent();
        const mapped = mapDiscourseContent(contentMap);
        discourseFeatures = Object.fromEntries(mapped.features);
    } catch (err) {
        console.error('[features] Failed to fetch Discourse content:', err);
    }

    return (
        <PageShell>
            <div className="max-w-4xl mx-auto">
                <FeatureGuide discourseFeatures={discourseFeatures} />
            </div>
        </PageShell>
    );
}
