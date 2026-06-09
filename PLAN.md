# quilt — build plan

> Merge every GitHub account's contribution graph into one quilt of green. → **quilt.jass.gg**

See [CONTEXT.md](CONTEXT.md) for vocabulary and [docs/adr/](docs/adr/) for decisions.

## Architecture

```
quilt/
├── src/
│   ├── lib/                 # pure, unit-tested core
│   │   ├── types.ts         # ContributionDay · Quilt
│   │   ├── levels.ts        # count → level → green hex (the colour source of truth)
│   │   ├── contributions.ts # jogruber fetch + session cache + retry
│   │   └── merge.ts         # sum days across accounts → one Quilt
│   ├── scripts/quilt.ts     # browser: read usernames → fetch → merge → render SVG grid
│   ├── layouts/Layout.astro # head, OG/Twitter, fonts
│   ├── pages/index.astro    # the merge tool
│   ├── pages/u/[users].svg.ts # embeddable SVG endpoint (server-rendered)
│   └── styles/global.css    # @theme green ramp + stitch accent + fonts
├── scripts/                 # build-time (resvg): art.ts, build-icons.ts, build-og.ts
├── remotion/                # sibling project: the hero/social demos
└── public/                  # generated favicon set + og/default.png
```

## Phases

- **P1 — Scaffold.** Astro 6 + Tailwind v4 + sitemap (bun); Remotion sibling. ✅
- **P2 — Theme.** Dark GitHub-green ramp + warm stitch accent + 3 fonts. ✅
- **P3 — Core.** types / levels / contributions / merge, with unit tests. ✅
- **P4 — Page.** Layout + index shell; client fetch→merge→render grid + stats; shareable `?u=` URL. ✅
- **P5 — Identity.** quilt mark → favicon/PWA set; OG share card. ✅
- **P6 — Demo.** Remotion hero + social compositions; poster for the README. ✅
- **P7 — Docs + CI.** CONTEXT / SOURCES / ADRs / README; CI gate. ✅
- **P8 — Embeds.** Vercel adapter + `/u/[users].svg` (theme + year); responsive no-scroll graph + GitHub-style year selector. ✅

## Deferred to v2

- Per-combo OG cards (can now reuse the `/u/[users].svg` route).
- Site-wide light theme toggle (embeds already support `?theme=light`).
- Interactive iframe + PNG embed variants; richer streak math.
