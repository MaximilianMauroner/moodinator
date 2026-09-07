import { useLayoutEffect, useRef, useState } from "react";

import { motion } from "@/constants/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Matches the Easing.out(Easing.cubic) curve used by the Reanimated reveals. */
function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/**
 * Counts a metric from zero to `value` once per value change, then holds.
 *
 * The animation never loops, so the GPU goes idle between data changes. Under
 * reduced motion the final value is returned directly, with no first frame at
 * zero to flash past.
 *
 * This runs on the JS thread on purpose: it drives a text value, not a style,
 * so there is no transform to hand to the UI thread.
 *
 * Callers keep the accessibility label on the final `value`, not on the
 * returned frame value, so screen readers never announce a partial number.
 */
export function useCountUp(value: number, decimals: number = 0): number {
  const reducedMotion = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const frameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (reducedMotion) return;

    setAnimated(0);

    const factor = 10 ** decimals;
    let startedAt: number | null = null;

    const step = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;

      const progress = Math.min(
        (timestamp - startedAt) / motion.duration.reveal,
        1
      );
      setAnimated(Math.round(value * easeOutCubic(progress) * factor) / factor);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [decimals, reducedMotion, value]);

  return reducedMotion ? value : animated;
}

export default useCountUp;
