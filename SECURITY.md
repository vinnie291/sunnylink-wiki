# Security Policy

## Overview

**Sunnylink Wiki** (`https://sunnylink.wiki`) is an open-source Next.js 16 reference application for the Sunnypilot and openpilot community, deployed as a stateless container on **Google Cloud Run**.

The application serves curated vehicle, toggle, and driving-model datasets (`data/*.json`), an in-browser openpilot `rlog`/`qlog` replay viewer (`capnp-es` + `fzstd`, parsed strictly client-side with zero telemetry file uploads), and anonymous community driving-model polls.

## Supported Versions

Sunnylink Wiki follows continuous deployment from the `main` branch. Security fixes land directly on `main` and are rolled out to the live Cloud Run service (`sunnylink-wiki-service`).

| Target | Supported | Notes |
| --- | --- | --- |
| `main` (`https://sunnylink.wiki`) | Yes | Active production branch on Next.js 16 / Node.js 22 |
| Older commits / unmaintained forks | No | Sync with `main` to receive security patches |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately through **GitHub Security Advisories**:

- **Report URL**: <https://github.com/vinnie291/sunnylink-wiki/security/advisories/new>

Include in your report:

1. Affected route, component, or file path (for example `/api/models/vote` or `middleware.ts`).
2. Minimal reproduction steps, request payload, or proof-of-concept.
3. Assessment of practical impact (data integrity, XSS, DoS, spoofing, or information disclosure).

### Response Targets

- **Initial acknowledgment**: within 48 hours
- **Triage & severity assessment**: within 5 business days
- **Remediation target**: within 7 days for Critical/High issues and within 30 days for Medium/Low issues

We practice coordinated disclosure and happily credit researchers in release advisories upon fix deployment.

## Architecture & Security Controls

### 1. Anonymous HMAC-Signed Community Voting (`/api/models/vote`)

- **Zero PII Storage**: Raw IP addresses and cookies are never written to disk or Cloud Storage. Voter deduplication keys are one-way salted SHA-256 digests (`20` hex chars).
- **HMAC-Signed Voter Tokens**: Voter tokens (`sl_voter_token`) follow `<uuid>.<hmac_sha256_24>` signed with `VOTE_SALT`, verified in constant time via `crypto.timingSafeEqual`, and issued as `HttpOnly; SameSite=Lax; Secure` cookies (`Max-Age=31536000`). Unsigned or tampered `voterToken` values in request bodies or cookies are rejected.
- **Google Front End IP Extraction**: `X-Forwarded-For` headers are length-bounded (`<= 512` bytes), validated with `net.isIP`, and resolved using the rightmost client IP appended by Google Front End when running on Cloud Run (`K_SERVICE`).
- **Strict Payload Validation**: `POST /api/models/vote` enforces a `16 KiB` body cap (`413 Payload Too Large`), verifies `modelName` against the canonical `data/models.json` catalog (`404` on unknown models), caps answer keys (`<= 25`) and primitive/string-array lengths, and rejects prototype-pollution keys (`__proto__`, `constructor`, `prototype`).
- **Bounded Memory Rate Limiting**: Sliding-window per-voter and per-IP rate limits (`rateLimitMap`) evict stale entries older than 60 seconds and enforce a hard `5,000`-key ceiling to prevent memory exhaustion under IP/token rotation floods.
- **Resilient Two-Tier Persistence**: Local writes use atomic temp-file + `fs.renameSync` operations (falling back cleanly to `os.tmpdir()` on read-only container layers) paired with non-blocking Cloud Storage state hydration/sync via Cloud Run workload metadata tokens.

### 2. Read-Only Catalog & Agent APIs (`/api/wiki-data`, `/api/markdown`)

- Query strings (`search`, `vibe`, `make`, `model`) are strictly length-bounded and restricted to allowlisted catalog types (`settings`, `models`, `cars`).
- API handlers catch unexpected runtime exceptions server-side and return generic `500` responses without leaking internal error messages or stack traces.

### 3. HTTP Security Headers (`next.config.ts`)

All routes emit hardened transport and browser isolation headers:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-DNS-Prefetch-Control: on
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; ... object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'
```

### 4. Crawler & AI Content-Signal Governance (`middleware.ts`, `app/robots.ts`)

`robots.txt` enforces `Content-Signal: search=yes, ai-train=no, ai-input=yes` alongside explicit user-agent rules: citation-producing search and real-time grounding crawlers (`Googlebot`, `Bingbot`, `OAI-SearchBot`, `PerplexityBot`, user-initiated fetchers) are permitted, while unattributed training-corpus scrapers (`GPTBot`, `ClaudeBot`, `CCBot`, `Bytespider`, `Google-Extended`) are disallowed.

## Dependency & Supply-Chain Hygiene

Runtime and build dependencies are tracked solely in `package.json` and `package-lock.json`. Contributors should avoid introducing unnecessary native or runtime packages when Node.js built-ins suffice and verify changes with `npm test` and `npm run lint`.
