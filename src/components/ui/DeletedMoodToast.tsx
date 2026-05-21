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

interface MoodChangeToastProps {
  entry: MoodEntry;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  action?: {
    label: string;
    accessibilityLabel: string;
    onPress: () => void;
  };
}

function MoodChangeToast({
  entry,
  title,
  icon,
  iconColor,
  action,
}: MoodChangeToastProps) {
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
  const moodChipBg = isDark
    ? mood?.bgHexDark ?? get("surfaceElevated")
    : mood?.bgHex ?? get("surfaceElevated");
  const moodChipText = isDark
    ? mood?.textHexDark ?? get("textMuted")
    : mood?.textHex ?? get("textMuted");
  const moodChipBorder = isDark ? get("borderSubtle") : mood?.borderColor ?? get("border");

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
        <View style={styles.content}>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Ionicons name={icon} size={15} color={iconColor} />
              <Text
                numberOfLines={1}
                style={[
                  typography.bodyMd,
                  styles.title,
                  { color: get("text"), fontFamily: fontFamilies.bodyMedium },
                ]}
              >
                {title}
              </Text>
            </View>

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

          {action ? (
            <Pressable
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.undoButton,
                {
                  backgroundColor: get("primaryBg"),
                  borderColor: isDark ? "#4A6653" : "#D1DFD1",
                },
                pressed ? styles.undoButtonPressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
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
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function DeletedMoodToast({ entry, onUndo }: DeletedMoodToastProps) {
  const { isDark } = useThemeColors();

  return (
    <MoodChangeToast
      entry={entry}
      title="Entry removed"
      icon="heart"
      iconColor={isDark ? "#F5A899" : "#E06B55"}
      action={{
        label: "Undo",
        accessibilityLabel: "Undo delete",
        onPress: onUndo,
      }}
    />
  );
}

export function RestoredMoodToast({ entry }: { entry: MoodEntry }) {
  const { isDark } = useThemeColors();

  return (
    <MoodChangeToast
      entry={entry}
      title="Entry restored"
      icon="leaf"
      iconColor={isDark ? "#A8C5A8" : "#5B8A5B"}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    paddingHorizontal: 16,
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 18,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  moodChip: {
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 1,
    maxWidth: 112,
    flexShrink: 1,
  },
  moodChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  undoButton: {
    minWidth: 54,
    minHeight: 44,
    paddingHorizontal: 10,
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
    elevation: 3,
    shadowColor: "#9D8660",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  shadowDark: {
    elevation: 3,
    shadowColor: "#1E2D26",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
});

export default DeletedMoodToast;
