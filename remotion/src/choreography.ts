/**
 * Frame timeline for the quilt demo (30fps).
 *
 * Three calm beats, same as the product: scattered accounts converge,
 * they become one quilt, and the quilt is yours to embed in any color.
 * No impact, no camera — the README header should feel like the site.
 */
export const CARD_STAGGER = 8; // frames between account cards arriving
export const FAN_END = 34; // scattered accounts have fanned in
export const GATHER_END = 62; // ...and converged into a single stack
export const MERGE_START = 62; // the stack resolves into the merged quilt
export const MERGE_END = 88; // one quilt
export const WORD_START = 98; // wordmark + the stitch seam + tagline
export const EMBED_START = 132; // "embed it anywhere" snippet — the hook
export const THEME_STEPS = [158, 180, 202] as const; // dracula → nord → tokyonight
export const THEME_HOME = 224; // ...and home to green
export const HERO_DURATION = 246; // silent README hero (~8s)
export const CTA_START = 250;
export const SOCIAL_DURATION = 320; // + CTA end card (room for the chord's tail)
