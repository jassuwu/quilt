# 0001 — Merge multiple accounts into one contribution graph

## Context

A developer's work is split across several GitHub accounts (work / personal / alt),
so each individual profile graph looks sparse and inactive even when the person is busy.

## Decision

Build a tool that **sums each day's contribution count across accounts** and recomputes
the 0–4 level from the merged distribution, rendering one combined GitHub-style grid.

## Consequences

- The merge is the product. It lives as pure, unit-tested logic in `src/lib/merge.ts`.
- Levels are recomputed from quartiles of the merged active days (`src/lib/levels.ts`)
  so a dense merged quilt still shades like a real GitHub graph.
- We do not modify GitHub or fake commits — read-only aggregation only.
