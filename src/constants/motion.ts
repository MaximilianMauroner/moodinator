export const motion = {
  duration: {
    /** Press response. Short enough to read as "the touch landed", not as travel. */
    xfast: 90,
    fast: 140,
    normal: 220,
    slow: 340,
    /** One-shot value reveals: count-up and progress fill. */
    reveal: 520,
  },
  stagger: {
    tight: 45,
    normal: 70,
  },
  /**
   * Entrance animation is capped so a long list never queues dozens of
   * staggered delays. Items past this index all arrive on the last beat.
   */
  maxStaggerIndex: 6,
} as const;

/** Scale a stagger index so late items in a long list do not drift far behind. */
export function staggerDelay(index: number, step: number = motion.stagger.tight): number {
  return Math.min(index, motion.maxStaggerIndex) * step;
}

/**
 * Shared spring presets for consistent feel across the entry creation flow.
 * Use these instead of ad-hoc spring configs so the whole app "breathes" together.
 *
 * All presets clamp overshoot to avoid jittery oscillation.
 *
 * snap   — instant, decisive: chip toggles, dots, button feedback
 * gentle — comfortable, settled: modals, overlays, transitions
 * bouncy — expressively physical, but still resolved: mood pill, CTA pop
 */
export const springs = {
  snap: { damping: 22, stiffness: 400, overshootClamping: true } as const,
  gentle: { damping: 22, stiffness: 280, overshootClamping: true } as const,
  bouncy: { damping: 18, stiffness: 360, overshootClamping: true } as const,
} as const;
