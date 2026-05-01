import React from "react";
import { ScrollView, Pressable, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/constants/colors";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { ToggleRow } from "@/features/settings/components/ToggleRow";
import type { HistoryCardStyle } from "@/lib/entrySettings";

function CardStyleOption({
  title,
  description,
  value,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  value: HistoryCardStyle;
  selected: boolean;
  onPress: (value: HistoryCardStyle) => void;
}) {
  const { isDark, get } = useThemeColors();

  return (
    <Pressable
      onPress={() => onPress(value)}
      className="mb-3 rounded-2xl p-4"
      style={{
        backgroundColor: selected ? get("surfaceAlt") : get("surface"),
        borderWidth: 1,
        borderColor: selected ? get("primary") : get("borderSubtle"),
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title} card style`}
      accessibilityHint={`Tap to use the ${title.toLowerCase()} mood history card style`}
    >
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-base font-bold" style={{ color: get("text") }}>
            {title}
          </Text>
          <Text className="mt-1 text-sm leading-5" style={{ color: get("textMuted") }}>
            {description}
          </Text>
        </View>
        <View
          className="h-6 w-6 items-center justify-center rounded-full"
          style={{
            backgroundColor: selected ? get("primaryBg") : "transparent",
            borderWidth: 1,
            borderColor: selected ? get("primary") : get("border"),
          }}
        >
          {selected ? (
            <Ionicons
              name="checkmark"
              size={14}
              color={isDark ? "#A8C5A8" : "#5B8A5B"}
            />
          ) : null}
        </View>
      </View>

      {value === "minimal" ? (
        <View
          className="rounded-2xl p-3"
          style={{ borderWidth: 1, borderColor: get("borderSubtle") }}
        >
          <View className="mb-2 flex-row items-baseline justify-between">
            <View className="flex-row items-baseline gap-2">
              <Text className="text-2xl font-black" style={{ color: "#D4A574" }}>
                6
              </Text>
              <Text
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "#B88958" }}
              >
                Low
              </Text>
            </View>
            <Text className="text-xs" style={{ color: get("textMuted") }}>
              9:15 PM
            </Text>
          </View>
          <View
            className="mb-3 h-px"
            style={{ backgroundColor: get("borderSubtle") }}
          />
          <Text className="mb-3 text-xs" style={{ color: get("textMuted") }}>
            Thu, Apr 30 · Energy 5/10
          </Text>
          <View
            className="mb-3 rounded-xl p-3"
            style={{
              backgroundColor: get("surfaceAlt"),
              borderWidth: 1,
              borderColor: get("borderSubtle"),
            }}
          >
            <Text
              className="mb-2 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: get("textMuted") }}
            >
              Comments
            </Text>
            <Text className="text-sm leading-5" style={{ color: get("textSubtle") }}>
              The morning felt heavy, but I was more steady by lunch.
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: "#4A4462" }}>
              <Text className="text-xs font-medium" style={{ color: "#C4BBCF" }}>
                Tired
              </Text>
            </View>
            <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: "#4A4462" }}>
              <Text className="text-xs font-medium" style={{ color: "#C4BBCF" }}>
                #Work
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View
          className="rounded-2xl p-3"
          style={{ backgroundColor: get("surfaceAlt"), borderWidth: 1, borderColor: get("borderSubtle") }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: "#B88958" }}
            >
              <Text className="text-sm font-bold text-white">6</Text>
            </View>
            <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
              <Text className="text-sm font-semibold" style={{ color: get("text") }}>
                Low
              </Text>
              <View className="rounded-lg px-2 py-1" style={{ backgroundColor: "#526757" }}>
                <Text className="text-[10px] font-medium" style={{ color: "#D4C49C" }}>
                  Tired
                </Text>
              </View>
              <View className="rounded-lg px-2 py-1" style={{ backgroundColor: "#526757" }}>
                <Text className="text-[10px] font-medium" style={{ color: "#D4C49C" }}>
                  #Work
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-xs" style={{ color: get("textMuted") }}>
                9:15 PM
              </Text>
              <Text className="text-[10px]" style={{ color: get("textMuted") }}>
                Energy 5/10
              </Text>
            </View>
          </View>
          <View className="mt-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: get("surface") }}>
            <Text
              className="mb-2 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: get("textMuted") }}
            >
              Comments
            </Text>
            <Text className="text-sm leading-5" style={{ color: get("textSubtle") }}>
              The morning felt heavy, but I was more steady by lunch.
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function DisplaySettingsScreen() {
  const { get } = useThemeColors();
  const showDetailedLabels = useSettingsStore((state) => state.showDetailedLabels);
  const setShowDetailedLabels = useSettingsStore((state) => state.setShowDetailedLabels);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const historyCardStyle = useSettingsStore((state) => state.historyCardStyle);
  const setHistoryCardStyle = useSettingsStore((state) => state.setHistoryCardStyle);

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Display"
        subtitle="Preferences"
        icon="eye-outline"
        accentColor="sage"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Mood History">
          <View className="p-4">
            <Text className="mb-1 text-base font-semibold" style={{ color: get("text") }}>
              Card Style
            </Text>
            <Text className="mb-4 text-sm leading-5" style={{ color: get("textMuted") }}>
              Choose how entries appear in your history list.
            </Text>

            <View accessibilityRole="radiogroup">
              <CardStyleOption
                title="Minimal"
                description="Whitespace-first card with comments called out separately."
                value="minimal"
                selected={historyCardStyle === "minimal"}
                onPress={setHistoryCardStyle}
              />
              <CardStyleOption
                title="Compact"
                description="Denser row layout for seeing more entries at once."
                value="compact"
                selected={historyCardStyle === "compact"}
                onPress={setHistoryCardStyle}
              />
            </View>
          </View>
        </SettingsSection>

        <SettingsSection title="Charts">
          <ToggleRow
            title="Detailed Labels"
            description="Show mood descriptions on chart axes and tooltips"
            value={showDetailedLabels}
            onChange={setShowDetailedLabels}
            icon="text-outline"
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Feedback">
          <ToggleRow
            title="Haptic Feedback"
            description="Vibration feedback when interacting with buttons and controls"
            value={hapticsEnabled}
            onChange={setHapticsEnabled}
            icon="hand-left-outline"
            isLast
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
