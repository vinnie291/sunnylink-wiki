import PageShell from '@/components/PageShell';
import FeatureGuide from '@/components/FeatureGuide';
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

export default function FeaturesPage() {
    return (
        <PageShell>
            <div className="max-w-4xl mx-auto">
                <FeatureGuide />
            </div>
        </PageShell>
    );
}
