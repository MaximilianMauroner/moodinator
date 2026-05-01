import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { useThemeColors } from "@/constants/colors";
import { moodScale } from "@/constants/moodScale";

interface SampleEntry {
  mood: number;
  energy: number;
  date: string;
  time: string;
  note?: string;
  comments?: string[];
  emotions: Array<{
    name: string;
    category: "positive" | "negative" | "neutral";
  }>;
  contextTags: string[];
}

const SAMPLES: SampleEntry[] = [
  {
    mood: 10,
    energy: 2,
    date: "Thu, Apr 30",
    time: "9:15 PM",
    comments: ["Traffic made everything feel louder than usual."],
    emotions: [{ name: "Curious", category: "neutral" }],
    contextTags: ["Commuting"],
  },
  {
    mood: 0,
    energy: 10,
    date: "Thu, Apr 30",
    time: "5:09 PM",
    comments: [
      "Walked home in the sun and finally felt clear again.",
      "Wrapped the hard part of the workday before dinner.",
    ],
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
    comments: [
      "Slept badly and woke up tense.",
      "Coffee helped a little, but I still feel behind.",
    ],
    emotions: [{ name: "Loved", category: "positive" }],
    contextTags: ["Work", "Commuting"],
  },
];

function useMoodData(moodValue: number, isDark: boolean) {
  const info = moodScale.find((m) => m.value === moodValue);

  return {
    label: info?.label ?? `Mood ${moodValue}`,
    textHex: isDark
      ? (info?.textHexDark ?? "#D4C4A0")
      : (info?.textHex ?? "#9D8660"),
    bgHex: isDark ? (info?.bgHexDark ?? "#302A22") : (info?.bgHex ?? "#F9F5ED"),
  };
}

type ThemeGetter = ReturnType<typeof useThemeColors>["get"];
type CategoryColorGetter = ReturnType<typeof useThemeColors>["getCategoryColors"];

function EmotionTag({
  name,
  category,
  getCategoryColors,
}: {
  name: string;
  category: "positive" | "negative" | "neutral";
  getCategoryColors: CategoryColorGetter;
}) {
  const categoryColors = getCategoryColors(category);

  return (
    <View
      className="mr-1.5 mb-1.5 rounded-lg px-2.5 py-1"
      style={{ backgroundColor: categoryColors.bg }}
    >
      <Text className="text-xs font-medium" style={{ color: categoryColors.text }}>
        {name}
      </Text>
    </View>
  );
}

function ContextTag({
  tag,
  getCategoryColors,
}: {
  tag: string;
  getCategoryColors: CategoryColorGetter;
}) {
  const categoryColors = getCategoryColors("neutral");

  return (
    <View
      className="mr-1.5 mb-1.5 rounded-lg px-2.5 py-1"
      style={{ backgroundColor: categoryColors.bg }}
    >
      <Text className="text-xs font-medium" style={{ color: categoryColors.text }}>
        #{tag}
      </Text>
    </View>
  );
}

type CardProps = {
  entry: SampleEntry;
  isDark: boolean;
  get: ThemeGetter;
  getCategoryColors: CategoryColorGetter;
};

function CommentsPreview({
  comments,
  get,
  variant,
}: {
  comments: string[] | undefined;
  get: ThemeGetter;
  variant?: "default" | "compact" | "ghost";
}) {
  if (!comments?.length) {
    return null;
  }

  const backgroundColor =
    variant === "ghost" ? "transparent" : get("surfaceAlt");
  const borderWidth = variant === "ghost" ? 1 : 0;
  const paddingClass = variant === "compact" ? "px-3 py-2.5" : "p-3";

  return (
    <View
      className={`mb-3 rounded-xl ${paddingClass}`}
      style={{
        backgroundColor,
        borderWidth,
        borderColor: get("borderSubtle"),
      }}
    >
      <Text
        className="mb-2 text-[10px] font-bold uppercase tracking-wide"
        style={{ color: get("textMuted") }}
      >
        Comments
      </Text>
      {comments.map((comment, index) => (
        <Text
          key={`${index}-${comment}`}
          className={index === comments.length - 1 ? "text-sm leading-5" : "mb-1.5 text-sm leading-5"}
          style={{ color: get("textSubtle") }}
        >
          {comment}
        </Text>
      ))}
    </View>
  );
}

