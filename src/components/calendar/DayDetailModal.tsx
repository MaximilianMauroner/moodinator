import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useThemeColors, colors } from "@/constants/colors";
import { moodScale } from "@/constants/moodScale";
import { haptics } from "@/lib/haptics";
import type { MoodEntry } from "@db/types";

type DayDetailModalProps = {
  visible: boolean;
  date: Date;
  entries: MoodEntry[];
  onClose: () => void;
  onEditEntry?: (entry: MoodEntry) => void;
};

export function DayDetailModal({
  visible,
  date,
  entries,
  onClose,
  onEditEntry,
}: DayDetailModalProps) {
  const { isDark, get, getCategoryColors } = useThemeColors();

  const handleClose = () => {
    haptics.light();
    onClose();
  };

  const handleEditEntry = (entry: MoodEntry) => {
    haptics.selection();
    onEditEntry?.(entry);
  };

  const getMoodData = (mood: number) => {
    const info = moodScale[Math.min(mood, moodScale.length - 1)];
    return {
      label: info?.label ?? `Mood ${mood}`,
      textHex: isDark ? info?.textHexDark : info?.textHex,
      bgHex: isDark ? info?.bgHexDark : info?.bgHex,
    };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
        <View
          className="rounded-t-3xl max-h-[80%]"
          style={{ backgroundColor: get("background") }}
        >
          {/* Header */}
          <View
            className="px-5 pt-4 pb-4"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: isDark ? "rgba(61, 53, 42, 0.3)" : "rgba(229, 217, 191, 0.5)",
            }}
          >
            {/* Drag handle */}
            <View
              className="w-10 h-1 rounded-full self-center mb-4"
              style={{ backgroundColor: get("border") }}
            />

            <View className="flex-row items-center justify-between">
              <View>
                <Text
                  className="text-xl font-bold"
                  style={{ color: get("text") }}
                >
                  {format(date, "EEEE")}
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: get("textMuted") }}
                >
                  {format(date, "MMMM d, yyyy")}
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                className="p-2 rounded-xl"
                style={{
                  backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
                }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={get("text")} />
              </Pressable>
            </View>
          </View>

          {/* Entries list */}
          <ScrollView
            className="px-4 py-4"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {entries.length === 0 ? (
              <View className="items-center py-12">
                <View
                  className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
                  style={{ backgroundColor: get("surfaceAlt") }}
                >
                  <Text className="text-3xl">📭</Text>
                </View>
                <Text
                  className="text-base font-semibold mb-2"
                  style={{ color: get("text") }}
                >
                  No entries
                </Text>
                <Text
                  className="text-sm text-center"
                  style={{ color: get("textMuted") }}
                >
                  Long press on this day to add an entry
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {entries.map((entry) => {
                  const moodData = getMoodData(entry.mood);
                  return (
                    <Pressable
                      key={entry.id}
                      onPress={() => handleEditEntry(entry)}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        backgroundColor: get("surface"),
                        shadowColor: isDark ? "#000" : "#9D8660",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDark ? 0.25 : 0.08,
                        shadowRadius: 12,
                        elevation: 3,
                      }}
                    >
                      <View className="flex-row">
                        {/* Left accent bar */}
                        <View
                          style={{
                            width: 4,
                            backgroundColor: moodData.textHex,
                          }}
                        />

                        <View className="flex-1 p-4">
                          {/* Header row */}
                          <View className="flex-row items-center justify-between mb-2">
                            <View
                              className="flex-row items-center px-3 py-1.5 rounded-xl"
                              style={{ backgroundColor: moodData.bgHex }}
                            >
                              <Text
                                className="text-lg font-bold mr-1.5"
                                style={{ color: moodData.textHex }}
                              >
                                {entry.mood}
                              </Text>
                              <Text
                                className="text-sm font-semibold"
                                style={{ color: moodData.textHex }}
                              >
                                {moodData.label}
                              </Text>
                            </View>
                            <Text
                              className="text-xs"
                              style={{ color: get("textMuted") }}
                            >
                              {format(new Date(entry.timestamp), "h:mm a")}
                            </Text>
                          </View>

                          {/* Note */}
                          {entry.note && (
                            <Text
                              className="text-sm mb-2"
                              style={{ color: get("textSubtle") }}
                              numberOfLines={2}
                            >
                              {entry.note}
                            </Text>
                          )}

                          {/* Emotions & Context */}
                          {(entry.emotions.length > 0 || (entry.contextTags?.length ?? 0) > 0) && (
                            <View className="flex-row flex-wrap gap-1.5">
                              {entry.emotions.map((emotion) => {
                                const catColors = getCategoryColors(emotion.category);
                                return (
                                  <View
                                    key={emotion.name}
                                    className="px-2 py-0.5 rounded-md"
                                    style={{ backgroundColor: catColors.bg }}
                                  >
                                    <Text
                                      className="text-xs font-medium"
                                      style={{ color: catColors.text }}
                                    >
                                      {emotion.name}
                                    </Text>
                                  </View>
                                );
                              })}
                              {entry.contextTags?.map((ctx) => {
                                const ctxColors = getCategoryColors("neutral");
                                return (
                                  <View
                                    key={ctx}
                                    className="px-2 py-0.5 rounded-md"
                                    style={{ backgroundColor: ctxColors.bg }}
                                  >
                                    <Text
                                      className="text-xs font-medium"
                                      style={{ color: ctxColors.text }}
                                    >
                                      #{ctx}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>

                        {/* Chevron indicator */}
                        <View className="justify-center pr-3">
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={get("textMuted")}
                          />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
