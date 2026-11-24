import React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrivateModal } from "@/components/ui/PrivateModal";
import { colors, useThemeColors } from "@/constants/colors";
import { typography } from "@/constants/typography";
import { haptics } from "@/lib/haptics";
import type { Emotion } from "@db/types";
import { EmotionPicker } from "./EmotionPicker";
import {
  MAX_CHECK_IN_FEELINGS,
  type CheckInAction,
  type CheckInDraft,
  type CheckInSheet,
} from "./checkInDraft";
import {
  getNotesPlaceholder,
  type MoodEntryFieldConfig,
} from "./moodEntryDraft";

type Props = {
  draft: CheckInDraft;
  sheet: CheckInSheet;
  fieldConfig: MoodEntryFieldConfig;
  emotionOptions: Emotion[];
  dispatch: React.Dispatch<CheckInAction>;
};

export function CheckInDetailSheet({
  draft,
  sheet,
  fieldConfig,
  emotionOptions,
  dispatch,
}: Props) {
  const { get } = useThemeColors();
  const insets = useSafeAreaInsets();
  const isFeelings = sheet === "feelings";
  const isNote = sheet === "note";
  const hasNote = draft.note.trim().length > 0;
  const close = () => {
    Keyboard.dismiss();
    dispatch({ type: "sheet", sheet: null });
  };
  return (
    <PrivateModal
      visible={sheet !== null}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
        style={{ backgroundColor: colors.overlay, paddingTop: insets.top + 16 }}
      >
        <Pressable
          accessibilityLabel={isFeelings ? "Close feelings" : "Close note"}
          accessibilityRole="button"
          onPress={close}
          style={{ flex: 1, minHeight: 44 }}
        />
        <View
          style={{
            maxHeight: "88%",
            flexShrink: 1,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: Math.max(16, insets.bottom),
            backgroundColor: get("surface"),
          }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text
              accessibilityRole="header"
              style={[typography.titleMd, { color: get("text") }]}
            >
              {isFeelings ? "All feelings" : "Note"}
            </Text>
            {isNote && hasNote && (
              <Pressable
                onPress={() => {
                  haptics.tick();
                  dispatch({ type: "note", note: "" });
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear note"
                className="justify-center px-3 rounded-xl"
                style={{
                  minHeight: 44,
                  backgroundColor: get("surfaceAlt"),
                  borderWidth: 1,
                  borderColor: get("border"),
                }}
              >
                <Text
                  style={[
                    typography.bodySm,
                    { color: get("textMuted"), fontWeight: "500" },
                  ]}
                >
                  Clear note
                </Text>
              </Pressable>
            )}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {isFeelings && fieldConfig.emotions && (
              <EmotionPicker
                options={emotionOptions}
                selected={draft.emotions}
                maxSelections={MAX_CHECK_IN_FEELINGS}
                onChange={(emotions) =>
                  dispatch({ type: "emotions", emotions })
                }
              />
            )}
            {isNote && fieldConfig.notes && (
              <TextInput
                multiline
                autoFocus
                testID="check-in-note-input"
                accessibilityLabel="Note"
                placeholder={getNotesPlaceholder(draft.mood)}
                placeholderTextColor={get("textSubtle")}
                value={draft.note}
                onChangeText={(note) => dispatch({ type: "note", note })}
                cursorColor={get("primary")}
                style={[
                  typography.bodyMd,
                  {
                    minHeight: 120,
                    maxHeight: 200,
                    textAlignVertical: "top",
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: get("border"),
                    color: get("text"),
                    backgroundColor: get("surfaceAlt"),
                  },
                ]}
              />
            )}
          </ScrollView>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={isFeelings ? "Done with feelings" : "Done with note"}
            className="items-center justify-center rounded-2xl px-4 mt-2"
            style={{ minHeight: 48, backgroundColor: get("primary") }}
          >
            <Text
              style={[
                typography.bodyMd,
                { color: get("onPrimary"), fontWeight: "600" },
              ]}
            >
              Done
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </PrivateModal>
  );
}
