import React, { useReducer, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Emotion } from "@db/types";
import { useThemeColors } from "@/constants/colors";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import {
  getMoodWeatherColor,
  getMoodWeatherIcon,
} from "@/constants/moodWeather";
import { typography } from "@/constants/typography";
import {
  buildMoodEntrySubmitValues,
  type MoodEntryFieldConfig,
  type MoodEntryFormValues,
} from "./moodEntryDraft";
import {
  EMPTY_MOOD_PAD,
  MAX_PAD_EMOTIONS,
  moodPadReducer,
  suggestEmotions,
} from "./moodPadDraft";
import { MoodPad } from "./MoodPad";
import { MoodPadMoreSheet } from "./MoodPadMoreSheet";
type Props = {
  fieldConfig: MoodEntryFieldConfig;
  emotionOptions: Emotion[];
  contextOptions: string[];
  latestContext?: string;
  onKeep: (values: MoodEntryFormValues, onKept: () => void) => Promise<void>;
};
type ChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
};
function PadChip({
  label,
  selected = false,
  disabled = false,
  onPress,
}: ChipProps) {
  const { get } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{
        selected,
        disabled,
      }}
      accessibilityLabel={label}
      className="justify-center rounded-xl px-3"
      style={{
        minHeight: 44,
        borderWidth: 1,
        borderColor: get("border"),
        backgroundColor: get(selected ? "primaryBg" : "surfaceAlt"),
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={[
          typography.bodySm,
          {
            color: get("text"),
            fontWeight: selected ? "700" : "400",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function MoodPadDock({
  fieldConfig,
  emotionOptions,
  contextOptions,
  latestContext,
  onKeep,
}: Props) {
  const { isDark, get } = useThemeColors();
  const [state, dispatch] = useReducer(moodPadReducer, EMPTY_MOOD_PAD);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { draft } = state;
  const view = state.view === "note" && !fieldConfig.notes ? "pad" : state.view;
  const label = draft
    ? `${getMoodRatingLabel(draft.mood)} ${draft.mood}, energy ${draft.energy}`
    : "How is it now?";
  const suggested = draft
    ? suggestEmotions(draft.mood, draft.energy, emotionOptions)
    : [];
  const emotions = draft
    ? [
        ...suggested,
        ...draft.emotions.filter(
          (emotion) => !suggested.some((other) => other.name === emotion.name),
        ),
      ]
    : [];
  const firstContext = latestContext || contextOptions[0];
  const contexts = draft
    ? [
        ...(firstContext ? [firstContext] : []),
        ...draft.contextTags.filter((context) => context !== firstContext),
      ]
    : [];
  const keep = async () => {
    if (!draft || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      await onKeep(
        buildMoodEntrySubmitValues(
          {
            ...draft,
            basedOnEntryId: null,
          },
          fieldConfig,
        ),
        () =>
          dispatch({
            type: "clear",
          }),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{
          flexGrow: 0,
          flexShrink: 1,
        }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 4,
        }}
      >
        <View
          pointerEvents={saving ? "none" : "auto"}
          accessibilityElementsHidden={view === "more"}
          importantForAccessibility={
            view === "more" ? "no-hide-descendants" : "auto"
          }
        >
          {view === "note" && draft ? (
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                dispatch({
                  type: "view",
                  view: "pad",
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label}. Change mood and energy`}
              className="flex-row items-center justify-between gap-3"
              style={{
                minHeight: 48,
              }}
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  typography.titleMd,
                  {
                    color: get("text"),
                    flex: 1,
                  },
                ]}
              >
                {label}
              </Text>
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  typography.bodySm,
                  {
                    color: get("primary"),
                  },
                ]}
              >
                Change
              </Text>
            </Pressable>
          ) : (
            <>
              <View
                className="flex-row items-center gap-2 mb-2"
                style={{ minHeight: 64 }}
              >
                {draft && (
                  <Ionicons
                    name={getMoodWeatherIcon(draft.mood)}
                    size={24}
                    color={getMoodWeatherColor(draft.mood, isDark)}
                    accessible={false}
                  />
                )}
                <Text
                  accessibilityRole="header"
                  accessibilityLiveRegion="polite"
                  maxFontSizeMultiplier={1.3}
                  style={[
                    typography.titleMd,
                    {
                      color: get("text"),
                      fontSize: 18,
                      lineHeight: 24,
                      flex: 1,
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
              <MoodPad
                draft={draft}
                onChange={(mood, energy) =>
                  dispatch({
                    type: "point",
                    mood,
                    energy,
                  })
                }
              />
            </>
          )}
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{
              height: 112,
              marginVertical: 4,
            }}
            contentContainerStyle={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              paddingVertical: 4,
            }}
          >
            {draft && (
              <>
                {fieldConfig.emotions &&
                  emotions.map((emotion) => {
                    const selected = draft.emotions.some(
                      (other) => other.name === emotion.name,
                    );
                    return (
                      <PadChip
                        key={`emotion-${emotion.name}`}
                        label={emotion.name}
                        selected={selected}
                        disabled={
                          !selected && draft.emotions.length >= MAX_PAD_EMOTIONS
                        }
                        onPress={() =>
                          dispatch({
                            type: "emotions",
                            emotions: selected
                              ? draft.emotions.filter(
                                  (other) => other.name !== emotion.name,
                                )
                              : [...draft.emotions, emotion],
                          })
                        }
                      />
                    );
                  })}
                {fieldConfig.context &&
                  contexts.map((context) => (
                    <PadChip
                      key={`context-${context}`}
                      label={`#${context}`}
                      selected={draft.contextTags.includes(context)}
                      onPress={() =>
                        dispatch({
                          type: "context",
                          context,
                        })
                      }
                    />
                  ))}
                {fieldConfig.notes && (
                  <PadChip
                    label={
                      draft.note.trim()
                        ? `Note: ${draft.note.trim().slice(0, 16)}`
                        : "Note"
                    }
                    selected={!!draft.note.trim()}
                    onPress={() =>
                      dispatch({
                        type: "view",
                        view: "note",
                      })
                    }
                  />
                )}
                <PadChip
                  label="More"
                  onPress={() => {
                    Keyboard.dismiss();
                    dispatch({
                      type: "view",
                      view: "more",
                    });
                  }}
                />
              </>
            )}
          </ScrollView>
          {view === "note" && draft && (
            <TextInput
              autoFocus
              multiline
              testID="mood-pad-note"
              accessibilityLabel="Note"
              placeholder="Add a note"
              placeholderTextColor={get("textSubtle")}
              maxFontSizeMultiplier={1.3}
              value={draft.note}
              onChangeText={(note) =>
                dispatch({
                  type: "note",
                  note,
                })
              }
              style={[
                typography.bodyMd,
                {
                  minHeight: 100,
                  maxHeight: 160,
                  textAlignVertical: "top",
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: get("border"),
                  color: get("text"),
                  backgroundColor: get("surfaceAlt"),
                  marginBottom: 12,
                },
              ]}
            />
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            testID="mood-pad-keep"
            onPress={() => {
              void keep();
            }}
            disabled={!draft || saving}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !draft || saving,
              busy: saving,
            }}
            className="flex-1 items-center justify-center rounded-2xl px-3 py-3"
            style={{
              minHeight: 48,
              backgroundColor: get("primary"),
              opacity: !draft || saving ? 0.45 : 1,
            }}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={[
                typography.bodyMd,
                {
                  color: get("onPrimary"),
                  textAlign: "center",
                },
              ]}
            >
              {draft ? `Keep ${label}` : "Touch the pad first"}
            </Text>
          </Pressable>
          {draft && (
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                dispatch({
                  type: "clear",
                });
              }}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{
                disabled: saving,
              }}
              className="px-3 justify-center"
              style={{
                minHeight: 48,
              }}
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={[
                  typography.bodySm,
                  {
                    color: get("textMuted"),
                  },
                ]}
              >
                Clear
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      {draft && (
        <MoodPadMoreSheet
          draft={draft}
          label={label}
          visible={view === "more"}
          fieldConfig={fieldConfig}
          emotionOptions={emotionOptions}
          contextOptions={contextOptions}
          dispatch={dispatch}
        />
      )}
    </>
  );
}
