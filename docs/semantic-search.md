# Jev search

The global search (Cmd/Ctrl+K) shows local matches immediately, then uses Jev to
rank up to 24 wiki entries after a 350 ms pause in typing. Exact names, vehicle
models, makes, and acronyms stay first. Settings, Models, Cars, and simulator model pickers also use Jev, scoped to their
active filters. Exact names stay first and local results remain available on failure.

## Enable

Create `.env.local` in the project root:

```dotenv
TYPESAFE_API_KEY=your_typesafe_api_key
# Optional; defaults to jev-latest
TYPESAFE_MODEL=jev-latest
```

Restart `npm run dev`. For deployment, set these variables in the hosting
environment and redeploy. Never use `NEXT_PUBLIC_` for the key.

The server calls the [TypeSafe HTTP API](https://docs.typesafe.ai/api) using one
[Score question](https://docs.typesafe.ai/primitives/score) per candidate, batched
into a single request. It sends the search query and checked-in wiki titles and
descriptions. It returns only known result IDs, resolved to translated entries and
existing links in the browser.

The shortlist combines up to 12 local results with matches from richer English
wiki content (use cases, model traits, and feature descriptions). Jev can only rank
entries in that shortlist; this is not exhaustive semantic retrieval. Translated
local matches seed the shortlist, but queries with no lexical overlap can still
miss relevant entries. The initial relevance cutoff is 1.5 on a 0–3 rubric and
needs evaluation against real queries with a configured key.

Missing credentials, timeouts, rate limits, malformed provider responses, or
network failures leave local search working. Upstream calls time out after eight
seconds; changing the query or closing search cancels the browser request.
Successful rankings are cached for five minutes (at most 100 entries per process).
The route caps calls at 60 per minute and four concurrent calls per process.
Multiple production instances need a shared rate limiter or a hosting-level limit
to enforce an aggregate budget.

## Verify

```sh
node --import tsx --test tests/jev-search.test.ts
```

Tests use mocked TypeSafe responses. With a real key, try `steering stays on when
I brake`, `smooth highway model`, and exact lookups such as `MADS`, `NNLC`, and
`R1S`. Check the `/api/search` response for `source: "jev"` and confirm the results
lead to useful entries. Also check a non-English query and an unrelated query.
Record relevance, request latency, and API usage before tuning shortlist size or
the relevance cutoff; mocked tests do not establish model quality.

## Preview QA — September 27, 2026

Deployed preview: https://sunnylink-wiki-preview-32842449811.us-central1.run.app

- Cloud Run revision: `sunnylink-wiki-preview-00017-6jw`.
- Image digest: `sha256:104120fc4334efaa9f3f63dbeed41b76f3476b2b0270b4680fc314509f81deb0`.
- Cloud Build: `9dbfb68d-8d5a-4541-bf7f-199b9f015eaf` (successful).
- The runtime reads `TYPESAFE_API_KEY` from Secret Manager secret
  `typesafe-api-key`, version `1`. Source uploads and Docker builds exclude `.env*`.
- Six automated tests, targeted ESLint, TypeScript/production build, and locale
  key checks passed. The production build logged upstream Discourse rate limits
  and completed using available data.
- Browser QA at 390×844 and 320×568 passed: dialog layout, query replacement,
  query reset on reopening, and navigation to the MADS feature. No browser errors
  were observed during the local production-build checks.
- Public preview checks returned HTTP 200 and `source: "jev"` for MADS, camera
  offset, and R1S searches. The unrelated chocolate-cake query returned no semantic
  results; a one-character API query correctly returned HTTP 400.
- Public API calls in this small sample took 259–620 ms. This is a smoke test,
  not a load test or a latency guarantee.
- A direct Korean query with MADS candidates supplied also passed; exhaustive
  multilingual retrieval and physical-device testing remain outside this check.
- The generated client assets were checked for the configured key: zero matches.

For phone testing, tap the magnifying-glass search button in the top controls.
Try “steering stays on when I brake” or “car drives too far right.”
