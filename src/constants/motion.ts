export const motion = {
  duration: {
    fast: 140,
    normal: 220,
    slow: 340,
  },
  stagger: {
    tight: 45,
    normal: 70,
  },
} as const;

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
