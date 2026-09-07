import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MoodEntry } from "@db/types";

import { useThemeColors } from "@/constants/colors";
import { getMoodRatingDisplay } from "@/constants/moodScaleInterpretation";
import { fontFamilies, typography } from "@/constants/typography";

interface DeletedMoodToastProps {
  entry: MoodEntry;
  onUndo: () => void;
}

interface MoodChangeToastProps {
  entry: MoodEntry;
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
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
    () => getMoodRatingDisplay(entry.mood, isDark, entry.moodScale),
    [entry.mood, entry.moodScale, isDark]
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

  return (
    <View style={styles.frame}>
      <View
        style={[
          styles.card,
          isDark ? styles.shadowDark : styles.shadowLight,
          {
            backgroundColor: get("surfaceElevated"),
            borderColor: get("border"),
          },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              {icon && <Ionicons name={icon} size={16} color={iconColor} />}
              <Text
                style={[
                  typography.bodyMd,
                  styles.title,
                  { color: get("text"), fontFamily: fontFamilies.bodyMedium },
                ]}
              >
                {title}
              </Text>
            </View>

            {action && (
              <Text
                style={[
                  typography.bodySm,
                  styles.identity,
                  { color: get("textMuted") },
                ]}
              >
                {mood.label} · {timestampLabel}
              </Text>
            )}
          </View>

          {action ? (
            <Pressable
              onPress={action.onPress}
              className="active:opacity-80"
              style={[
                styles.undoButton,
                {
                  backgroundColor: get("primaryBgHover"),
                  borderColor: isDark ? "#4A6653" : "#D1DFD1",
                },
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
  return (
    <MoodChangeToast
      entry={entry}
      title="Entry removed"
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
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 12,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
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
    flexShrink: 1,
  },
  identity: {
    fontSize: 12,
    lineHeight: 18,
  },
  undoButton: {
    minWidth: 54,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
