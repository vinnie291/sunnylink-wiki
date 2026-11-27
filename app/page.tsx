import { Metadata } from 'next';
import TranslatedText from '@/components/TranslatedText';
import { fetchAllDiscourseContent } from '../lib/discourse-sync';
import { mapDiscourseContent } from '../lib/discourse-mapper';
import HomeClient from '../components/HomeClient';
import togglesData from '@/data/toggles.json';

export const revalidate = 3600;

const SITE_URL = 'https://sunnylink.wiki';
const LAST_UPDATED = togglesData.lastUpdated ?? '2026-11-01';
const TOTAL_SETTINGS = togglesData.categories.reduce((acc, c) => acc + c.settings.length, 0);

const TITLE = 'Sunnypilot & Sunnylink Settings Database — Camera Offset, MADS, NNLC & 100+ Toggles | Sunnylink Wiki';
const DESCRIPTION =
  `Searchable database of ${TOTAL_SETTINGS}+ Sunnypilot and Sunnylink settings, toggles, sliders, defaults, and community tips — including Adjust Camera Offset (lane hugging fix), Driving Model selector, MADS, NNLC, Dynamic Experimental Control (DEC), and Speed Limit Assist.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'sunnylink camera offset',
    'adjust camera offset',
    'sunnypilot camera offset',
    'openpilot camera offset',
    'openpilot lane hugging',
    'sunnypilot lane hugging fix',
    'comma 4 camera offset',
    'comma 3x camera offset',
    'sunnylink settings',
    'sunnypilot settings',
    'sunnypilot toggles',
    'sunnylink wiki',
    'MADS sunnypilot',
    'NNLC sunnypilot',
    'Neural Network Lateral Control',
    'Dynamic Experimental Control',
    'DEC sunnypilot',
    'Smart Cruise Control Vision',
    'Speed Limit Assist sunnypilot',
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Sunnylink Wiki',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sunnypilot & Sunnylink Settings Database | Sunnylink Wiki',
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

const FEATURED_SETTING_KEYS = [
  'AdjustCameraOffset',
  'DrivingModel',
  'MadsEnabled',
  'NeuralNetworkLateralControl',
  'DynamicExperimentalControl',
  'ExperimentalMode',
  'VisionBasedTurnSpeedControl',
  'SpeedLimitAssistMode',
  'ResetCalibration',
  'EnableSunnylink',
];

const allFlatSettings = togglesData.categories.flatMap((cat) =>
  cat.settings.map((s) => ({
    ...s,
    categoryName: cat.name,
  }))
);

const featuredSettings = FEATURED_SETTING_KEYS.map((key) =>
  allFlatSettings.find((s) => s.key === key)
).filter((s): s is NonNullable<typeof s> => Boolean(s));

const SETTINGS_FAQ: { q: string; a: string; key?: string }[] = [
  {
    q: 'How do I adjust Sunnylink Camera Offset to fix left or right lane hugging?',
    a: 'Use the Adjust Camera Offset (AdjustCameraOffset) slider under Model Settings in Sunnylink or on your comma device (range: -0.35 m to +0.35 m, default: 0.00 m). Positive (+) values virtually shift the camera perspective to move the car toward the left side of the lane; negative (-) values move the car toward the right side of the lane. Always run Reset Calibration first to rule out mounting pitch/yaw errors, then adjust Camera Offset in small 0.01 m to 0.05 m steps (for example, -0.05 m to -0.10 m for right-hugging models on Comma 4, or +0.05 m to +0.10 m for left-hugging models).',
    key: 'AdjustCameraOffset',
  },
  {
    q: 'Where is Camera Offset on comma four vs comma 3X?',
    a: 'On comma 3 and comma 3X, Adjust Camera Offset is available both on-device under Model Settings and remotely via the Sunnylink dashboard. On comma four, on-screen UI settings are streamlined, so comma four drivers configure Adjust Camera Offset, Driving Model, and Lane Turn Desires directly through Sunnylink (sunnylink.ai/dashboard/models#AdjustCameraOffset).',
    key: 'AdjustCameraOffset',
  },
  {
    q: 'What is MADS (Modular Automated Driving System) in Sunnypilot?',
    a: 'MADS decouples lateral steering assistance from longitudinal cruise control (ACC), allowing Sunnypilot steering to stay engaged even when you manually press the gas or brake pedal. You can customize engagement behavior using MADS Enabled, MADS Steering Mode, and MADS Unified Engagement Mode.',
    key: 'MadsEnabled',
  },
  {
    q: 'What is the difference between NNLC (Neural Network Lateral Control) and Enforce Torque Control?',
    a: 'Neural Network Lateral Control (NNLC) uses a learned vehicle-specific lateral model to predict smooth steering torque across speed and road-bank variations, whereas Enforce Torque Control uses analytical lateral acceleration tuning. NNLC and Enforce Torque Control should not both be enabled at the same time — pick the controller recommended for your vehicle platform.',
    key: 'NeuralNetworkLateralControl',
  },
  {
    q: 'What does Dynamic Experimental Control (DEC) do?',
    a: 'Dynamic Experimental Control (DEC) automatically switches between standard ACC longitudinal control on open highways and end-to-end Experimental Mode when approaching traffic lights, stop signs, or urban intersections.',
    key: 'DynamicExperimentalControl',
  },
  {
    q: 'How do Smart Cruise Control - Vision (SCC-V) and Speed Limit Assist work?',
    a: 'Smart Cruise Control - Vision (VisionBasedTurnSpeedControl) predicts road curvature from the camera feed and smoothly slows down before sharp curves, while Speed Limit Assist (SpeedLimitAssistMode) adapts set cruise speed to posted road signs, map data, or car dashboard speed limits.',
    key: 'VisionBasedTurnSpeedControl',
  },
];

const POPULAR_HEADING = 'Popular Sunnylink & Sunnypilot Settings';
const POPULAR_SUBTITLE = 'Direct deep links to the most searched configuration parameters, including Sunnylink Camera Offset, MADS, NNLC, and DEC.';
const FAQ_HEADING = 'Sunnylink & Sunnypilot Settings FAQ';
const FAQ_SUBTITLE = 'Answers to common configuration questions, lane-centering Camera Offset tuning, and comma device controls.';

const settingsJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  '@id': `${SITE_URL}/#settings-list`,
  name: 'Sunnypilot & Sunnylink Settings and Toggles',
  description: DESCRIPTION,
  numberOfItems: TOTAL_SETTINGS,
  itemListElement: togglesData.categories.flatMap((cat, catIdx) =>
    cat.settings.map((s, idx) => ({
      '@type': 'ListItem',
      position: catIdx * 100 + idx + 1,
      name: s.key === 'AdjustCameraOffset' ? `${s.label} (Sunnylink Camera Offset)` : s.label,
      description: s.description ?? s.label,
      url: `${SITE_URL}/?setting=${encodeURIComponent(s.key)}#${encodeURIComponent(s.key)}`,
    }))
  ),
};

const definedTermsJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  '@id': `${SITE_URL}/#defined-terms`,
  name: 'Sunnylink & Sunnypilot Configuration Parameters',
  description: 'Canonical glossary of Sunnypilot and Sunnylink ADAS configuration parameters, keys, and defaults.',
  url: SITE_URL,
  hasDefinedTerm: featuredSettings.map((s) => ({
    '@type': 'DefinedTerm',
    name: s.key === 'AdjustCameraOffset' ? 'Adjust Camera Offset (Sunnylink Camera Offset)' : s.label,
    termCode: s.key,
    description: [s.description, s.userNote].filter(Boolean).join(' '),
    url: `${SITE_URL}/?setting=${encodeURIComponent(s.key)}#${encodeURIComponent(s.key)}`,
  })),
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: SETTINGS_FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  })),
};

const webPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': SITE_URL,
  url: SITE_URL,
  name: TITLE,
  description: DESCRIPTION,
  inLanguage: 'en',
  dateModified: LAST_UPDATED,
  isPartOf: { '@type': 'WebSite', name: 'Sunnylink Wiki', url: SITE_URL },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(settingsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HomeClient discourseSettings={discourseSettings} />

      {/* Server-rendered crawlable quick-jump index & FAQ for search engines (Google, DuckDuckGo, Bing, AI Overviews) */}
      <div className="bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16 space-y-12">
          <section aria-labelledby="popular-settings-heading">
            <h2 id="popular-settings-heading" className="text-xl md:text-2xl font-bold text-slate-100 mb-2">
              <TranslatedText text={POPULAR_HEADING} />
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mb-6">
              <TranslatedText text={POPULAR_SUBTITLE} />
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featuredSettings.map((s) => (
                <a
                  key={s.key}
                  href={`/?setting=${encodeURIComponent(s.key)}#${encodeURIComponent(s.key)}`}
                  className="group rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-cyan-500/40 p-4 transition-colors block"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                      <TranslatedText text={s.label} />
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">{s.key}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    <TranslatedText text={s.description} />
                  </p>
                </a>
              ))}
            </div>
          </section>

          <section aria-labelledby="settings-faq-heading" className="max-w-4xl border-t border-slate-800/80 pt-10">
            <h2 id="settings-faq-heading" className="text-xl md:text-2xl font-bold text-slate-100 mb-2">
              <TranslatedText text={FAQ_HEADING} />
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mb-8">
              <TranslatedText text={FAQ_SUBTITLE} />
            </p>
            <div className="space-y-6">
              {SETTINGS_FAQ.map((item) => (
                <article key={item.q} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 sm:p-5">
                  <h3 className="text-sm md:text-base font-semibold text-slate-100 mb-2">
                    {item.key ? (
                      <a
                        href={`/?setting=${encodeURIComponent(item.key)}#${encodeURIComponent(item.key)}`}
                        className="hover:text-cyan-400 transition-colors"
                      >
                        <TranslatedText text={item.q} />
                      </a>
                    ) : (
                      <TranslatedText text={item.q} />
                    )}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    <TranslatedText text={item.a} />
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
