import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MoodEntry } from "@db/types";

import { useThemeColors } from "@/constants/colors";
import { getMoodRatingDisplay } from "@/constants/moodScaleInterpretation";
import { getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";
import { typography } from "@/constants/typography";
import { getEntryLocalTimeLabel } from "@/lib/entryTimezone";

/** Earlier entries shown on Today; the rest are one tap away in History. */
export const EARLIER_TODAY_LIMIT = 2;

function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

/** Emotions and context of an entry as one line, for example "Tired · #Work". */
function getEntryDetail(entry: MoodEntry): string {
  return [
    entry.emotions.map((emotion) => emotion.name).join(", "),
    entry.contextTags.map((tag) => `#${tag}`).join(" "),
  ].filter(Boolean).join(" · ");
}

type TodayNowProps = {
  /** Today's newest entry, if any. */
  latest?: MoodEntry;
  /** False until the first read of today's entries completes. */
  loaded: boolean;
  onOpen: (entry: MoodEntry) => void;
};

/** The inner weather now: today's newest entry as its sign, word, and number. */
export function TodayNow({ latest, loaded, onOpen }: TodayNowProps) {
  const { isDark, get } = useThemeColors();

  if (!latest) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Ionicons name="partly-sunny-outline" size={56} color={get("textSubtle")} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.titleMd, { color: get("text"), fontSize: 28, lineHeight: 34 }]}>
            {getGreeting(new Date())}
          </Text>
          {loaded ? (
            <Text style={[typography.bodySm, { color: get("textSubtle") }]}>No check-in yet today</Text>
          ) : null}
        </View>
      </View>
    );
  }

  const display = getMoodRatingDisplay(latest.mood, isDark, latest.moodScale);
  const time = getEntryLocalTimeLabel(latest);
  const detail = getEntryDetail(latest);
  const note = latest.note?.trim();
  return (
    <Pressable
      onPress={() => onOpen(latest)}
      accessibilityRole="button"
      accessibilityLabel={[`Last check-in: ${display.label} ${display.value} at ${time}`, detail, note].filter(Boolean).join(". ")}
      accessibilityHint="Opens this entry's details"
      style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
    >
      <Ionicons name={getMoodWeatherIcon(display.value)} size={56} color={getMoodWeatherColor(display.value, isDark)} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.titleMd, { color: get("text"), fontSize: 28, lineHeight: 34 }]}>
          {display.label} <Text style={{ color: get("textSubtle") }}>{display.value}</Text>
        </Text>
        <Text style={[typography.bodySm, { color: get("textSubtle") }]}>Last check-in at {time}</Text>
        {detail ? (
          <Text numberOfLines={1} style={{ color: get("textSubtle"), fontSize: 13, marginTop: 4 }}>{detail}</Text>
        ) : null}
        {note ? (
          <Text numberOfLines={1} style={{ color: get("text"), fontSize: 13, marginTop: 2, opacity: 0.9 }}>{note}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type EarlierTodayProps = {
  /** Today's entries before the newest one, newest first. */
  entries: MoodEntry[];
  onOpen: (entry: MoodEntry) => void;
  onShowAll: () => void;
};

/** Up to two earlier entries with their emotions, context, and note. */
export function EarlierToday({ entries, onOpen, onShowAll }: EarlierTodayProps) {
  const { isDark, get } = useThemeColors();
  if (entries.length === 0) return null;

  const shown = entries.slice(0, EARLIER_TODAY_LIMIT);
  const more = entries.length - shown.length;

  return (
    <View>
      <Text style={[typography.eyebrow, { color: get("textSubtle"), marginBottom: 2 }]}>Earlier today</Text>
      {shown.map((entry) => {
        const display = getMoodRatingDisplay(entry.mood, isDark, entry.moodScale);
        const time = getEntryLocalTimeLabel(entry);
        const detail = getEntryDetail(entry);
        const note = entry.note?.trim();
        return (
          <Pressable
            key={entry.id}
            testID={`today-entry-${entry.timestamp}`}
            onPress={() => onOpen(entry)}
            accessibilityRole="button"
            accessibilityLabel={[`${display.label} ${display.value} at ${time}`, detail, note].filter(Boolean).join(". ")}
            accessibilityHint="Opens this entry's details"
            style={{
              flexDirection: "row",
              gap: 12,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: get("border"),
            }}
          >
            <Ionicons name={getMoodWeatherIcon(display.value)} size={24} color={getMoodWeatherColor(display.value, isDark)} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: get("text"), fontSize: 15, fontWeight: "500" }}>
                  {display.label} <Text style={{ color: get("textSubtle") }}>{display.value}</Text>
                </Text>
                <Text style={{ color: get("textSubtle"), fontSize: 13 }}>{time}</Text>
              </View>
              {detail ? (
                <Text numberOfLines={1} style={{ color: get("textSubtle"), fontSize: 13, marginTop: 1 }}>
                  {detail}
                </Text>
              ) : null}
              {note ? (
                <Text numberOfLines={1} style={{ color: get("text"), fontSize: 13, marginTop: 2, opacity: 0.9 }}>
                  {note}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {more > 0 ? (
        <Pressable
          onPress={onShowAll}
          accessibilityRole="link"
          accessibilityLabel={`${more} more today. Opens History`}
          style={{ paddingVertical: 10, minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: get("textSubtle"), fontSize: 13 }}>
            {more} more today · <Text style={{ color: get("primary") }}>History ›</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
