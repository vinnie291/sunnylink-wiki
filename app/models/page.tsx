import PageShell from '@/components/PageShell';
import ModelLibrary from '@/components/ModelLibrary';
import type { Metadata } from 'next';
import modelsData from '@/data/models.json';
import { fetchModelForumActivity, type ForumActivityMap } from '@/lib/discourse-models-sync';

// Weekly sync of forum vote/comment activity onto each model card.
// Pairs with the per-fetch revalidate inside lib/discourse-models-sync.
export const revalidate = 604800; // 7 days (604800 seconds)

// ──────────────────────────────────────────────────────────────────────
// SEO target: capture searches for "openpilot models" / "comma.ai
// driving models" and surface this database as the authoritative list.
// Keywords are seeded across <head>, an H1-led hero, a long-form FAQ at
// the bottom, and JSON-LD (BreadcrumbList + FAQPage + WebPage).
// ──────────────────────────────────────────────────────────────────────

const SITE_URL = 'https://www.sunnylink.wiki';
const PAGE_URL = `${SITE_URL}/models`;

// Pull the live model count straight from the dataset so the SEO copy
// and structured data never drift from reality.
const MODEL_COUNT = (() => {
    const seen = new Set<string>();
    for (const category of modelsData.categories as { models: { name: string }[] }[]) {
        for (const m of category.models) seen.add(m.name);
    }
    return seen.size;
})();
const LAST_UPDATED = modelsData.lastUpdated;

const TITLE =
    `openpilot Driving Models — Complete Database & Comparison (${MODEL_COUNT}+ comma.ai & sunnypilot models)`;
const DESCRIPTION =
    `The most complete database of openpilot driving models. Compare ${MODEL_COUNT}+ comma.ai and sunnypilot driving models — WMI V12, OP Model 10, Dark Souls, Tomb Raider, Off-Policy, Down to Ride and more — with community ratings, release dates, steering feel, and lane behavior. Updated regularly with the latest end-to-end (E2E) model releases.`;

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
        'openpilot models',
        'openpilot driving models',
        'openpilot model list',
        'openpilot model comparison',
        'best openpilot model',
        'comma.ai models',
        'comma ai driving models',
        'comma 3x models',
        'comma 3 models',
        'comma.ai self-driving models',
        'sunnypilot models',
        'sunnypilot driving models',
        'sunnylink models',
        'WMI openpilot',
        'world model iteration',
        'end-to-end openpilot model',
        'openpilot E2E model',
        'openpilot wiki',
        'openpilot model 2026',
        'openpilot tuning',
        'sunnylink wiki',
    ],
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        url: PAGE_URL,
        siteName: 'Sunnylink Wiki',
        type: 'website',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'openpilot Driving Models — Complete Comparison',
        description: DESCRIPTION,
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
        },
    },
};

// FAQ content — also fed into JSON-LD below. Each answer is intentionally
// keyword-rich and self-contained so it can earn its own snippet.
const FAQ: { q: string; a: string }[] = [
    {
        q: 'What are openpilot driving models?',
        a: 'openpilot driving models are the neural networks at the heart of openpilot — the open-source advanced driver assistance system from comma.ai. Each model is trained on millions of miles of real-world driving data and is responsible for predicting steering, lane positioning, and longitudinal control. Different models have distinct personalities — some hug the center of the lane, some cut the apex on curves, and others prioritize passenger comfort.',
    },
    {
        q: 'What is the best openpilot model right now?',
        a: 'There is no single "best" openpilot model — the right pick depends on your car and how you drive. WMI V12 is the flagship for daily driving in 2026, OP Model 10 v3 is the current Off-Policy recommendation, Down to Ride v6 is the comfort favorite, Dark Souls v2 suits trucks and SUVs, and Recertified Herbalist remains the gold standard for highway stability. Use the comparison grid above to filter by tag, score, and steering feel.',
    },
    {
        q: 'Where do openpilot models come from — comma.ai or sunnypilot?',
        a: 'Most stock driving models ship with openpilot from comma.ai, and sunnypilot — the popular community fork — bundles many of them plus additional community-tuned and experimental variants distributed through Sunnylink. This wiki tracks both pipelines: official comma.ai releases, sunnypilot custom builds, and community models like TCPmV3 (The Cool Peoples Model).',
    },
    {
        q: 'What does WMI stand for in openpilot?',
        a: 'WMI stands for World Model Iteration. The WMI series (V10, V11, V12) uses comma.ai\'s end-to-end (E2E) architecture, which "sees" the world more like a human driver — understanding 3D scenes, stop signs, intersections, and road edges instead of just painted lane lines. WMI V12 is the current flagship and is the recommended starting point for most drivers.',
    },
    {
        q: 'What is an end-to-end (E2E) openpilot model?',
        a: 'End-to-end (E2E) models are neural networks trained to map raw camera input directly to driving commands, rather than relying on hand-tuned perception → planning → control pipelines. The result is more human-like behavior in complex urban scenarios — stop signs, intersections, lane merges — at the cost of feeling slightly less rigid on straight highways. The WMI series and most 2025/2026 comma.ai releases are E2E.',
    },
    {
        q: 'How often does comma.ai release new openpilot models?',
        a: `Comma.ai pushes new openpilot driving models on a roughly weekly cadence through their Firehose / SOTA training pipeline. Sunnypilot then ships stabilized cuts to Sunnylink users along with community-tuned variants. This database is updated as new models land — last refreshed ${LAST_UPDATED}.`,
    },
    {
        q: 'Are sunnypilot driving models different from comma.ai openpilot models?',
        a: 'They share the same underlying model architecture, but sunnypilot exposes far more of them through the Sunnylink model picker — including experimental, community-tuned, and legacy models that comma.ai no longer ships by default (like Blue Diamond or Recertified Herbalist). If you run sunnypilot you can switch between dozens of models live; on stock openpilot you typically get whatever ships with the release.',
    },
    {
        q: 'Why do some openpilot models hug the left or right lane?',
        a: 'Lane bias usually comes from a mismatch between the model\'s training data and your specific camera mount. The standard fix is to adjust the Camera Offset in Sunnylink settings — typically +0.05 to +0.10 for left-hugging models. The model details on each card above call out known left/right hug issues so you know what to expect before you flash.',
    },
];

