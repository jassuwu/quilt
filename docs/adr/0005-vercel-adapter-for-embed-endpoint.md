# 0005 — Add the Vercel adapter for an embeddable SVG endpoint

Revisits [0002](0002-static-astro-on-vercel-no-adapter.md) and [0004](0004-client-side-fetch-and-merge.md).

## Context

The highest-leverage use case turned out to be **embedding** a merged graph elsewhere —
especially GitHub/GitLab READMEs, which only render `<img src>` (iframes and scripts are
stripped). That needs a URL that returns an image directly, server-side: arbitrary username
combos can't be prerendered, and README crawlers don't run client JS.

## Decision

Add `@astrojs/vercel` and serve a single on-demand route — `/u/[users].svg`
(`export const prerender = false`) — that fetches, merges, and returns a self-contained,
themed SVG with CDN cache headers. Every other route stays prerendered/static.

## Consequences

- The site is now **hybrid**: static homepage + one dynamic, edge-cached endpoint. This
  narrows 0002's "no adapter" to "no adapter except this route", and relaxes 0004's "fully
  static" (the page is still client-side; only the embed renders server-side).
- Embeds are cached per `(users, year, theme)` via `s-maxage` + `stale-while-revalidate`,
  so they stay instant and the upstream API is rarely hit.
- One renderer (`src/lib/svg.ts`) powers both the live page and the embed.
- Per-combo OG cards are now feasible by reusing this route (still deferred).
