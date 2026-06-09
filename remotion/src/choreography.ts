/**
 * Frame timeline for the quilt launch demo (30fps).
 *
 * Three acts: scatter → impact → afterglow. The held breath before the
 * slam (HOLD → SLAM) is the structural beat everything tunes around:
 * the riser dies into it, the screen stills, then the quilt lands.
 */
export const FAN_END = 32; // scattered accounts have fanned in
export const GATHER_END = 54; // ...converged into a single stack
export const SLAM = 60; // the merge lands (5 silent frames before it)
export const DENSIFY_END = 88; // merged quilt blooms out from the impact
export const SPIN_START = 92; // counter winds up...
export const SPIN_END = 138; // ...and lands on 1,337 (the ding — the peak)
export const REVEAL_START = 144; // a green shimmer sweeps the finished quilt
export const WORD_START = 184; // number hands off to the wordmark + stitch line
export const EMBED_START = 222; // "embed it anywhere" snippet — the hook
export const THEME_STEPS = [248, 266, 284] as const; // dracula → nord → tokyonight
export const THEME_HOME = 302; // ...and home to green
export const HERO_DURATION = 318; // silent README hero
export const CTA_START = 322;
export const SOCIAL_DURATION = 400; // + CTA end card (room for the chord's tail)
