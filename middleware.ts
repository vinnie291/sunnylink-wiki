import { NextRequest, NextResponse } from 'next/server';

const ROBOTS_CONTENT = `User-agent: *
Allow: /

Content-Signal: ai-train=no, search=yes, ai-input=no

Sitemap: https://www.sunnylink.wiki/sitemap.xml
`;

// Pages that support text/markdown content negotiation
const MARKDOWN_PAGES = new Set(['/', '/models', '/features', '/cars', '/wizard', '/stats']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Serve custom robots.txt with Content-Signal directives (contentsignals.org)
  if (pathname === '/robots.txt') {
    return new NextResponse(ROBOTS_CONTENT, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
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
  matcher: ['/robots.txt', '/', '/models', '/features', '/cars', '/wizard', '/stats'],
};
