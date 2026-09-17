import { useCallback, useEffect, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { FlashListRef } from "@shopify/flash-list";
import {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { getHomeHeaderSnapTarget } from "@/lib/homeHeaderSnap";

/**
 * Scroll choreography for the home header: collapse on scroll, snap on
 * release, and return to the top after a save.
 *
 * Most of this compensates for upstream behaviour rather than expressing a
 * design, so the reasons are kept with the code:
 *
 * - The scroll position is ingested on the JS thread, not through
 *   useAnimatedScrollHandler, because the animated wrapper trips a null ref in
 *   FlashList on the New Architecture.
 * - That ingestion is jittery, so a withTiming pass acts as a low-pass filter.
 * - FlashList briefly keeps the old anchor after a row is prepended, so the
 *   post-save jump to the top is retried at two fixed delays.
 *
 * Retest these on any FlashList or Reanimated upgrade. If the upstream bugs
 * are fixed, the workarounds should go rather than accumulate.
 */

const COLLAPSED_SELECTOR_HEIGHT = 60;
const MIN_COLLAPSE_DISTANCE = 80;
const COLLAPSED_PROGRESS = 0.995;
const JUMP_TO_TOP_THRESHOLD = 760;
// Long enough to absorb dropped frames and jitter, short enough to still feel
// tied to the finger.
const COLLAPSE_SMOOTHING_MS = 90;
const SCROLL_TO_TOP_MS = 360;
const HEADER_SNAP_MS = 220;
const HEADER_SNAP_DELAY_MS = 80;
const POST_SAVE_SCROLL_RESET_DELAYS_MS = [140, 320];

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

export type HomeHeaderCollapseOptions<T> = {
  listRef: React.RefObject<FlashListRef<T> | null>;
  expandedPanelHeight: number;
  homeChromeHeight: number;
  historyChromeHeight: number;
};

export function useHomeHeaderCollapse<T>({
  listRef,
  expandedPanelHeight,
  homeChromeHeight,
  historyChromeHeight,
}: HomeHeaderCollapseOptions<T>) {
  const [selectorCollapsed, setSelectorCollapsed] = useState(false);
  const [jumpToTopVisible, setJumpToTopVisible] = useState(false);

  const latestScrollMetricsRef = useRef({
    offsetY: 0,
    contentHeight: 0,
    viewportHeight: 0,
  });
  const pendingHeaderSnapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTopResetTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const momentumScrollActiveRef = useRef(false);

  const collapseDistance = Math.max(
    expandedPanelHeight - COLLAPSED_SELECTOR_HEIGHT,
    MIN_COLLAPSE_DISTANCE
  );

  const scrollY = useSharedValue(0);
  const rawCollapseProgress = useDerivedValue(
    () => clamp(scrollY.value / collapseDistance, 0, 1),
    [collapseDistance, scrollY]
  );
  // Easing the raw scroll-driven progress on the UI thread smooths out the
  // jitter introduced by ingesting scroll offsets on the JS thread.
  // withTiming re-targets every frame, acting as a low-pass filter rather than
  // a discrete animation. Every visual style and reaction reads this value so
  // the whole collapse moves as one.
  const collapseProgress = useDerivedValue(
    () =>
      withTiming(rawCollapseProgress.value, {
        duration: COLLAPSE_SMOOTHING_MS,
        easing: Easing.out(Easing.quad),
      }),
    [rawCollapseProgress]
  );

  const clearPendingHeaderSnap = useCallback(() => {
    if (pendingHeaderSnapRef.current === null) return;

    clearTimeout(pendingHeaderSnapRef.current);
    pendingHeaderSnapRef.current = null;
  }, []);

  const clearPendingTopResets = useCallback(() => {
    pendingTopResetTimersRef.current.forEach(clearTimeout);
    pendingTopResetTimersRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearPendingHeaderSnap();
      clearPendingTopResets();
    },
    [clearPendingHeaderSnap, clearPendingTopResets]
  );

  const forceHomeListToTop = useCallback(
    (animated: boolean) => {
      clearPendingHeaderSnap();
      momentumScrollActiveRef.current = false;
      latestScrollMetricsRef.current = {
        ...latestScrollMetricsRef.current,
        offsetY: 0,
      };
      setJumpToTopVisible(false);
      listRef.current?.scrollToOffset({ offset: 0, animated });

      if (animated) {
        scrollY.value = withTiming(0, {
          duration: SCROLL_TO_TOP_MS,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        scrollY.value = 0;
      }

      setSelectorCollapsed(false);
    },
    [clearPendingHeaderSnap, listRef, scrollY]
  );

  const schedulePostSaveTopResets = useCallback(() => {
    clearPendingTopResets();

    pendingTopResetTimersRef.current = POST_SAVE_SCROLL_RESET_DELAYS_MS.map(
      (delayMs) => {
        const timerId = setTimeout(() => {
          pendingTopResetTimersRef.current =
            pendingTopResetTimersRef.current.filter(
              (currentId) => currentId !== timerId
            );
          forceHomeListToTop(false);
        }, delayMs);

        return timerId;
      }
    );
  }, [clearPendingTopResets, forceHomeListToTop]);

  const snapHomeHeaderIfNeeded = useCallback(() => {
    clearPendingHeaderSnap();

    const targetOffset = getHomeHeaderSnapTarget({
      ...latestScrollMetricsRef.current,
      collapseDistance,
    });

    if (targetOffset === null) return;

    latestScrollMetricsRef.current = {
      ...latestScrollMetricsRef.current,
      offsetY: targetOffset,
    };
    listRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
    scrollY.value = withTiming(targetOffset, {
      duration: HEADER_SNAP_MS,
      easing: Easing.out(Easing.cubic),
    });

    if (targetOffset === 0) {
      setSelectorCollapsed(false);
    }
  }, [clearPendingHeaderSnap, collapseDistance, listRef, scrollY]);

  const scheduleHomeHeaderSnap = useCallback(() => {
    clearPendingHeaderSnap();

    pendingHeaderSnapRef.current = setTimeout(() => {
      pendingHeaderSnapRef.current = null;

      if (!momentumScrollActiveRef.current) {
        snapHomeHeaderIfNeeded();
      }
    }, HEADER_SNAP_DELAY_MS);
  }, [clearPendingHeaderSnap, snapHomeHeaderIfNeeded]);

  // useAnimatedScrollHandler (createAnimatedComponent) triggers flash-list's
  // getScrollableNode() which has an un-guarded null ref on RN New Architecture.
  // A plain JS callback writing to the shared value is safe: useDerivedValue /
  // useAnimatedStyle still run on the UI thread, only the ingestion is on JS.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = Math.max(event.nativeEvent.contentOffset.y, 0);
      latestScrollMetricsRef.current = {
        offsetY,
        contentHeight: event.nativeEvent.contentSize.height,
        viewportHeight: event.nativeEvent.layoutMeasurement.height,
      };
      scrollY.value = offsetY;
    },
    [scrollY]
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(event);
      scheduleHomeHeaderSnap();
    },
    [handleScroll, scheduleHomeHeaderSnap]
  );

  const handleScrollBeginDrag = useCallback(() => {
    clearPendingTopResets();
  }, [clearPendingTopResets]);

  const handleMomentumScrollBegin = useCallback(() => {
    momentumScrollActiveRef.current = true;
    clearPendingHeaderSnap();
  }, [clearPendingHeaderSnap]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(event);
      momentumScrollActiveRef.current = false;
      snapHomeHeaderIfNeeded();
    },
    [handleScroll, snapHomeHeaderIfNeeded]
  );

  const scrollToTop = useCallback(() => {
    clearPendingTopResets();
    forceHomeListToTop(true);
  }, [clearPendingTopResets, forceHomeListToTop]);

  useAnimatedReaction(
    () => collapseProgress.value >= COLLAPSED_PROGRESS,
    (isCollapsed, wasCollapsed) => {
      if (isCollapsed !== wasCollapsed) {
        runOnJS(setSelectorCollapsed)(isCollapsed);
      }
    },
    []
  );

  useAnimatedReaction(
    () => scrollY.value > JUMP_TO_TOP_THRESHOLD,
    (isVisible, wasVisible) => {
      if (isVisible !== wasVisible) {
        runOnJS(setJumpToTopVisible)(isVisible);
      }
    },
    []
  );

  const panelAnimatedStyle = useAnimatedStyle(
    () => ({
      height: interpolate(
        collapseProgress.value,
        [0, 1],
        [expandedPanelHeight, COLLAPSED_SELECTOR_HEIGHT],
        Extrapolation.CLAMP
      ),
      borderRadius: interpolate(collapseProgress.value, [0, 1], [28, 18]),
      overflow: "hidden",
    }),
    [expandedPanelHeight]
  );

  const overlayAnimatedStyle = useAnimatedStyle(
    () => ({
      height:
        homeChromeHeight +
        interpolate(
          collapseProgress.value,
          [0, 1],
          [expandedPanelHeight, COLLAPSED_SELECTOR_HEIGHT],
          Extrapolation.CLAMP
        ) +
        historyChromeHeight,
    }),
    [expandedPanelHeight, historyChromeHeight, homeChromeHeight]
  );

  const expandedSelectorAnimatedStyle = useAnimatedStyle(() => {
    const easedProgress = interpolate(
      collapseProgress.value,
      [0, 0.5, 1],
      [0, 0.72, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: interpolate(
        easedProgress,
        [0, 0.55, 1],
        [1, 0.35, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateY: interpolate(
            easedProgress,
            [0, 1],
            [0, -32],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(easedProgress, [0, 1], [1, 0.96], Extrapolation.CLAMP),
        },
      ],
    };
  }, []);

  const collapsedSelectorAnimatedStyle = useAnimatedStyle(() => {
    const easedProgress = interpolate(
      collapseProgress.value,
      [0, 0.5, 1],
      [0, 0.72, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: interpolate(easedProgress, [0.35, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(
            easedProgress,
            [0, 1],
            [18, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(easedProgress, [0, 1], [0.98, 1], Extrapolation.CLAMP),
        },
      ],
    };
  }, []);

  return {
    selectorCollapsed,
    jumpToTopVisible,
    // UnifiedMoodSelector animates its ownternal contents from the same value, so
    // the collapse stays in step across both components.
    collapseProgress,
    scrollToTop,
    schedulePostSaveTopResets,
    scrollHandlers: {
      onScroll: handleScroll,
      onScrollBeginDrag: handleScrollBeginDrag,
      onScrollEndDrag: handleScrollEndDrag,
      onMomentumScrollBegin: handleMomentumScrollBegin,
      onMomentumScrollEnd: handleMomentumScrollEnd,
    },
    panelAnimatedStyle,
    overlayAnimatedStyle,
    expandedSelectorAnimatedStyle,
    collapsedSelectorAnimatedStyle,
  };
}

export const HOME_COLLAPSED_SELECTOR_HEIGHT = COLLAPSED_SELECTOR_HEIGHT;
