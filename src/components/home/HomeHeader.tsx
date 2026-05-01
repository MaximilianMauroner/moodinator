import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { typography } from "@/constants/typography";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { calculateStreak } from "@/features/insights/utils/patternDetection";
import { moodScale } from "@/constants/moodScale";

interface HomeHeaderProps {
  lastTracked: Date | null;
}

function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

function formatRelative(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) return "just now";

  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date.toDateString() === now.toDateString()) {
    return `today, ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `yesterday, ${time}`;
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Header for the home screen.
 *
 * Replaces the previous decorative title block with a compact dashboard strip:
 *   Row 1 — brand · today's date · streak chip (when active)
 *   Row 2 — time-aware greeting + last-entry summary
 *
 * Pulls live data from the moods store; no extra fetch.
 */
export function HomeHeader({ lastTracked }: HomeHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const moods = useMoodsStore((s) => s.moods);
  const streak = useMemo(() => calculateStreak(moods), [moods]);

  // Find the actual last-entry mood by matching its timestamp,
  // since the moods array isn't guaranteed to be sorted.
  const lastMood = useMemo(() => {
    if (!lastTracked) return null;
    const ts = lastTracked.getTime();
    return moods.find((m) => m.timestamp === ts) ?? null;
  }, [moods, lastTracked]);

  const lastMoodLabel = lastMood
    ? moodScale.find((m) => m.value === lastMood.mood)?.label ?? null
    : null;

  const now = new Date();
  const greeting = getGreeting(now);
  const dateLabel = now
    .toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .replace(",", " ·");

  // Lifted sage accents — match new "breezy" dark palette
  const accent = isDark ? "#A8C5A8" : "#5B8A5B";
  const accentMuted = isDark ? "#7BA87B" : "#9D8660";

  const chipBaseStyle = {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  } as const;

  return (
    <View className="-mx-4 px-6 pt-1 pb-2 mb-3">
      {/* Greeting on the left, date + streak chips floating to the upper right.
          The chips top-align with the greeting's cap-height for a clean masthead feel. */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="text-paper-800 dark:text-paper-100"
            style={[typography.titleMd, { letterSpacing: -0.4 }]}
          >
            {greeting}
          </Text>
          {lastTracked && lastMoodLabel ? (
            <Text
              className="text-sand-600 dark:text-sand-400 mt-1"
              style={typography.bodySm}
            >
              Last entry — {formatRelative(lastTracked, now)} ·{" "}
              <Text style={{ color: accent, fontWeight: "600" }}>{lastMoodLabel}</Text>
            </Text>
          ) : (
            <Text
              className="text-sand-600 dark:text-sand-400 mt-1"
              style={typography.bodySm}
            >
              How&rsquo;s the weather inside today?
            </Text>
          )}
        </View>

        <View
          className="flex-row items-center"
          style={{ gap: 6, paddingTop: 8 }}
        >
          <View
            style={{
              ...chipBaseStyle,
              backgroundColor: isDark ? "rgba(168, 197, 168, 0.12)" : "#F4F7F4",
              borderColor: isDark ? "rgba(168, 197, 168, 0.22)" : "#E8EFE8",
            }}
          >
            <Text
              style={[
                typography.eyebrow,
                { fontSize: 10, letterSpacing: 0.6, color: accentMuted },
              ]}
            >
              {dateLabel}
            </Text>
          </View>

          {streak.current > 0 ? (
            <View
              style={{
                ...chipBaseStyle,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: isDark ? "rgba(168, 197, 168, 0.18)" : "#E8EFE8",
                borderColor: isDark ? "rgba(168, 197, 168, 0.35)" : "#D1DFD1",
              }}
            >
              <Text style={{ fontSize: 11, marginRight: 4 }}>🌿</Text>
              <Text
                style={[
                  typography.eyebrow,
                  {
                    fontSize: 10,
                    letterSpacing: 0.6,
                    color: accent,
                    fontWeight: "700",
                  },
                ]}
              >
                {streak.current}
                {streak.current === 1 ? " day" : "d"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default HomeHeader;
