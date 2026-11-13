import PageShell from '@/components/PageShell';
import FeatureGuide from '@/components/FeatureGuide';
import { fetchAllDiscourseContent } from '@/lib/discourse-sync';
import { mapDiscourseContent } from '@/lib/discourse-mapper';
import featuresData from '@/data/features.json';
import type { Metadata } from 'next';

const SITE_URL = 'https://sunnylink.wiki';
const PAGE_URL = `${SITE_URL}/features`;

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: 'Sunnypilot Features & ADAS Architecture Guide | Sunnylink Wiki',
    description: 'In-depth reference for Sunnypilot ADAS features: Always-On MADS, Neural Network Lateral Control (NNLC), Speed Limit Assist (SLA), Dynamic Lane Profile, and custom toggles.',
    keywords: [
        'sunnypilot features',
        'MADS sunnypilot',
        'Always-On MADS',
        'NNLC sunnypilot',
        'Speed Limit Assist',
        'Dynamic Lane Profile',
        'Dynamic Experimental Control',
        'openpilot features',
        'sunnylink wiki features',
    ],
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        title: 'Sunnypilot Features & ADAS Architecture Guide | Sunnylink Wiki',
        description: 'Master your Sunnypilot experience with our detailed feature guide to MADS, NNLC, SLA, and vehicle controls.',
        url: PAGE_URL,
        siteName: 'Sunnylink Wiki',
        type: 'website',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Sunnypilot Features & ADAS Architecture Guide',
        description: 'Comprehensive guide to MADS, NNLC, Speed Limit Assist, and Sunnypilot controls.',
    },
};

const featuresJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${PAGE_URL}#features-terms`,
    name: 'Sunnypilot ADAS Features & Glossary',
    description: 'Technical terminology, architecture, and feature definitions for Sunnypilot ADAS.',
    hasDefinedTerm: (featuresData.features as Array<{ id: string; name: string; fullName: string; officialDefinition?: string; userTranslation?: string }>).map(f => ({
        '@type': 'DefinedTerm',
        name: f.name,
        alternateName: f.fullName,
        description: f.userTranslation || f.officialDefinition,
        url: `${PAGE_URL}#${f.id}`,
    })),
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
        <PageShell pageHasOwnHeading>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(featuresJsonLd) }}
            />
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 id="features-guide-heading" className="text-2xl md:text-3xl font-bold text-slate-100 mb-2 leading-tight">
                        Sunnypilot Features &amp; ADAS Architecture Guide
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Detailed guide to Sunnypilot features, architecture, and capabilities. Learn how Modular Assistive Driving System (MADS), Neural Network Lateral Control (NNLC), Speed Limit Assist (SLA), and Dynamic Lane Profile optimize your driving experience.
                    </p>
                </header>
                <FeatureGuide discourseFeatures={discourseFeatures} />
            </div>
        </PageShell>
    );
}
