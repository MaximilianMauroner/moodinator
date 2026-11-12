import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrivateModal } from "@/components/ui/PrivateModal";
import { ContextTagChip } from "@/components/MoodEntryModalParts";
import { colors, useThemeColors } from "@/constants/colors";
import { typography } from "@/constants/typography";
import { EMOTION_ENERGY_BAND_ORDER } from "@/lib/entrySettings";
import type { Emotion } from "@db/types";
import { EmotionPicker } from "./EmotionPicker";
import {
  energyBand,
  MAX_PAD_EMOTIONS,
  type MoodPadAction,
  type MoodPadDraft,
} from "./moodPadDraft";
import type { MoodEntryFieldConfig } from "./moodEntryDraft";
type Props = {
  draft: MoodPadDraft;
  label: string;
  visible: boolean;
  fieldConfig: MoodEntryFieldConfig;
  emotionOptions: Emotion[];
  contextOptions: string[];
  dispatch: React.Dispatch<MoodPadAction>;
};
export function MoodPadMoreSheet({
  draft,
  label,
  visible,
  fieldConfig,
  emotionOptions,
  contextOptions,
  dispatch,
}: Props) {
  const { isDark, get } = useThemeColors();
  const insets = useSafeAreaInsets();
  const theme = isDark ? "dark" : "light";
  const firstBand = energyBand(draft.energy);
  const close = () =>
    dispatch({
      type: "view",
      view: "pad",
    });
  return (
    <PrivateModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View
        className="flex-1 justify-end"
        style={{
          backgroundColor: colors.overlay,
          paddingTop: insets.top + 16,
        }}
      >
        <Pressable
          accessibilityLabel="Close details"
          accessibilityRole="button"
          onPress={close}
          style={{
            flex: 1,
            minHeight: 44,
          }}
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
            maxFontSizeMultiplier={1.3}
            style={[
              typography.titleMd,
              {
                color: get("text"),
              },
            ]}
          >
            Add detail
          </Text>
          <Text
            maxFontSizeMultiplier={1.3}
            style={[
              typography.bodySm,
              {
                color: get("textMuted"),
                marginBottom: 16,
              },
            ]}
          >
            {label}
          </Text>
          <ScrollView
            style={{
              flexShrink: 1,
            }}
            contentContainerStyle={{
              paddingBottom: 16,
            }}
          >
            {fieldConfig.emotions && (
              <>
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[
                    typography.bodySm,
                    {
                      color: get("textMuted"),
                      marginBottom: 8,
                    },
                  ]}
                >
                  Nearest to your touch first
                </Text>
                <EmotionPicker
                  options={emotionOptions}
                  selected={draft.emotions}
                  maxSelections={MAX_PAD_EMOTIONS}
                  bandOrder={[
                    firstBand,
                    ...EMOTION_ENERGY_BAND_ORDER.filter(
                      (band) => band !== firstBand,
                    ),
                  ]}
                  onChange={(emotions) =>
                    dispatch({
                      type: "emotions",
                      emotions,
                    })
                  }
                />
              </>
            )}
            {fieldConfig.context && (
              <>
                <Text
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.3}
                  style={[
                    typography.titleMd,
                    {
                      color: get("text"),
                      marginVertical: 12,
                    },
                  ]}
                >
                  Context
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {contextOptions.map((context) => {
                    const selected = draft.contextTags.includes(context);
                    return (
                      <ContextTagChip
                        key={context}
                        label={context}
                        isSelected={selected}
                        bgColor={
                          selected
                            ? colors.dusk.bgSelected[theme]
                            : colors.dusk.bg[theme]
                        }
                        borderColor={colors.dusk.border[theme]}
                        textColor={
                          selected
                            ? colors.neutral.textSelected[theme]
                            : colors.dusk.text[theme]
                        }
                        onPress={() =>
                          dispatch({
                            type: "context",
                            context,
                          })
                        }
                      />
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            className="items-center justify-center rounded-2xl px-4 mt-2"
            style={{
              minHeight: 48,
              backgroundColor: get("primary"),
            }}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                typography.bodyMd,
                {
                  color: get("onPrimary"),
                },
              ]}
            >
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    </PrivateModal>
  );
}
