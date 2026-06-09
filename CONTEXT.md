# quilt — context

Merge the GitHub contribution graphs of every account a developer owns into one
consolidated **quilt** of green — so activity split across accounts reads as the
single, busy graph it really is.

## Language

Controlled vocabulary. Use these terms exactly; avoid the listed synonyms.

- **Quilt** — the merged contribution grid (both the product and the artifact it renders). _Avoid_: dashboard, chart, heatmap.
- **Patch** — a single day cell in the quilt. _Avoid_: box, tile, square (in prose).
- **Account** — one GitHub username being merged. _Avoid_: user, profile, handle (in code).
- **Merge** — summing each day's contribution count across accounts. _Avoid_: combine, aggregate, join.
- **Level** — the 0–4 intensity bucket that picks a patch's green. _Avoid_: shade, tier, rank.
- **Streak** — a run of consecutive active days (longest / current). _Avoid_: chain, run.
- **Stitch** — the warm thread motif: seams between patches, the wordmark tick, the demo's sewing line. _Avoid_: thread (in code).
- **Accent** — the colour token for the brightest green (`#39d353`). The stitch colour is `--color-stitch`, not the accent.
- **Share card** — the OG image a shared quilt link unfurls to. _Avoid_: preview, thumbnail.

## Shape

- Static Astro site on Vercel, **no adapter**. All fetch + merge happens client-side
  against the jogruber `github-contributions-api` (see [SOURCES.md](SOURCES.md)).
  Nothing is stored; no login.
- Pure, unit-tested merge logic lives in `src/lib`. The live grid, the OG card, and
  the Remotion demo all colour patches from the **same** green ramp.
- Load-bearing decisions are logged in [docs/adr/](docs/adr/).
