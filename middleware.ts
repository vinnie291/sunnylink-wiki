import { NextRequest, NextResponse } from 'next/server';

const ROBOTS_CONTENT = `# AEO & SEO Policy: Allow search & citation-producing AI engines; block training-only scrapers.
User-agent: *
Allow: /

# Citation-producing search & AI engines
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Applebot
Allow: /

User-agent: DuckDuckBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Claude-User
Allow: /

User-agent: meta-externalfetcher
Allow: /

# Training-only crawlers (block to protect against uncredited harvesting)
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: omgili
Disallow: /

User-agent: omgilibot
Disallow: /

User-agent: YouBot
Disallow: /

User-agent: ImagesiftBot
Disallow: /

User-agent: PetalBot
Disallow: /

# Content-Signal specification (contentsignals.org)
# Permits real-time search & citation input (RAG/grounding) while opting out of pretraining scrapers.
Content-Signal: search=yes, ai-train=no, ai-input=yes

Sitemap: https://sunnylink.wiki/sitemap.xml
Host: https://sunnylink.wiki
`;

// Pages that support text/markdown content negotiation
const MARKDOWN_PAGES = new Set(['/', '/models', '/features', '/cars', '/wizard', '/stats', '/llms-full.txt']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Serve unified robots.txt with Content-Signal directives
  if (pathname === '/robots.txt') {
    return new NextResponse(ROBOTS_CONTENT, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Support /llms-full.txt directly
  if (pathname === '/llms-full.txt') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/markdown';
    url.searchParams.set('path', '/llms-full.txt');
    return NextResponse.rewrite(url);
  }

  // RFC 8288 / Cloudflare Markdown for Agents: return markdown when requested
  const accept = request.headers.get('accept') ?? '';
  if (MARKDOWN_PAGES.has(pathname) && accept.includes('text/markdown')) {
    const url = request.nextUrl.clone();
    url.pathname = '/api/markdown';
    url.searchParams.set('path', pathname);
    return NextResponse.rewrite(url);
  }
}

export const config = {
  matcher: ['/robots.txt', '/llms-full.txt', '/', '/models', '/features', '/cars', '/wizard', '/stats'],
};
