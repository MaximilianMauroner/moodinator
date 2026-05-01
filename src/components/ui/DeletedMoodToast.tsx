import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MoodEntry } from "@db/types";

import { useThemeColors } from "@/constants/colors";
import { moodScale } from "@/constants/moodScale";
import { fontFamilies, typography } from "@/constants/typography";

interface DeletedMoodToastProps {
  entry: MoodEntry;
  onUndo: () => void;
}

export function DeletedMoodToast({ entry, onUndo }: DeletedMoodToastProps) {
  const { get, isDark } = useThemeColors();

  const mood = useMemo(
    () => moodScale.find((item) => item.value === entry.mood),
    [entry.mood]
  );

  const timestampLabel = useMemo(
    () =>
      new Date(entry.timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [entry.timestamp]
  );

  const moodLabel = mood?.label ?? "Mood";
  const moodChipBg =
    isDark ? mood?.bgHexDark ?? get("surfaceElevated") : mood?.bgHex ?? get("surfaceElevated");
  const moodChipText =
    isDark ? mood?.textHexDark ?? get("textMuted") : mood?.textHex ?? get("textMuted");
  const moodChipBorder = mood?.borderColor ?? get("border");

  return (
    <View style={styles.frame}>
      <View
        style={[
          styles.card,
          isDark ? styles.shadowDark : styles.shadowLight,
          {
            backgroundColor: get("surface"),
            borderColor: get("border"),
          },
        ]}
      >
        <View
          style={[
            styles.accent,
            { backgroundColor: isDark ? "#A86A5F" : "#E7B8AE" },
          ]}
        />
        <View style={styles.content}>
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: isDark ? "#472E2A" : "#FDE8E4",
                borderColor: isDark ? "#5F3E38" : "#FACFC7",
              },
            ]}
          >
            <Ionicons name="heart" size={16} color="#E06B55" />
          </View>

          <View style={styles.copy}>
            <Text
              numberOfLines={1}
              style={[
                typography.bodyMd,
                styles.title,
                { color: get("text"), fontFamily: fontFamilies.bodyMedium },
              ]}
            >
              Entry removed
            </Text>

            <View style={styles.metaRow}>
              <View
                style={[
                  styles.moodChip,
                  {
                    backgroundColor: moodChipBg,
                    borderColor: moodChipBorder,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    typography.bodySm,
                    styles.moodChipText,
                    { color: moodChipText, fontFamily: fontFamilies.bodyMedium },
                  ]}
                >
                  {moodLabel}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[
                  typography.bodySm,
                  styles.timestamp,
                  { color: get("textMuted") },
                ]}
              >
                {timestampLabel}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onUndo}
            style={({ pressed }) => [
              styles.undoButton,
              {
                backgroundColor: get("primaryBg"),
                borderColor: isDark ? "#4A6653" : "#D1DFD1",
              },
              pressed ? styles.undoButtonPressed : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Undo delete"
          >
            <Text
              style={[
                typography.bodySm,
                styles.undoLabel,
                {
                  color: isDark ? "#C8EEC8" : "#476D47",
                  fontFamily: fontFamilies.bodyMedium,
                },
              ]}
            >
              Undo
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    maxWidth: 364,
    paddingHorizontal: 12,
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 22,
  },
  accent: {
    height: 3,
    opacity: 0.9,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  moodChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  moodChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 12,
    lineHeight: 16,
  },
  undoButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  undoButtonPressed: {
    opacity: 0.82,
  },
  undoLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
  },
  shadowLight: {
    elevation: 4,
    shadowColor: "#9D8660",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  shadowDark: {
    elevation: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
});

export default DeletedMoodToast;