const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'openpilot Models', item: PAGE_URL },
    ],
};

const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
};

const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': PAGE_URL,
    url: PAGE_URL,
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: 'en',
    dateModified: LAST_UPDATED,
    isPartOf: { '@type': 'WebSite', name: 'Sunnylink Wiki', url: SITE_URL },
    about: [
        { '@type': 'Thing', name: 'openpilot', sameAs: 'https://github.com/commaai/openpilot' },
        { '@type': 'Thing', name: 'comma.ai', sameAs: 'https://comma.ai' },
        { '@type': 'Thing', name: 'sunnypilot', sameAs: 'https://sunnypilot.ai' },
        { '@type': 'Thing', name: 'Self-driving car neural networks' },
    ],
    mainContentOfPage: {
        '@type': 'WebPageElement',
        cssSelector: '#openpilot-models-library',
    },
};

function collectForumUrls(): string[] {
    const urls: string[] = [];
    for (const category of modelsData.categories as { models: { forumUrl?: string }[] }[]) {
        for (const m of category.models) {
            if (m.forumUrl) urls.push(m.forumUrl);
        }
    }
    return urls;
}

export default async function ModelsPage() {
    let forumActivity: ForumActivityMap = {};
    try {
        forumActivity = await fetchModelForumActivity(collectForumUrls());
    } catch (err) {
        console.error('[models page] forum activity fetch failed:', err);
    }

    return (
        <PageShell>
            <div>
                {/* SEO hero — server-rendered, so the H1 and intro paragraph
                    land in the initial HTML for crawlers. */}
                <header className="mb-8">
                    <h1 className="text-xl md:text-2xl font-bold text-white mb-2 leading-tight">
                        openpilot Driving Models — Complete Database &amp; Comparison
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Browse the most complete community-maintained list of <strong className="text-slate-200">openpilot driving models</strong> from <strong className="text-slate-200">comma.ai</strong> and <strong className="text-slate-200">sunnypilot</strong>. Compare {MODEL_COUNT}+ models — WMI V12, OP Model 10, Dark Souls, Tomb Raider, Off-Policy, Down to Ride and more — with community ratings, release dates, steering feel, and lane behavior. Visualize each model&rsquo;s driving personality in real time. Updated regularly with the latest end-to-end (E2E) releases.
                    </p>
                </header>

                <section id="openpilot-models-library" aria-label="openpilot models database">
                    <ModelLibrary forumActivity={forumActivity} />
                </section>

                {/* Long-form FAQ — visible content, matched 1:1 by the FAQPage
                    JSON-LD below so Google can render rich answer snippets. */}
                <section className="mt-16 border-t border-slate-800 pt-10 max-w-4xl">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                        About openpilot driving models
                    </h2>
                    <p className="text-slate-400 text-xs mb-8">
                        Common questions about comma.ai openpilot, sunnypilot, and the model picker.
                    </p>
                    <div className="space-y-6">
                        {FAQ.map((item) => (
                            <article key={item.q}>
                                <h3 className="text-sm md:text-base font-semibold text-white mb-1.5">
                                    {item.q}
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    {item.a}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageLd) }}
                />
            </div>
        </PageShell>
    );
}
