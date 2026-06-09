# 0004 — Fetch and merge client-side

## Context

quilt is a public tool: anyone types arbitrary usernames and gets a merged quilt. The
data source needs no auth and the payload is tiny (~365 days × N accounts).

## Considered options

- **Client-side (chosen).** The browser fetches each account in parallel and merges in
  `src/lib`. The deploy stays fully static and adapter-free ([0002](0002-static-astro-on-vercel-no-adapter.md)).
- Build-time precompute. Rejected — only works for a fixed set of accounts, not arbitrary input.
- Server route (Vercel function) to proxy + merge. Rejected for v1 — unnecessary for a no-auth
  public API; would pull in the adapter.

## Consequences

- No backend, no secrets, nothing stored. State lives in the `?u=a,b` query string, so quilts are shareable links.
- Per-session in-memory cache in `contributions.ts` avoids refetching within a visit.
- Share-link unfurls use a single generic OG card; personalised per-combo cards are deferred to v2
  because crawlers won't run the client-side fetch.
