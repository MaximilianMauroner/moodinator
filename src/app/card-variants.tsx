/**
 * Mood Entry Card — 8 visual design variants showcase
 *
 * Each variant renders the same sample data with a completely
 * different aesthetic treatment:
 *
 *  1. Current (Accent-Bar)  — left coloured bar, clean hierarchy
 *  2. Big Score             — giant mood number as hero element
 *  3. Horizontal Chip       — single dense row, compact timeline style
 *  4. Top-Banner            — full-width colour wash header band
 *  5. Score Circle          — circular score badge on the right
 *  6. Minimal Ghost         — hairline border, whitespace-first
 *  7. Split-Half            — left coloured panel + right content
 *  8. Bubble Cluster        — tags as large pill cluster, score inline
 */

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors, colors } from "@/constants/colors";
import { moodScale } from "@/constants/moodScale";

// ─── Sample data ────────────────────────────────────────────────────────────

interface SampleEntry {
  mood: number;
  energy: number;
  date: string;
  time: string;
  note?: string;
  emotions: Array<{ name: string; category: "positive" | "negative" | "neutral" }>;
  contextTags: string[];
}

const SAMPLES: SampleEntry[] = [
  {
    mood: 10,
    energy: 2,
    date: "Thu, Apr 30",
    time: "9:15 PM",
    emotions: [{ name: "Curious", category: "neutral" }],
    contextTags: ["Commuting"],
  },
  {
    mood: 0,
    energy: 10,
    date: "Thu, Apr 30",
    time: "5:09 PM",
    emotions: [
      { name: "Guilty", category: "negative" },
      { name: "Happy", category: "positive" },
    ],
    contextTags: ["Outside", "Work"],
  },
  {
    mood: 6,
    energy: 5,
    date: "Wed, Apr 29",
    time: "7:11 AM",
    note: "Struggling with anxiety",
    emotions: [{ name: "Loved", category: "positive" }],
    contextTags: ["Work", "Commuting"],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useMoodData(moodValue: number, isDark: boolean) {
  const info = moodScale.find((m) => m.value === moodValue);
  return {
    label: info?.label ?? `Mood ${moodValue}`,
    textHex: isDark ? (info?.textHexDark ?? "#D4C4A0") : (info?.textHex ?? "#9D8660"),
    bgHex: isDark ? (info?.bgHexDark ?? "#302A22") : (info?.bgHex ?? "#F9F5ED"),
  };
}

function EmotionTag({
  name,
  category,
  isDark,
}: {
  name: string;
  category: "positive" | "negative" | "neutral";
  isDark: boolean;
}) {
  const catColors = {
    positive: {
      bg: isDark ? colors.positive.bg.dark : colors.positive.bg.light,
      text: isDark ? colors.positive.text.dark : colors.positive.text.light,
    },
    negative: {
      bg: isDark ? colors.negative.bg.dark : colors.negative.bg.light,
      text: isDark ? colors.negative.text.dark : colors.negative.text.light,
    },
    neutral: {
      bg: isDark ? colors.neutral.bg.dark : colors.neutral.bg.light,
      text: isDark ? colors.neutral.text.dark : colors.neutral.text.light,
    },
  }[category];

  return (
    <View
      className="px-2.5 py-1 rounded-lg mr-1.5 mb-1.5"
      style={{ backgroundColor: catColors.bg }}
    >
      <Text className="text-xs font-medium" style={{ color: catColors.text }}>
        {name}
      </Text>
    </View>
  );
}

function ContextTag({ tag, isDark }: { tag: string; isDark: boolean }) {
  return (
    <View
      className="px-2.5 py-1 rounded-lg mr-1.5 mb-1.5"
      style={{
        backgroundColor: isDark ? colors.neutral.bg.dark : colors.neutral.bg.light,
      }}
    >
      <Text
        className="text-xs font-medium"
        style={{ color: isDark ? colors.neutral.text.dark : colors.neutral.text.light }}
      >
        #{tag}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 1 — Current (Left Accent Bar)
// ─────────────────────────────────────────────────────────────────────────────
function V1AccentBar({ entry, isDark, get, getCategoryColors }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? "rgba(168,197,168,0.14)" : "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: isDark ? 3 : 4 },
        shadowOpacity: isDark ? 0.32 : 0.07,
        shadowRadius: isDark ? 8 : 12,
        elevation: 3,
      }}
    >
      <View className="flex-row">
        <View style={{ width: 4, backgroundColor: moodData.textHex }} />
        <View className="flex-1 p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center flex-1">
              <View
                className="flex-row items-center px-3 py-1.5 rounded-xl mr-3"
                style={{ backgroundColor: moodData.bgHex }}
              >
                <Text
                  className="text-lg font-bold mr-1.5"
                  style={{ color: moodData.textHex }}
                >
                  {entry.mood}
                </Text>
                <Text className="text-sm font-semibold" style={{ color: moodData.textHex }}>
                  {moodData.label}
                </Text>
              </View>
              <View
                className="px-2 py-1 rounded-lg"
                style={{
                  backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light,
                }}
              >
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
                >
                  Energy {entry.energy}/10
                </Text>
              </View>
            </View>
            <Text className="text-xs" style={{ color: get("textMuted") }}>
              {entry.date} · {entry.time}
            </Text>
          </View>
          {entry.note ? (
            <View
              className="rounded-xl p-3 mb-3"
              style={{ backgroundColor: get("surfaceAlt") }}
            >
              <Text className="text-sm leading-5" style={{ color: get("textSubtle") }}>
                {entry.note}
              </Text>
            </View>
          ) : null}
          <View className="flex-row flex-wrap">
            {entry.emotions.map((e) => (
              <EmotionTag key={e.name} name={e.name} category={e.category} isDark={isDark} />
            ))}
            {entry.contextTags.map((t) => (
              <ContextTag key={t} tag={t} isDark={isDark} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 2 — Big Score Hero
// ─────────────────────────────────────────────────────────────────────────────
function V2BigScore({ entry, isDark, get }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
        borderWidth: 1,
        borderColor: moodData.textHex + "33",
        shadowColor: moodData.textHex,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.18 : 0.12,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <View className="flex-row items-stretch">
        {/* Left: huge number */}
        <View
          className="items-center justify-center px-5"
          style={{ backgroundColor: moodData.bgHex, minWidth: 72 }}
        >
          <Text
            style={{
              fontSize: 52,
              fontWeight: "900",
              color: moodData.textHex,
              lineHeight: 60,
              fontVariant: ["tabular-nums"],
            }}
          >
            {entry.mood}
          </Text>
        </View>

        {/* Right: content */}
        <View className="flex-1 p-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-base font-bold" style={{ color: moodData.textHex }}>
              {moodData.label}
            </Text>
            <Text className="text-[10px]" style={{ color: get("textMuted") }}>
              {entry.time}
            </Text>
          </View>
          <Text className="text-xs mb-2" style={{ color: get("textMuted") }}>
            {entry.date} · Energy {entry.energy}/10
          </Text>

          {entry.note ? (
            <Text className="text-xs mb-2 italic" style={{ color: get("textSubtle") }}>
              &ldquo;{entry.note}&rdquo;
            </Text>
          ) : null}

          <View className="flex-row flex-wrap">
            {entry.emotions.map((e) => (
              <EmotionTag key={e.name} name={e.name} category={e.category} isDark={isDark} />
            ))}
            {entry.contextTags.map((t) => (
              <ContextTag key={t} tag={t} isDark={isDark} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 3 — Horizontal Chip (ultra-compact timeline row)
// ─────────────────────────────────────────────────────────────────────────────
function V3HorizontalChip({ entry, isDark, get }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  const allTags = [
    ...entry.emotions.map((e) => e.name),
    ...entry.contextTags.map((t) => `#${t}`),
  ];
  return (
    <View
      className="rounded-xl px-4 py-3"
      style={{
        backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? "rgba(168,197,168,0.12)" : "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.22 : 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {/* Timeline line */}
      <View className="flex-row items-center gap-3">
        {/* Score dot */}
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: moodData.bgHex }}
        >
          <Text
            className="text-sm font-bold"
            style={{ color: moodData.textHex, fontVariant: ["tabular-nums"] }}
          >
            {entry.mood}
          </Text>
        </View>

        {/* Label + tags */}
        <View className="flex-1">
          <View className="flex-row items-center flex-wrap gap-1.5">
            <Text className="text-sm font-semibold" style={{ color: get("text") }}>
              {moodData.label}
            </Text>
            {allTags.map((tag) => (
              <View
                key={tag}
                className="px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: isDark
                    ? colors.neutral.bg.dark
                    : colors.neutral.bg.light,
                }}
              >
                <Text
                  className="text-[10px] font-medium"
                  style={{ color: isDark ? colors.neutral.text.dark : colors.neutral.text.light }}
                >
                  {tag}
                </Text>
              </View>
            ))}
          </View>
          {entry.note ? (
            <Text className="text-xs mt-0.5" style={{ color: get("textSubtle") }} numberOfLines={1}>
              {entry.note}
            </Text>
          ) : null}
        </View>

        {/* Right: time + energy */}
        <View className="items-end">
          <Text className="text-xs font-medium" style={{ color: get("textMuted") }}>
            {entry.time}
          </Text>
          <Text className="text-[10px]" style={{ color: get("textMuted") }}>
            ⚡{entry.energy}/10
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 4 — Top-Banner Wash
// ─────────────────────────────────────────────────────────────────────────────
function V4TopBanner({ entry, isDark, get }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
        shadowColor: moodData.textHex,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      {/* Coloured header band */}
      <View
        className="px-4 py-3 flex-row items-center justify-between"
        style={{ backgroundColor: moodData.bgHex }}
      >
        <View className="flex-row items-center gap-3">
          <Text
            style={{ fontSize: 28, fontWeight: "900", color: moodData.textHex, fontVariant: ["tabular-nums"] }}
          >
            {entry.mood}
          </Text>
          <Text className="text-lg font-bold" style={{ color: moodData.textHex }}>
            {moodData.label}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs font-semibold" style={{ color: moodData.textHex + "CC" }}>
            {entry.time}
          </Text>
          <Text className="text-[10px]" style={{ color: moodData.textHex + "99" }}>
            {entry.date}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View className="px-4 py-3">
        <View
          className="flex-row items-center px-2.5 py-1.5 rounded-lg self-start mb-3"
          style={{
            backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light,
          }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
          >
            Energy {entry.energy}/10
          </Text>
        </View>

        {entry.note ? (
          <Text className="text-sm leading-5 mb-3" style={{ color: get("textSubtle") }}>
            {entry.note}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap">
          {entry.emotions.map((e) => (
            <EmotionTag key={e.name} name={e.name} category={e.category} isDark={isDark} />
          ))}
          {entry.contextTags.map((t) => (
            <ContextTag key={t} tag={t} isDark={isDark} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 5 — Score Circle (right-aligned ring)
// ─────────────────────────────────────────────────────────────────────────────
function V5ScoreCircle({ entry, isDark, get }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  return (
    <View
      className="rounded-2xl p-4"
      style={{
        backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? "rgba(168,197,168,0.12)" : "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.28 : 0.06,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <View className="flex-row items-center">
        {/* Left: all content */}
        <View className="flex-1 pr-4">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-base font-bold" style={{ color: get("text") }}>
              {moodData.label}
            </Text>
          </View>
          <Text className="text-xs mb-2" style={{ color: get("textMuted") }}>
            {entry.date} · {entry.time} · Energy {entry.energy}/10
          </Text>

          {entry.note ? (
            <View
              className="rounded-xl p-2.5 mb-2"
              style={{ backgroundColor: get("surfaceAlt") }}
            >
              <Text className="text-xs leading-4" style={{ color: get("textSubtle") }}>
                {entry.note}
              </Text>
            </View>
          ) : null}

          <View className="flex-row flex-wrap">
            {entry.emotions.map((e) => (
              <EmotionTag key={e.name} name={e.name} category={e.category} isDark={isDark} />
            ))}
            {entry.contextTags.map((t) => (
              <ContextTag key={t} tag={t} isDark={isDark} />
            ))}
          </View>
        </View>

        {/* Right: circle score */}
        <View
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{
            backgroundColor: moodData.bgHex,
            borderWidth: 2.5,
            borderColor: moodData.textHex + "66",
          }}
        >
          <Text
            style={{
              fontSize: 26,
              fontWeight: "900",
              color: moodData.textHex,
              fontVariant: ["tabular-nums"],
            }}
          >
            {entry.mood}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 6 — Minimal Ghost (hairline border, lots of whitespace)
// ─────────────────────────────────────────────────────────────────────────────
function V6MinimalGhost({ entry, isDark, get }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  return (
    <View
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: isDark
          ? moodData.textHex + "40"
          : moodData.textHex + "35",
      }}
    >
      {/* Top row */}
      <View className="flex-row items-baseline justify-between mb-2">
        <View className="flex-row items-baseline gap-2">
          <Text
            style={{
              fontSize: 36,
              fontWeight: "900",
              color: moodData.textHex,
              fontVariant: ["tabular-nums"],
              lineHeight: 38,
            }}
          >
            {entry.mood}
          </Text>
          <Text
            className="text-sm font-semibold tracking-wide uppercase"
            style={{ color: moodData.textHex + "BB" }}
          >
            {moodData.label}
          </Text>
        </View>
        <Text className="text-xs" style={{ color: get("textMuted") }}>
          {entry.time}
        </Text>
      </View>

      {/* Divider */}
      <View
        className="h-px mb-3"
        style={{ backgroundColor: isDark ? "rgba(168,197,168,0.12)" : "rgba(61,53,42,0.08)" }}
      />

      <Text className="text-xs mb-3" style={{ color: get("textMuted") }}>
        {entry.date} · Energy {entry.energy}/10
      </Text>

      {entry.note ? (
        <Text className="text-sm leading-5 mb-3" style={{ color: get("textSubtle") }}>
          {entry.note}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap">
        {entry.emotions.map((e) => (
          <EmotionTag key={e.name} name={e.name} category={e.category} isDark={isDark} />
        ))}
        {entry.contextTags.map((t) => (
          <ContextTag key={t} tag={t} isDark={isDark} />
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 7 — Split-Half (coloured left panel + white right)
// ─────────────────────────────────────────────────────────────────────────────
function V7SplitHalf({ entry, isDark, get }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
        shadowColor: moodData.textHex,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.2 : 0.1,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View className="flex-row" style={{ minHeight: 88 }}>
        {/* Coloured left panel ~38% width */}
        <View
          className="items-center justify-center px-4"
          style={{ backgroundColor: moodData.bgHex, minWidth: 96 }}
        >
          <Text
            style={{
              fontSize: 42,
              fontWeight: "900",
              color: moodData.textHex,
              lineHeight: 44,
              fontVariant: ["tabular-nums"],
            }}
          >
            {entry.mood}
          </Text>
          <Text
            className="text-xs font-bold text-center mt-1"
            style={{ color: moodData.textHex + "CC" }}
            numberOfLines={1}
          >
            {moodData.label}
          </Text>
          <View
            className="mt-2 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: moodData.textHex + "22" }}
          >
            <Text
              className="text-[10px] font-semibold"
              style={{ color: moodData.textHex }}
            >
              ⚡{entry.energy}/10
            </Text>
          </View>
        </View>

        {/* Right content */}
        <View className="flex-1 p-4 justify-between">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-medium" style={{ color: get("textMuted") }}>
              {entry.date}
            </Text>
            <Text className="text-xs" style={{ color: get("textMuted") }}>
              {entry.time}
            </Text>
          </View>

          {entry.note ? (
            <Text className="text-sm leading-5 mb-2" style={{ color: get("textSubtle") }}>
              {entry.note}
            </Text>
          ) : null}

          <View className="flex-row flex-wrap">
            {entry.emotions.map((e) => (
              <EmotionTag key={e.name} name={e.name} category={e.category} isDark={isDark} />
            ))}
            {entry.contextTags.map((t) => (
              <ContextTag key={t} tag={t} isDark={isDark} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT 8 — Bubble Cluster (score inline header, large rounded tags)
// ─────────────────────────────────────────────────────────────────────────────
function V8BubbleCluster({ entry, isDark, get }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  return (
    <View
      className="rounded-2xl p-4"
      style={{
        backgroundColor: isDark ? colors.surfaceAlt.dark : colors.surfaceAlt.light,
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? moodData.textHex + "28" : "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.06,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      {/* Inline header pill */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <View
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: moodData.bgHex }}
          >
            <Text
              className="text-base font-black"
              style={{ color: moodData.textHex, fontVariant: ["tabular-nums"] }}
            >
              {entry.mood}
            </Text>
            <Text className="text-xs font-bold" style={{ color: moodData.textHex }}>
              {moodData.label}
            </Text>
          </View>
          <View
            className="px-2.5 py-1.5 rounded-full"
            style={{
              backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light,
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
            >
              ⚡{entry.energy}/10
            </Text>
          </View>
        </View>
        <Text className="text-xs" style={{ color: get("textMuted") }}>
          {entry.time}
        </Text>
      </View>

      {/* Date */}
      <Text className="text-xs mb-2" style={{ color: get("textMuted") }}>
        {entry.date}
      </Text>

      {entry.note ? (
        <View
          className="rounded-xl px-3 py-2.5 mb-3"
          style={{
            backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
          }}
        >
          <Text className="text-sm leading-5" style={{ color: get("textSubtle") }}>
            {entry.note}
          </Text>
        </View>
      ) : null}

      {/* Large bubble tags */}
      <View className="flex-row flex-wrap gap-2">
        {entry.emotions.map((e) => {
          const catColor = {
            positive: {
              bg: isDark ? colors.positive.bg.dark : colors.positive.bg.light,
              text: isDark ? colors.positive.text.dark : colors.positive.text.light,
            },
            negative: {
              bg: isDark ? colors.negative.bg.dark : colors.negative.bg.light,
              text: isDark ? colors.negative.text.dark : colors.negative.text.light,
            },
            neutral: {
              bg: isDark ? colors.neutral.bg.dark : colors.neutral.bg.light,
              text: isDark ? colors.neutral.text.dark : colors.neutral.text.light,
            },
          }[e.category];
          return (
            <View
              key={e.name}
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: catColor.bg }}
            >
              <Text className="text-xs font-semibold" style={{ color: catColor.text }}>
                {e.name}
              </Text>
            </View>
          );
        })}
        {entry.contextTags.map((t) => (
          <View
            key={t}
            className="px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: isDark ? colors.neutral.bg.dark : colors.neutral.bg.light,
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: isDark ? colors.neutral.text.dark : colors.neutral.text.light }}
            >
              #{t}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared prop type
// ─────────────────────────────────────────────────────────────────────────────
type CardProps = {
  entry: SampleEntry;
  isDark: boolean;
  get: (key: "background" | "surface" | "surfaceAlt" | "surfaceElevated" | "text" | "textMuted" | "textSubtle" | "textInverse" | "primary" | "primaryMuted" | "primaryBg" | "primaryBgHover" | "border" | "borderSubtle") => string;
  getCategoryColors: (category: string | undefined, isSelected?: boolean) => { bg: string; text: string; border: string | undefined };
};

const VARIANTS: Array<{
  label: string;
  description: string;
  Component: React.ComponentType<CardProps>;
}> = [
  { label: "1 — Accent Bar", description: "Current design: left colour bar + pill header", Component: V1AccentBar },
  { label: "2 — Big Score Hero", description: "Large number dominates the left", Component: V2BigScore },
  { label: "3 — Compact Row", description: "Single-line density for busy feeds", Component: V3HorizontalChip },
  { label: "4 — Top Banner", description: "Full-width colour wash at the top", Component: V4TopBanner },
  { label: "5 — Score Circle", description: "Circular badge anchored to the right", Component: V5ScoreCircle },
  { label: "6 — Minimal Ghost", description: "Hairline border, generous whitespace", Component: V6MinimalGhost },
  { label: "7 — Split-Half", description: "Coloured left panel, white right", Component: V7SplitHalf },
  { label: "8 — Bubble Cluster", description: "Rounded-pill tags, score inline", Component: V8BubbleCluster },
];

// ─────────────────────────────────────────────────────────────────────────────
// Showcase screen
// ─────────────────────────────────────────────────────────────────────────────
export default function CardVariantsScreen() {
  const { isDark, get, getCategoryColors } = useThemeColors();
  const [activeSample, setActiveSample] = useState(0);
  const entry = SAMPLES[activeSample];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background.dark : colors.background.light }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="pt-6 pb-4">
          <Text
            className="text-2xl font-black mb-1"
            style={{ color: get("text") }}
          >
            Card Variants
          </Text>
          <Text className="text-sm" style={{ color: get("textMuted") }}>
            8 different visual treatments for the same mood entry
          </Text>
        </View>

        {/* Sample picker */}
        <View
          className="rounded-2xl p-3 mb-6 flex-row gap-2"
          style={{
            backgroundColor: isDark ? colors.surface.dark : colors.surface.light,
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? "rgba(168,197,168,0.12)" : "transparent",
          }}
        >
          {SAMPLES.map((s, i) => {
            const md = moodScale.find((m) => m.value === s.mood);
            const textHex = isDark ? (md?.textHexDark ?? "#D4C4A0") : (md?.textHex ?? "#9D8660");
            const bgHex = isDark ? (md?.bgHexDark ?? "#302A22") : (md?.bgHex ?? "#F9F5ED");
            const active = activeSample === i;
            return (
              <Pressable
                key={i}
                onPress={() => setActiveSample(i)}
                className="flex-1 items-center py-2 rounded-xl"
                style={{ backgroundColor: active ? bgHex : "transparent" }}
              >
                <Text
                  className="text-lg font-black"
                  style={{ color: active ? textHex : get("textMuted") }}
                >
                  {s.mood}
                </Text>
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: active ? textHex : get("textMuted") }}
                >
                  {md?.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Variant cards */}
        {VARIANTS.map(({ label, description, Component }) => (
          <View key={label} className="mb-8">
            {/* Label */}
            <View className="mb-2">
              <Text className="text-sm font-bold" style={{ color: get("text") }}>
                {label}
              </Text>
              <Text className="text-xs" style={{ color: get("textMuted") }}>
                {description}
              </Text>
            </View>
            <Component
              entry={entry}
              isDark={isDark}
              get={get}
              getCategoryColors={getCategoryColors}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
