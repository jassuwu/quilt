# 0003 — Use the jogruber contributions API as the data source

## Context

We need each account's daily contribution counts, **including** privatized-but-visible
green, with no auth (it's a public tool — see [0004](0004-client-side-fetch-and-merge.md)).

## Considered options

- **jogruber `github-contributions-api` (chosen).** Scrapes the public profile graph;
  returns `{date,count,level}` per day; no auth; includes privatized contributions the
  profile shows. See [SOURCES.md](../../SOURCES.md).
- GitHub GraphQL `contributionsCollection`. Rejected — [cannot include private
  contributions](https://github.com/orgs/community/discussions/24812), so it would
  undercount, and it requires a token.
- Self-hosted scraper. Deferred — same technique; only worth it if the public API flakes.

## Consequences

- Zero auth, zero secrets, fully client-side fetch.
- We depend on a third party's uptime; `src/lib/contributions.ts` retries with backoff and
  the data shape is isolated behind that module, so swapping in our own scraper is a small change.
