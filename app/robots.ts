import { MetadataRoute } from 'next';

// AEO policy: force citation-back attribution by allowing AI crawlers
// that produce linked citations and blocking ones that only harvest
// content for model training without attribution.
//
//  ALLOW  — crawler drives a search/answer surface that cites sources.
//  BLOCK  — crawler exists purely to ingest content into a training
//           corpus with no link-back guarantee.
//
// Notes:
//  - Google-Extended controls Google's *generative* training opt-in;
//    blocking it does NOT affect Google Search ranking or AI Overviews
//    (those use the normal Googlebot, which we allow).
//  - Applebot-Extended is the training-only flavor; Applebot (Siri /
//    Spotlight, with citations) stays allowed.
//  - ChatGPT-User and Perplexity-User are user-triggered browsing
//    fetches — keeping these on means a user's question can actually
//    pull the page in real time, with a citation.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            { userAgent: '*', allow: '/' },

            // ── Citation-producing crawlers (allow) ──
            { userAgent: 'Googlebot', allow: '/' },
            { userAgent: 'Bingbot', allow: '/' },
            { userAgent: 'Applebot', allow: '/' },
            { userAgent: 'DuckDuckBot', allow: '/' },
            { userAgent: 'OAI-SearchBot', allow: '/' },
            { userAgent: 'ChatGPT-User', allow: '/' },
            { userAgent: 'PerplexityBot', allow: '/' },
            { userAgent: 'Perplexity-User', allow: '/' },
            { userAgent: 'Claude-User', allow: '/' },
            { userAgent: 'meta-externalfetcher', allow: '/' },

            // ── Training-only crawlers (block to force citations) ──
            { userAgent: 'GPTBot', disallow: '/' },
            { userAgent: 'ClaudeBot', disallow: '/' },
            { userAgent: 'Claude-Web', disallow: '/' },
            { userAgent: 'anthropic-ai', disallow: '/' },
            { userAgent: 'Google-Extended', disallow: '/' },
            { userAgent: 'Applebot-Extended', disallow: '/' },
            { userAgent: 'CCBot', disallow: '/' },
            { userAgent: 'Bytespider', disallow: '/' },
            { userAgent: 'Amazonbot', disallow: '/' },
            { userAgent: 'meta-externalagent', disallow: '/' },
            { userAgent: 'FacebookBot', disallow: '/' },
            { userAgent: 'cohere-ai', disallow: '/' },
            { userAgent: 'Diffbot', disallow: '/' },
            { userAgent: 'omgili', disallow: '/' },
            { userAgent: 'omgilibot', disallow: '/' },
            { userAgent: 'YouBot', disallow: '/' },
            { userAgent: 'ImagesiftBot', disallow: '/' },
            { userAgent: 'PetalBot', disallow: '/' },
        ],
        sitemap: 'https://www.sunnylink.wiki/sitemap.xml',
        host: 'https://www.sunnylink.wiki',
    };
}
