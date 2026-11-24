import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { Emotion } from "@db/types";
import { getThemedColor, useThemeColors } from "@/constants/colors";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import { typography } from "@/constants/typography";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  buildMoodEntrySubmitValues,
  type MoodEntryFieldConfig,
  type MoodEntryFormValues,
} from "./moodEntryDraft";
import {
  checkInReducer,
  EMPTY_CHECK_IN,
  MAX_CHECK_IN_FEELINGS,
  visibleCheckInFeelings,
} from "./checkInDraft";
import { CheckInChip } from "./CheckInChip";
import { CheckInDetailSheet } from "./CheckInDetailSheet";
import { EnergySlider } from "./EnergySlider";
import { WeatherMoodGrid } from "./WeatherMoodGrid";

type Props = {
  fieldConfig: MoodEntryFieldConfig;
  emotionOptions: Emotion[];
  contextOptions: string[];
  onKeep: (values: MoodEntryFormValues, onKept: () => void) => Promise<void>;
};

function getDetailsStageTitle(fieldConfig: MoodEntryFieldConfig): string {
  if (fieldConfig.energy && fieldConfig.context) return "Energy & context";
  if (fieldConfig.energy) return "Energy";
  if (fieldConfig.context) return "Add context";
  if (fieldConfig.notes) return "Add a note";
  return "Your check-in";
}

function getNextStepLabel(fieldConfig: MoodEntryFieldConfig): string {
  if (fieldConfig.energy && fieldConfig.context) return "Next · Energy & context";
  if (fieldConfig.energy) return "Next · Energy";
  if (fieldConfig.context) return "Next · Context";
  if (fieldConfig.notes) return "Next · Note";
  return "Next · Details";
}

