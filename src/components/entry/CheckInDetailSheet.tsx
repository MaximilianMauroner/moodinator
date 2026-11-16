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
import { CheckInChip } from "./CheckInChip";
import {
  MAX_CHECK_IN_FEELINGS,
  type CheckInAction,
  type CheckInDraft,
  type CheckInSheet,
} from "./checkInDraft";
import type { MoodEntryFieldConfig } from "./moodEntryDraft";

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
          accessibilityLabel="Close details"
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
          <Text
            accessibilityRole="header"
            style={[
              typography.titleMd,
              { color: get("text"), marginBottom: 12 },
            ]}
          >
            {sheet === "feelings" ? "All feelings" : "Optional details"}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {sheet === "feelings" && fieldConfig.emotions && (
              <EmotionPicker
                options={emotionOptions}
                selected={draft.emotions}
                maxSelections={MAX_CHECK_IN_FEELINGS}
                onChange={(emotions) =>
                  dispatch({ type: "emotions", emotions })
                }
              />
            )}
            {sheet === "extras" && fieldConfig.energy && (
              <View className="gap-2 mb-4">
                <Text
                  accessibilityRole="header"
                  style={[typography.bodyMd, { color: get("text") }]}
                >
                  Energy (optional)
                </Text>
                <Text style={[typography.bodySm, { color: get("textMuted") }]}>
                  0 is drained. 10 is wired.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {Array.from({ length: 11 }, (_, energy) => (
                    <CheckInChip
                      key={energy}
                      label={`Energy ${energy}`}
                      selected={draft.energy === energy}
                      onPress={() => {
                        haptics.tick();
                        dispatch({
                          type: "energy",
                          energy: draft.energy === energy ? null : energy,
                        });
                      }}
                    />
                  ))}
                </View>
              </View>
            )}
            {sheet === "extras" && fieldConfig.notes && (
              <TextInput
                multiline
                accessibilityLabel="Note"
                placeholder="Anything else on your mind?"
                placeholderTextColor={get("textSubtle")}
                value={draft.note}
                onChangeText={(note) => dispatch({ type: "note", note })}
                style={[
                  typography.bodyMd,
                  {
                    minHeight: 100,
                    maxHeight: 180,
                    textAlignVertical: "top",
                    padding: 12,
                    borderRadius: 12,
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
            accessibilityLabel="Done with details"
            className="items-center justify-center rounded-2xl px-4 mt-2"
            style={{ minHeight: 48, backgroundColor: get("primary") }}
          >
            <Text style={[typography.bodyMd, { color: get("onPrimary") }]}>
              Done
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </PrivateModal>
  );
}
