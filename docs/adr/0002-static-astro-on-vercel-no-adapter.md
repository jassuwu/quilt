# 0002 — Static Astro on Vercel, no adapter

## Context

quilt is one page. The reference project incomerank is also static Astro but deploys to
Cloudflare via `wrangler`. quilt targets Vercel.

## Considered options

- **Static, no adapter (chosen).** `output: 'static'`; Vercel auto-detects Astro and serves
  `dist/` from its edge CDN. Simplest possible; nothing to configure.
- `@astrojs/vercel` server/hybrid adapter. Rejected for v1 — only needed for runtime routes,
  which we don't have (all fetch + merge is client-side, see [0004](0004-client-side-fetch-and-merge.md)).
- Keep Cloudflare/`wrangler` like incomerank. Rejected — we deliberately diverge to Vercel.

## Consequences

- No `wrangler.jsonc`, no adapter dependency. `astro build` → `dist/` is the whole deploy.
- Adding the Vercel adapter later is the trigger for personalised OG cards (deferred to v2).
- `site: 'https://quilt.jass.gg'` is set in `astro.config.mjs` for canonical URLs + sitemap.
