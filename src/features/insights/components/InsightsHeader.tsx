import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColorScheme } from "@/hooks/useColorScheme";
import { typography } from "@/constants/typography";
import { colors, semanticToneColors } from "@/constants/colors";
import { motion } from "@/constants/motion";
import { getMoodHex } from "@/lib/moodPresentation";
import type { MoodEntry } from "@db/types";

const DOT_COUNT = 14;
const DOT_SIZE = 8;
const DOT_GAP = 6;

interface InsightsHeaderProps {
  moods: MoodEntry[];
  totalEntries: number;
  onRefresh: () => void | Promise<void>;
}

interface RhythmDotProps {
  color: string;
  isData: boolean;
  isLatest: boolean;
  index: number;
  visibleCount: number;
}

/**
 * One dot in the rhythm strip. Data dots ease in from the right on mount or
 * whenever the dot identity changes (data refresh). The newest data dot also
 * carries a slow continuous breath so the page never sits perfectly still.
 */
function RhythmDot({ color, isData, isLatest, index, visibleCount }: RhythmDotProps) {
  const entry = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!isData) {
      entry.value = 1;
      return;
    }
    // Stagger from the right so newer dots arrive first.
    const fromRight = visibleCount - 1 - index;
    const delay = Math.max(0, fromRight * 28);
    entry.value = 0;
    entry.value = withDelay(
      delay,
      withTiming(1, {
        duration: motion.duration.normal,
        easing: Easing.out(Easing.quad),
      })
    );
  }, [color, isData, visibleCount, index, entry]);

  useEffect(() => {
    if (!isLatest || !isData) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
  }, [isLatest, isData, pulse]);

  const animatedStyle = useAnimatedStyle(() => {
    const entryOpacity = isData ? entry.value : 0.55;
    // Pulse modulates a soft glow scale on the newest dot.
    const pulseScale = isLatest ? 1 + pulse.value * 0.18 : 1;
    const pulseGlow = isLatest ? 0.55 + pulse.value * 0.45 : 1;
    return {
      opacity: isData ? entryOpacity * pulseGlow : 0.55,
      transform: [
        { translateX: isData ? (1 - entry.value) * 8 : 0 },
        { scale: pulseScale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

/**
 * Insights header carries a "reflection rhythm" — a strip of the most recent
 * mood entries rendered as soft colored beads. Newest on the right so it reads
 * like an unfolding timeline. The strip dims to paper when there's nothing to
 * show yet so the visual still anchors the page without lying about data.
 */
export function InsightsHeader({ moods, totalEntries, onRefresh }: InsightsHeaderProps) {
  const isDark = useColorScheme() === "dark";

  const recent = useMemo(() => {
    // Most recent first in the data; reverse to put newest on the right.
    const slice = moods.slice(0, DOT_COUNT);
    return slice.reverse();
  }, [moods]);

  const emptyDot = isDark ? "rgba(199, 216, 188, 0.10)" : "rgba(157, 134, 96, 0.14)";
  const titleColor = isDark ? colors.text.dark : colors.text.light;
  const subtitleColor = isDark ? colors.textSubtle.dark : colors.textMuted.light;
  const sage = isDark ? semanticToneColors.sage.dark : semanticToneColors.sage.light;

  const subtitle = useMemo(() => {
    if (totalEntries === 0) return "Tracked moods will gather here";
    if (totalEntries === 1) return "Patterns across 1 entry";
    return `Patterns across ${totalEntries} entries`;
  }, [totalEntries]);

  const slots = useMemo(() => {
    const filled = recent.length;
    const empty = Math.max(0, DOT_COUNT - filled);
    const items: {
      key: string;
      color: string;
      isData: boolean;
      isLatest: boolean;
    }[] = [];
    for (let i = 0; i < empty; i++) {
      items.push({ key: `e${i}`, color: emptyDot, isData: false, isLatest: false });
    }
    recent.forEach((entry, i) => {
      const isLatest = i === recent.length - 1;
      items.push({
        key: `m${entry.id ?? i}`,
        color: getMoodHex(entry.mood, isDark),
        isData: true,
        isLatest,
      });
    });
    return items;
  }, [recent, emptyDot, isDark]);

  return (
    <View style={styles.container}>
      <View style={styles.rhythmRow} accessible accessibilityLabel="Recent mood rhythm">
        {slots.map((slot, index) => (
          <RhythmDot
            key={slot.key}
            color={slot.color}
            isData={slot.isData}
            isLatest={slot.isLatest}
            index={index}
            visibleCount={slots.length}
          />
        ))}
      </View>

      <View style={styles.titleRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[typography.titleMd, { color: titleColor }]} numberOfLines={1}>
            Insights
          </Text>
          <Text
            style={[typography.bodySm, { color: subtitleColor, marginTop: 2 }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>

        <Pressable
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.refresh,
            {
              backgroundColor: sage.bg,
              borderColor: sage.border,
            },
            pressed ? { opacity: 0.7, transform: [{ scale: 0.97 }] } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Refresh insights"
          hitSlop={8}
        >
          <Ionicons name="refresh" size={16} color={sage.fg} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  rhythmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: DOT_GAP,
    marginBottom: 14,
    height: DOT_SIZE + 2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default InsightsHeader;
