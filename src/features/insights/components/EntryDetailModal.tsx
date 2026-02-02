import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { format } from "date-fns";
import type { MoodEntry } from "@db/types";

interface EntryDetailModalProps {
  entry: MoodEntry | null;
  onClose: () => void;
  getMoodLabel: (mood: number) => string;
  getMoodColor: (mood: number) => string;
}

export function EntryDetailModal({
  entry,
  onClose,
  getMoodLabel,
  getMoodColor,
}: EntryDetailModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (!entry) return null;

  const hasEmotions = entry.emotions && entry.emotions.length > 0;
  const hasContextTags = entry.contextTags && entry.contextTags.length > 0;
  const hasNote = entry.note && entry.note.trim().length > 0;
  const hasEnergy = entry.energy !== null && entry.energy !== undefined;

  return (
    <Modal
      visible={!!entry}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1"
        style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: isDark ? "#2A2520" : "#E5D9BF" }}
        >
          <View className="w-10" />
          <Text
            className="text-lg font-semibold"
            style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
          >
            Entry Details
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{ backgroundColor: isDark ? "#2A2520" : "#F0EBE0" }}
          >
            <Ionicons
              name="close"
              size={20}
              color={isDark ? "#BDA77D" : "#9D8660"}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 20,
            paddingBottom: Platform.OS === "ios" ? 40 : 20,
          }}
        >
          {/* Mood Display */}
          <View
            className="rounded-3xl p-6 mb-5"
            style={{
              backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
              shadowColor: isDark ? "#000" : "#9D8660",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.25 : 0.08,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center mr-4"
                style={{ backgroundColor: getMoodColor(entry.mood) + "20" }}
              >
                <Text
                  className="text-3xl font-bold"
                  style={{ color: getMoodColor(entry.mood) }}
                >
                  {entry.mood}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className="text-xl font-semibold"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  {getMoodLabel(entry.mood)}
                </Text>
                <Text
                  className="text-sm mt-1"
                  style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
                >
                  {format(new Date(entry.timestamp), "EEEE, MMMM d, yyyy")}
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
                >
                  {format(new Date(entry.timestamp), "h:mm a")}
                </Text>
              </View>
            </View>
          </View>

          {/* Energy Level */}
          {hasEnergy && (
            <View
              className="rounded-3xl p-5 mb-5"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.08,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center mb-3">
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
                >
                  <Ionicons
                    name="flash"
                    size={16}
                    color={isDark ? "#A8C5A8" : "#5B8A5B"}
                  />
                </View>
                <Text
                  className="text-base font-medium"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  Energy Level
                </Text>
              </View>
              <View className="flex-row items-center">
                <View
                  className="flex-1 h-3 rounded-full mr-3"
                  style={{ backgroundColor: isDark ? "#2A2520" : "#E5D9BF" }}
                >
                  <View
                    className="h-3 rounded-full"
                    style={{
                      width: `${(entry.energy! / 10) * 100}%`,
                      backgroundColor: isDark ? "#A8C5A8" : "#5B8A5B",
                    }}
                  />
                </View>
                <Text
                  className="text-lg font-semibold w-12 text-right"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  {entry.energy}/10
                </Text>
              </View>
            </View>
          )}

          {/* Emotions */}
          {hasEmotions && (
            <View
              className="rounded-3xl p-5 mb-5"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.08,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center mb-3">
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? "#3D2D2D" : "#F5E8E8" }}
                >
                  <Ionicons
                    name="heart"
                    size={16}
                    color={isDark ? "#C5A8A8" : "#8A5B5B"}
                  />
                </View>
                <Text
                  className="text-base font-medium"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  Emotions
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {entry.emotions.map((emotion, index) => {
                  const categoryColors = {
                    positive: { bg: isDark ? "#2D3D2D" : "#E8EFE8", text: isDark ? "#A8C5A8" : "#5B8A5B" },
                    negative: { bg: isDark ? "#3D2D2D" : "#F5E8E8", text: isDark ? "#C5A8A8" : "#8A5B5B" },
                    neutral: { bg: isDark ? "#2D2D3D" : "#E8E8F5", text: isDark ? "#A8A8C5" : "#5B5B8A" },
                  };
                  const colors = categoryColors[emotion.category] || categoryColors.neutral;
                  return (
                    <View
                      key={index}
                      className="px-3 py-2 rounded-xl"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{ color: colors.text }}
                      >
                        {emotion.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Context Tags */}
          {hasContextTags && (
            <View
              className="rounded-3xl p-5 mb-5"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.08,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center mb-3">
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? "#2D2D3D" : "#E8E8F5" }}
                >
                  <Ionicons
                    name="pricetag"
                    size={16}
                    color={isDark ? "#A8A8C5" : "#5B5B8A"}
                  />
                </View>
                <Text
                  className="text-base font-medium"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  Context
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {entry.contextTags.map((tag, index) => (
                  <View
                    key={index}
                    className="px-3 py-2 rounded-xl"
                    style={{ backgroundColor: isDark ? "#2A2520" : "#F0EBE0" }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Note */}
          {hasNote && (
            <View
              className="rounded-3xl p-5"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.08,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center mb-3">
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? "#2A2520" : "#F0EBE0" }}
                >
                  <Ionicons
                    name="document-text"
                    size={16}
                    color={isDark ? "#BDA77D" : "#9D8660"}
                  />
                </View>
                <Text
                  className="text-base font-medium"
                  style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                >
                  Note
                </Text>
              </View>
              <Text
                className="text-sm leading-6"
                style={{ color: isDark ? "#D4CFC5" : "#5A5248" }}
              >
                {entry.note}
              </Text>
            </View>
          )}

          {/* Empty state if no additional details */}
          {!hasEmotions && !hasContextTags && !hasNote && !hasEnergy && (
            <View
              className="rounded-3xl p-8 items-center"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.08,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <Text
                className="text-sm text-center"
                style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
              >
                No additional details for this entry.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