function V1AccentBar({ entry, isDark, get, getCategoryColors }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);

  return (
    <View
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: get("surface"),
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
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center">
              <View
                className="mr-3 flex-row items-center rounded-xl px-3 py-1.5"
                style={{ backgroundColor: moodData.bgHex }}
              >
                <Text
                  className="mr-1.5 text-lg font-bold"
                  style={{ color: moodData.textHex }}
                >
                  {entry.mood}
                </Text>
                <Text className="text-sm font-semibold" style={{ color: moodData.textHex }}>
                  {moodData.label}
                </Text>
              </View>
              <View
                className="rounded-lg px-2 py-1"
                style={{ backgroundColor: get("surfaceAlt") }}
              >
                <Text className="text-[10px] font-semibold" style={{ color: get("textSubtle") }}>
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
              className="mb-3 rounded-xl p-3"
              style={{ backgroundColor: get("surfaceAlt") }}
            >
              <Text className="text-sm leading-5" style={{ color: get("textSubtle") }}>
                {entry.note}
              </Text>
            </View>
          ) : null}

          <CommentsPreview comments={entry.comments} get={get} />

          <View className="flex-row flex-wrap">
            {entry.emotions.map((emotion) => (
              <EmotionTag
                key={emotion.name}
                name={emotion.name}
                category={emotion.category}
                getCategoryColors={getCategoryColors}
              />
            ))}
            {entry.contextTags.map((tag) => (
              <ContextTag key={tag} tag={tag} getCategoryColors={getCategoryColors} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function V2BigScore({ entry, isDark, get, getCategoryColors }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);

  return (
    <View
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: get("surface"),
        borderWidth: 1,
        borderColor: `${moodData.textHex}33`,
        shadowColor: moodData.textHex,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.18 : 0.12,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <View className="flex-row items-stretch">
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

        <View className="flex-1 p-4">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-base font-bold" style={{ color: moodData.textHex }}>
              {moodData.label}
            </Text>
            <Text className="text-[10px]" style={{ color: get("textMuted") }}>
              {entry.time}
            </Text>
          </View>

          <Text className="mb-2 text-xs" style={{ color: get("textMuted") }}>
            {entry.date} · Energy {entry.energy}/10
          </Text>

          {entry.note ? (
            <Text className="mb-2 text-xs italic" style={{ color: get("textSubtle") }}>
              &ldquo;{entry.note}&rdquo;
            </Text>
          ) : null}

          <CommentsPreview comments={entry.comments} get={get} variant="compact" />

          <View className="flex-row flex-wrap">
            {entry.emotions.map((emotion) => (
              <EmotionTag
                key={emotion.name}
                name={emotion.name}
                category={emotion.category}
                getCategoryColors={getCategoryColors}
              />
            ))}
            {entry.contextTags.map((tag) => (
              <ContextTag key={tag} tag={tag} getCategoryColors={getCategoryColors} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function V3HorizontalChip({ entry, isDark, get }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);
  const allTags = [
    ...entry.emotions.map((emotion) => emotion.name),
    ...entry.contextTags.map((tag) => `#${tag}`),
  ];

  return (
    <View
      className="rounded-xl px-4 py-3"
      style={{
        backgroundColor: get("surface"),
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? "rgba(168,197,168,0.12)" : "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.22 : 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: moodData.bgHex }}
        >
          <Text
            className="text-sm font-bold"
            style={{ color: moodData.textHex, fontVariant: ["tabular-nums"] }}
          >
            {entry.mood}
          </Text>
        </View>

        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="text-sm font-semibold" style={{ color: get("text") }}>
              {moodData.label}
            </Text>
            {allTags.map((tag) => (
              <View
                key={tag}
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: get("surfaceAlt") }}
              >
                <Text className="text-[10px] font-medium" style={{ color: get("textSubtle") }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
          {entry.note ? (
            <Text
              className="mt-0.5 text-xs"
              style={{ color: get("textSubtle") }}
              numberOfLines={1}
            >
              {entry.note}
            </Text>
          ) : null}
        </View>

        <View className="items-end">
          <Text className="text-xs font-medium" style={{ color: get("textMuted") }}>
            {entry.time}
          </Text>
          <Text className="text-[10px]" style={{ color: get("textMuted") }}>
            Energy {entry.energy}/10
          </Text>
        </View>
      </View>

      {entry.comments?.length ? (
        <View className="mt-3">
          <CommentsPreview comments={entry.comments} get={get} variant="compact" />
        </View>
      ) : null}
    </View>
  );
}

function V4TopBanner({ entry, isDark, get, getCategoryColors }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);

  return (
    <View
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: get("surface"),
        shadowColor: moodData.textHex,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View
        className="flex-row items-center justify-between px-4 py-3"
        style={{ backgroundColor: moodData.bgHex }}
      >
        <View className="flex-row items-center gap-3">
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: moodData.textHex,
              fontVariant: ["tabular-nums"],
            }}
          >
            {entry.mood}
          </Text>
          <Text className="text-lg font-bold" style={{ color: moodData.textHex }}>
            {moodData.label}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs font-semibold" style={{ color: `${moodData.textHex}CC` }}>
            {entry.time}
          </Text>
          <Text className="text-[10px]" style={{ color: `${moodData.textHex}99` }}>
            {entry.date}
          </Text>
        </View>
      </View>

      <View className="px-4 py-3">
        <View
          className="mb-3 self-start rounded-lg px-2.5 py-1.5"
          style={{ backgroundColor: get("surfaceAlt") }}
        >
          <Text className="text-xs font-semibold" style={{ color: get("textSubtle") }}>
            Energy {entry.energy}/10
          </Text>
        </View>

        {entry.note ? (
          <Text className="mb-3 text-sm leading-5" style={{ color: get("textSubtle") }}>
            {entry.note}
          </Text>
        ) : null}

        <CommentsPreview comments={entry.comments} get={get} />

        <View className="flex-row flex-wrap">
          {entry.emotions.map((emotion) => (
            <EmotionTag
              key={emotion.name}
              name={emotion.name}
              category={emotion.category}
              getCategoryColors={getCategoryColors}
            />
          ))}
          {entry.contextTags.map((tag) => (
            <ContextTag key={tag} tag={tag} getCategoryColors={getCategoryColors} />
          ))}
        </View>
      </View>
    </View>
  );
}

function V5ScoreCircle({ entry, isDark, get, getCategoryColors }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);

  return (
    <View
      className="rounded-2xl p-4"
      style={{
        backgroundColor: get("surface"),
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
        <View className="flex-1 pr-4">
          <View className="mb-1 flex-row items-center gap-2">
            <Text className="text-base font-bold" style={{ color: get("text") }}>
              {moodData.label}
            </Text>
          </View>
          <Text className="mb-2 text-xs" style={{ color: get("textMuted") }}>
            {entry.date} · {entry.time} · Energy {entry.energy}/10
          </Text>

          {entry.note ? (
            <View
              className="mb-2 rounded-xl p-2.5"
              style={{ backgroundColor: get("surfaceAlt") }}
            >
              <Text className="text-xs leading-4" style={{ color: get("textSubtle") }}>
                {entry.note}
              </Text>
            </View>
          ) : null}

          <CommentsPreview comments={entry.comments} get={get} variant="compact" />

          <View className="flex-row flex-wrap">
            {entry.emotions.map((emotion) => (
              <EmotionTag
                key={emotion.name}
                name={emotion.name}
                category={emotion.category}
                getCategoryColors={getCategoryColors}
              />
            ))}
            {entry.contextTags.map((tag) => (
              <ContextTag key={tag} tag={tag} getCategoryColors={getCategoryColors} />
            ))}
          </View>
        </View>

        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{
            backgroundColor: moodData.bgHex,
            borderWidth: 2.5,
            borderColor: `${moodData.textHex}66`,
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

function V6MinimalGhost({ entry, isDark, get, getCategoryColors }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);

  return (
    <View
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: isDark ? `${moodData.textHex}40` : `${moodData.textHex}35`,
      }}
    >
      <View className="mb-2 flex-row items-baseline justify-between">
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
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: `${moodData.textHex}BB` }}
          >
            {moodData.label}
          </Text>
        </View>
        <Text className="text-xs" style={{ color: get("textMuted") }}>
          {entry.time}
        </Text>
      </View>

      <View
        className="mb-3 h-px"
        style={{
          backgroundColor: isDark ? "rgba(168,197,168,0.12)" : "rgba(61,53,42,0.08)",
        }}
      />

      <Text className="mb-3 text-xs" style={{ color: get("textMuted") }}>
        {entry.date} · Energy {entry.energy}/10
      </Text>

      {entry.note ? (
        <Text className="mb-3 text-sm leading-5" style={{ color: get("textSubtle") }}>
          {entry.note}
        </Text>
      ) : null}

      <CommentsPreview comments={entry.comments} get={get} variant="ghost" />

      <View className="flex-row flex-wrap">
        {entry.emotions.map((emotion) => (
          <EmotionTag
            key={emotion.name}
            name={emotion.name}
            category={emotion.category}
            getCategoryColors={getCategoryColors}
          />
        ))}
        {entry.contextTags.map((tag) => (
          <ContextTag key={tag} tag={tag} getCategoryColors={getCategoryColors} />
        ))}
      </View>
    </View>
  );
}

function V7SplitHalf({ entry, isDark, get, getCategoryColors }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);

  return (
    <View
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: get("surface"),
        shadowColor: moodData.textHex,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.2 : 0.1,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View className="flex-row" style={{ minHeight: 88 }}>
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
            className="mt-1 text-center text-xs font-bold"
            style={{ color: `${moodData.textHex}CC` }}
            numberOfLines={1}
          >
            {moodData.label}
          </Text>
          <View
            className="mt-2 rounded-full px-2 py-0.5"
            style={{ backgroundColor: `${moodData.textHex}22` }}
          >
            <Text className="text-[10px] font-semibold" style={{ color: moodData.textHex }}>
              Energy {entry.energy}/10
            </Text>
          </View>
        </View>

        <View className="flex-1 justify-between p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-medium" style={{ color: get("textMuted") }}>
              {entry.date}
            </Text>
            <Text className="text-xs" style={{ color: get("textMuted") }}>
              {entry.time}
            </Text>
          </View>

          {entry.note ? (
            <Text className="mb-2 text-sm leading-5" style={{ color: get("textSubtle") }}>
              {entry.note}
            </Text>
          ) : null}

          <CommentsPreview comments={entry.comments} get={get} variant="compact" />

          <View className="flex-row flex-wrap">
            {entry.emotions.map((emotion) => (
              <EmotionTag
                key={emotion.name}
                name={emotion.name}
                category={emotion.category}
                getCategoryColors={getCategoryColors}
              />
            ))}
            {entry.contextTags.map((tag) => (
              <ContextTag key={tag} tag={tag} getCategoryColors={getCategoryColors} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function V8BubbleCluster({ entry, isDark, get, getCategoryColors }: CardProps) {
  const moodData = useMoodData(entry.mood, isDark);

  return (
    <View
      className="rounded-2xl p-4"
      style={{
        backgroundColor: get("surfaceAlt"),
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? `${moodData.textHex}28` : "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.06,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
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
            className="rounded-full px-2.5 py-1.5"
            style={{ backgroundColor: get("surface") }}
          >
            <Text className="text-xs font-semibold" style={{ color: get("textSubtle") }}>
              Energy {entry.energy}/10
            </Text>
          </View>
        </View>
        <Text className="text-xs" style={{ color: get("textMuted") }}>
          {entry.time}
        </Text>
      </View>

      <Text className="mb-2 text-xs" style={{ color: get("textMuted") }}>
        {entry.date}
      </Text>

      {entry.note ? (
        <View className="mb-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: get("surface") }}>
          <Text className="text-sm leading-5" style={{ color: get("textSubtle") }}>
            {entry.note}
          </Text>
        </View>
      ) : null}

      <CommentsPreview comments={entry.comments} get={get} />

      <View className="flex-row flex-wrap gap-2">
        {entry.emotions.map((emotion) => {
          const categoryColors = getCategoryColors(emotion.category);

          return (
            <View
              key={emotion.name}
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: categoryColors.bg }}
            >
              <Text className="text-xs font-semibold" style={{ color: categoryColors.text }}>
                {emotion.name}
              </Text>
            </View>
          );
        })}
        {entry.contextTags.map((tag) => {
          const categoryColors = getCategoryColors("neutral");

          return (
            <View
              key={tag}
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: categoryColors.bg }}
            >
              <Text className="text-xs font-semibold" style={{ color: categoryColors.text }}>
                #{tag}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const VARIANTS: Array<{
  label: string;
  description: string;
  Component: React.ComponentType<CardProps>;
}> = [
  {
    label: "1 - Accent Bar",
    description: "Current design: left color bar + pill header",
    Component: V1AccentBar,
  },
  {
    label: "2 - Big Score Hero",
    description: "Large number dominates the left",
    Component: V2BigScore,
  },
  {
    label: "3 - Compact Row",
    description: "Single-line density for busy feeds",
    Component: V3HorizontalChip,
  },
  {
    label: "4 - Top Banner",
    description: "Full-width color wash at the top",
    Component: V4TopBanner,
  },
  {
    label: "5 - Score Circle",
    description: "Circular badge anchored to the right",
    Component: V5ScoreCircle,
  },
  {
    label: "6 - Minimal Ghost",
    description: "Hairline border, generous whitespace",
    Component: V6MinimalGhost,
  },
  {
    label: "7 - Split-Half",
    description: "Colored left panel, content on the right",
    Component: V7SplitHalf,
  },
  {
    label: "8 - Bubble Cluster",
    description: "Rounded tags with the score inline",
    Component: V8BubbleCluster,
  },
];

export default function CardVariantsScreen() {
  const { isDark, get, getCategoryColors } = useThemeColors();
  const [activeSample, setActiveSample] = useState(0);
  const entry = SAMPLES[activeSample];

  return (
    <SafeAreaView
      className="flex-1 bg-paper-100 dark:bg-paper-900"
      edges={["top"]}
    >
      <SettingsPageHeader
        title="Card Variants"
        subtitle="Developer"
        icon="color-wand-outline"
        accentColor="dusk"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 rounded-2xl p-4" style={{ backgroundColor: get("surface") }}>
          <Text className="mb-1 text-base font-bold" style={{ color: get("text") }}>
            Mood Entry Card Preview
          </Text>
          <Text className="text-sm leading-5" style={{ color: get("textMuted") }}>
            Switch between sample entries to compare how each layout handles best,
            worst, and middle moods. Lower numbers are better in this app.
          </Text>
        </View>

        <View
          className="mb-6 flex-row gap-2 rounded-2xl p-3"
          style={{
            backgroundColor: get("surface"),
            borderWidth: isDark ? 1 : 0,
            borderColor: isDark ? "rgba(168,197,168,0.12)" : "transparent",
          }}
        >
          {SAMPLES.map((sample, index) => {
            const moodData = useMoodData(sample.mood, isDark);
            const isActive = activeSample === index;

            return (
              <Pressable
                key={`${sample.mood}-${sample.time}`}
                onPress={() => setActiveSample(index)}
                className="flex-1 items-center rounded-xl py-2"
                style={{ backgroundColor: isActive ? moodData.bgHex : "transparent" }}
              >
                <Text
                  className="text-lg font-black"
                  style={{ color: isActive ? moodData.textHex : get("textMuted") }}
                >
                  {sample.mood}
                </Text>
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: isActive ? moodData.textHex : get("textMuted") }}
                >
                  {moodScale.find((item) => item.value === sample.mood)?.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {VARIANTS.map(({ label, description, Component }) => (
          <View key={label} className="mb-8">
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