export function CheckInDock({
  fieldConfig,
  emotionOptions,
  contextOptions,
  onKeep,
}: Props) {
  const { isDark, get } = useThemeColors();
  const [state, dispatch] = useReducer(checkInReducer, EMPTY_CHECK_IN);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { draft } = state;
  const stage =
    state.stage === "feelings" && !fieldConfig.emotions
      ? "context"
      : state.stage;
  const activeSheet =
    (state.sheet === "feelings" && fieldConfig.emotions) ||
    (state.sheet === "note" && fieldConfig.notes)
      ? state.sheet
      : null;
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const stageStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 160 });
  }, [opacity, reducedMotion, stage]);
  const back = useCallback(() => {
    if (savingRef.current) return true;
    if (activeSheet) {
      Keyboard.dismiss();
      dispatch({ type: "sheet", sheet: null });
      return true;
    }
    if (stage === "mood") return false;
    dispatch({
      type: "stage",
      stage: stage === "context" && fieldConfig.emotions ? "feelings" : "mood",
    });
    return true;
  }, [activeSheet, fieldConfig.emotions, stage]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        back,
      );
      return () => subscription.remove();
    }, [back]),
  );

  const keep = async () => {
    if (!draft || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      await onKeep(buildMoodEntrySubmitValues(draft, fieldConfig), () =>
        dispatch({ type: "clear" }),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const moodLabel = draft
    ? `${getMoodRatingLabel(draft.mood)} ${draft.mood}`
    : "";
  const feelings = draft
    ? visibleCheckInFeelings(emotionOptions, draft.emotions)
    : [];
  const previews = [
    fieldConfig.emotions && emotionOptions.length
      ? `Feelings: ${visibleCheckInFeelings(emotionOptions, []).slice(0, 3).map((emotion) => emotion.name).join(", ")}`
      : null,
    fieldConfig.energy ? "Energy: 0–10" : null,
    fieldConfig.context && contextOptions.length
      ? `Context: ${contextOptions.slice(0, 2).join(", ")}`
      : null,
  ].filter(Boolean);
  const title = {
    mood: "Choose a mood",
    feelings: "Choose feelings",
    context: getDetailsStageTitle(fieldConfig),
  }[stage];
  const nextStepLabel = getNextStepLabel(fieldConfig);
  const trimmedNote = draft ? draft.note.trim() : "";

  return (
    <>
      <View
        style={{ flexShrink: 1 }}
        pointerEvents={saving ? "none" : "auto"}
        accessibilityElementsHidden={activeSheet !== null}
        importantForAccessibility={activeSheet ? "no-hide-descendants" : "auto"}
      >
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={[
            typography.titleMd,
            {
              color: get("text"),
              fontSize: 18,
              lineHeight: 24,
              marginHorizontal: 20,
              marginBottom: 8,
            },
          ]}
        >
          {title}
        </Text>
        {draft && (
          <View className="flex-row flex-wrap gap-2 px-5 mb-2">
            <CheckInChip
              label={`${moodLabel} · Change mood`}
              selected
              onPress={() => dispatch({ type: "stage", stage: "mood" })}
            />
            {fieldConfig.emotions && stage !== "feelings" && (
              <CheckInChip
                label={`${draft.emotions.length ? draft.emotions.map((emotion) => emotion.name).join(", ") : "No feelings"} · Change feelings`}
                onPress={() => dispatch({ type: "stage", stage: "feelings" })}
              />
            )}
            {fieldConfig.energy &&
              draft.energy !== null &&
              stage !== "context" && (
                <CheckInChip
                  label={`Energy ${draft.energy}/10 · Change energy`}
                  onPress={() => dispatch({ type: "stage", stage: "context" })}
                />
              )}
            {fieldConfig.context &&
              draft.contextTags.length > 0 &&
              stage !== "context" && (
                <CheckInChip
                  label={`${draft.contextTags.join(", ")} · Change context`}
                  onPress={() => dispatch({ type: "stage", stage: "context" })}
                />
              )}
          </View>
        )}
        <ScrollView
          key={stage}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 8,
            minHeight: 256,
          }}
        >
          <Animated.View style={stageStyle}>
            {stage === "mood" && (
              <>
                <WeatherMoodGrid
                  size="checkin"
                  selected={draft?.mood}
                  onPress={(mood) =>
                    dispatch({ type: "mood", mood, fields: fieldConfig })
                  }
                />
                {previews.length > 0 && (
                  <Text style={[typography.bodySm, { color: get("textMuted"), marginTop: 8 }]}>
                    {previews.join(" · ")}
                  </Text>
                )}
              </>
            )}
            {stage === "feelings" && draft && (
              <>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[
                    typography.bodySm,
                    { color: get("textMuted"), marginBottom: 10 },
                  ]}
                >
                  {draft.emotions.length}/3 selected. Aim for 2–3, or continue
                  with fewer.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {feelings.map((emotion) => {
                    const selected = draft.emotions.some(
                      (other) => other.name === emotion.name,
                    );
                    return (
                      <CheckInChip
                        key={emotion.name}
                        label={emotion.name}
                        selected={selected}
                        disabled={
                          !selected &&
                          draft.emotions.length >= MAX_CHECK_IN_FEELINGS
                        }
                        onPress={() => {
                          haptics.tick();
                          dispatch({
                            type: "emotions",
                            emotions: selected
                              ? draft.emotions.filter(
                                  (other) => other.name !== emotion.name,
                                )
                              : [...draft.emotions, emotion],
                          });
                        }}
                      />
                    );
                  })}
                  <CheckInChip
                    label="All feelings"
                    onPress={() => dispatch({ type: "sheet", sheet: "feelings" })}
                  />
                </View>
              </>
            )}
            {stage === "context" && draft && (
              <>
                {fieldConfig.energy && (
                  <View>
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons
                          name="flash-outline"
                          size={15}
                          color={getThemedColor("iconSand", isDark)}
                        />
                        <Text
                          style={[
                            typography.bodySm,
                            { color: get("text"), fontWeight: "600" },
                          ]}
                        >
                          Energy
                        </Text>
                      </View>
                      {draft.energy !== null ? (
                        <Pressable
                          testID="energy-clear"
                          onPress={() => {
                            haptics.tick();
                            dispatch({ type: "energy", energy: null });
                          }}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel="Clear energy level"
                          className="justify-center px-2.5 py-0.5 rounded-full"
                          style={{
                            minHeight: 28,
                            backgroundColor: get("surfaceAlt"),
                            borderWidth: 1,
                            borderColor: get("border"),
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "500",
                              color: get("textMuted"),
                            }}
                          >
                            Clear
                          </Text>
                        </Pressable>
                      ) : (
                        <Text
                          style={[
                            typography.bodySm,
                            { color: get("textSubtle") },
                          ]}
                        >
                          Optional
                        </Text>
                      )}
                    </View>
                    <EnergySlider
                      value={draft.energy}
                      onChange={(energy) => dispatch({ type: "energy", energy })}
                      variant="compact"
                      reducedMotion={reducedMotion}
                    />
                  </View>
                )}

                {fieldConfig.energy && fieldConfig.context && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: get("borderSubtle"),
                      marginVertical: 10,
                    }}
                  />
                )}

                {fieldConfig.context && (
                  <View>
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons
                          name="location-outline"
                          size={15}
                          color={getThemedColor("iconDusk", isDark)}
                        />
                        <Text
                          style={[
                            typography.bodySm,
                            { color: get("text"), fontWeight: "600" },
                          ]}
                        >
                          Context
                        </Text>
                      </View>
                      <Text
                        style={[typography.bodySm, { color: get("textSubtle") }]}
                      >
                        {draft.contextTags.length > 0
                          ? `${draft.contextTags.length} selected`
                          : "Optional"}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {Array.from(
                        new Set([...contextOptions, ...draft.contextTags]),
                      ).map((context) => (
                        <CheckInChip
                          key={context}
                          label={`#${context}`}
                          selected={draft.contextTags.includes(context)}
                          onPress={() => {
                            haptics.tick();
                            dispatch({ type: "context", context });
                          }}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {fieldConfig.notes && (
                  <View
                    style={{
                      marginTop:
                        fieldConfig.energy || fieldConfig.context ? 10 : 0,
                      paddingTop:
                        fieldConfig.energy || fieldConfig.context ? 10 : 0,
                      borderTopWidth:
                        fieldConfig.energy || fieldConfig.context ? 1 : 0,
                      borderTopColor: get("borderSubtle"),
                      alignItems: trimmedNote ? "stretch" : "flex-start",
                    }}
                  >
                    <Pressable
                      testID="check-in-note-trigger"
                      onPress={() => dispatch({ type: "sheet", sheet: "note" })}
                      accessibilityRole="button"
                      accessibilityLabel={
                        trimmedNote ? "Edit note" : "Add a note (optional)"
                      }
                      className={
                        trimmedNote
                          ? "flex-row items-center gap-2.5 rounded-xl px-3.5 py-2.5"
                          : "flex-row items-center gap-2 rounded-xl px-3.5"
                      }
                      style={{
                        minHeight: 44,
                        borderWidth: 1,
                        borderColor: get(trimmedNote ? "primary" : "border"),
                        backgroundColor: get(
                          trimmedNote ? "primaryBg" : "surfaceAlt",
                        ),
                      }}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={16}
                        color={get(trimmedNote ? "primary" : "textSubtle")}
                      />
                      {trimmedNote ? (
                        <>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[
                                typography.bodySm,
                                { color: get("text"), fontWeight: "600" },
                              ]}
                            >
                              Note
                            </Text>
                            <Text
                              numberOfLines={2}
                              style={[
                                typography.bodySm,
                                { color: get("textMuted"), marginTop: 2 },
                              ]}
                            >
                              {trimmedNote}
                            </Text>
                          </View>
                          <Text
                            style={[
                              typography.bodySm,
                              { color: get("textSubtle") },
                            ]}
                          >
                            Edit
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={get("textSubtle")}
                          />
                        </>
                      ) : (
                        <Text
                          style={[
                            typography.bodySm,
                            { color: get("text"), fontWeight: "500" },
                          ]}
                        >
                          Add note
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        </ScrollView>
        {draft && (
          <View className="flex-row items-center gap-2 px-5 pt-2">
            {stage !== "mood" && (
              <CheckInChip label="Back" disabled={saving} onPress={back} />
            )}
            <Pressable
              testID={stage === "feelings" ? "check-in-next" : "check-in-keep"}
              accessibilityRole="button"
              accessibilityLabel={
                stage === "feelings" ? nextStepLabel : `Keep ${moodLabel}`
              }
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => {
                if (stage === "feelings")
                  dispatch({ type: "stage", stage: "context" });
                else void keep();
              }}
              className="flex-1 items-center justify-center rounded-2xl px-3 py-3"
              style={{
                minHeight: 48,
                backgroundColor: get("primary"),
                opacity: saving ? 0.45 : 1,
              }}
            >
              <Text
                style={[
                  typography.bodyMd,
                  { color: get("onPrimary"), textAlign: "center" },
                ]}
              >
                {stage === "feelings" ? nextStepLabel : "Keep entry"}
              </Text>
            </Pressable>
            <CheckInChip
              label="Clear"
              disabled={saving}
              onPress={() => dispatch({ type: "clear" })}
            />
          </View>
        )}
      </View>
      {draft && activeSheet && (
        <CheckInDetailSheet
          draft={draft}
          sheet={activeSheet}
          fieldConfig={fieldConfig}
          emotionOptions={emotionOptions}
          dispatch={dispatch}
        />
      )}
    </>
  );
}
