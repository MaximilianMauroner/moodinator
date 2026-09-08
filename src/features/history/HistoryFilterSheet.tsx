import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { typography } from "@/constants/typography";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useEntrySettings } from "@/hooks/useEntrySettings";
import { haptics } from "@/lib/haptics";
import { moodService, type MoodHistoryFilters } from "@/services/moodService";
import { useMoodsStore } from "@/shared/state/moodsStore";
import {
  DATE_PRESETS,
  EMPTY_MOOD_DRAFT,
  datePresetRange,
  defaultCustomRange,
  describeFilters,
  endOfDay,
  matchDatePreset,
  mergeFilterChoices,
  moodRangeSummary,
  pickMoodValue,
  startOfDay,
  type DatePresetId,
  type MoodRangeDraft,
} from "./filterModel";
import {
  ChoiceChip,
  CollapsibleChoices,
  MoodRangeRow,
  SectionResetButton,
  SheetSection,
  filterPalette,
} from "./HistoryFilterSheetParts";

function toggleName(names: string[], name: string): string[] {
  return names.includes(name)
    ? names.filter((value) => value !== name)
    : [...names, name];
}

export function HistoryFilterSheet() {
  const isDark = useColorScheme() === "dark";
  const palette = filterPalette(isDark);
  const { emotionOptions, contextOptions } = useEntrySettings();
  const filters = useMoodsStore((state) => state.filters);
  const setFilters = useMoodsStore((state) => state.setFilters);

  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<MoodRangeDraft>(EMPTY_MOOD_DRAFT);
  const [datePreset, setDatePreset] = useState<DatePresetId>("any");
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  // Names from older entries, so a preset that was renamed or removed stays
  // filterable.
  const [pastEmotions, setPastEmotions] = useState<string[]>([]);
  const [pastContexts, setPastContexts] = useState<string[]>([]);

  // Counts what the chip bar shows, so a date range reads as one filter.
  const activeCount = useMemo(
    () => describeFilters(filters, new Date()).length,
    [filters],
  );

  const open = useCallback(() => {
    const now = new Date();
    const fallback = defaultCustomRange(now);
    setText(filters.text ?? "");
    setMood({
      range:
        filters.minMood === undefined && filters.maxMood === undefined
          ? null
          : { min: filters.minMood ?? 0, max: filters.maxMood ?? 10 },
      anchor: null,
    });
    setDatePreset(matchDatePreset(filters, now));
    setCustomStart(
      filters.startDate === undefined ? fallback.start : new Date(filters.startDate),
    );
    setCustomEnd(
      filters.endDate === undefined ? fallback.end : new Date(filters.endDate),
    );
    setEmotions(filters.emotions ?? []);
    setContexts(filters.contexts ?? []);
    setPicking(null);
    setVisible(true);
    haptics.tap();
    void Promise.all([
      moodService.getEmotionNames(),
      moodService.getContextTags(),
    ]).then(([emotionNames, contextNames]) => {
      setPastEmotions(emotionNames);
      setPastContexts(contextNames);
    });
  }, [filters]);

  const emotionChoices = useMemo(
    () =>
      mergeFilterChoices(
        emotionOptions.map((emotion) => emotion.name),
        pastEmotions,
        emotions,
      ),
    [emotionOptions, pastEmotions, emotions],
  );
  const contextChoices = useMemo(
    () => mergeFilterChoices(contextOptions, pastContexts, contexts),
    [contextOptions, pastContexts, contexts],
  );

  const dirty =
    Boolean(text.trim()) ||
    mood.range !== null ||
    datePreset !== "any" ||
    emotions.length > 0 ||
    contexts.length > 0;

  const apply = () => {
    const next: MoodHistoryFilters = {};
    if (text.trim()) next.text = text.trim();
    if (mood.range) {
      next.minMood = mood.range.min;
      next.maxMood = mood.range.max;
    }
    if (emotions.length) next.emotions = emotions;
    if (contexts.length) next.contexts = contexts;
    const range =
      datePreset === "custom"
        ? { startDate: startOfDay(customStart), endDate: endOfDay(customEnd) }
        : datePresetRange(datePreset, new Date());
    if (range.startDate !== undefined) next.startDate = range.startDate;
    if (range.endDate !== undefined) next.endDate = range.endDate;
    void setFilters(next);
    setVisible(false);
  };

  const clear = () => {
    setText("");
    setMood(EMPTY_MOOD_DRAFT);
    setDatePreset("any");
    setEmotions([]);
    setContexts([]);
    haptics.tick();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Filter history"
        onPress={open}
        className="flex-row items-center gap-1.5 rounded-full px-3"
        style={{
          backgroundColor: activeCount ? palette.band : palette.chipBg,
          borderColor: activeCount ? palette.accent : palette.chipBorder,
          borderWidth: 1,
          minHeight: 32,
        }}
      >
        <Ionicons name="filter" size={15} color={palette.accent} />
        <Text
          style={[typography.bodySm, { color: palette.accent, fontWeight: "600" }]}
        >
          Filter
        </Text>
        {activeCount ? (
          <View
            className="items-center justify-center rounded-full"
            style={{ backgroundColor: palette.accent, minWidth: 18, height: 18 }}
          >
            <Text
              style={{
                color: palette.onAccent,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {activeCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: palette.surface }}>
            <View
              className="flex-row items-center justify-between px-5 pb-3 pt-4"
              style={{ borderBottomColor: palette.divider, borderBottomWidth: 1 }}
            >
              <Text style={[typography.titleMd, { color: palette.text }]}>
                Filter history
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={() => setVisible(false)}
                hitSlop={10}
                className="items-center justify-center rounded-full"
                style={{ backgroundColor: palette.chipBg, height: 34, width: 34 }}
              >
                <Ionicons name="close" size={19} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 18, paddingBottom: 6 }}
              keyboardShouldPersistTaps="handled"
            >
              <SheetSection title="When" palette={palette}>
                <View className="flex-row flex-wrap gap-1.5">
                  {DATE_PRESETS.map((preset) => (
                    <ChoiceChip
                      key={preset.id}
                      label={preset.label}
                      selected={datePreset === preset.id}
                      accessibilityLabel={preset.label}
                      palette={palette}
                      onPress={() => {
                        haptics.tick();
                        setDatePreset(preset.id);
                      }}
                    />
                  ))}
                </View>
                {datePreset === "custom" ? (
                  <View className="mt-3 flex-row gap-2">
                    {(
                      [
                        ["Start date", customStart, "start"],
                        ["End date", customEnd, "end"],
                      ] as const
                    ).map(([label, value, which]) => (
                      <Pressable
                        key={which}
                        accessibilityRole="button"
                        accessibilityLabel={`${label}, currently ${value.toLocaleDateString()}`}
                        onPress={() => setPicking(which)}
                        className="flex-1 rounded-2xl px-3 py-2"
                        style={{
                          backgroundColor: palette.chipBg,
                          borderColor: palette.chipBorder,
                          borderWidth: 1,
                        }}
                      >
                        <Text style={[typography.bodySm, { color: palette.subtle }]}>
                          {label}
                        </Text>
                        <Text
                          style={[
                            typography.bodyMd,
                            { color: palette.text, fontWeight: "600" },
                          ]}
                        >
                          {value.toLocaleDateString()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </SheetSection>

              <SheetSection
                title="Mood"
                palette={palette}
                action={
                  mood.range ? (
                    <SectionResetButton
                      label="Any mood"
                      palette={palette}
                      onPress={() => setMood(EMPTY_MOOD_DRAFT)}
                    />
                  ) : undefined
                }
              >
                <MoodRangeRow
                  range={mood.range}
                  palette={palette}
                  onPick={(value) => {
                    haptics.tick();
                    setMood((current) => pickMoodValue(current, value));
                  }}
                />
                <Text
                  accessibilityLabel={`Mood filter: ${moodRangeSummary(mood.range)}`}
                  className="mt-2"
                  style={[typography.bodySm, { color: palette.subtle }]}
                >
                  {mood.anchor !== null
                    ? "Tap a second number for a range"
                    : `${moodRangeSummary(mood.range)} · 0 is best, 10 is worst`}
                </Text>
              </SheetSection>

              {emotionChoices.length ? (
                <SheetSection title="Emotions" palette={palette}>
                  <CollapsibleChoices
                    label="Emotions"
                    choices={emotionChoices}
                    selected={emotions}
                    palette={palette}
                    onToggle={(name) => {
                      haptics.tick();
                      setEmotions((current) => toggleName(current, name));
                    }}
                  />
                </SheetSection>
              ) : null}

              {contextChoices.length ? (
                <SheetSection title="Context" palette={palette}>
                  <CollapsibleChoices
                    label="Contexts"
                    choices={contextChoices}
                    selected={contexts}
                    palette={palette}
                    onToggle={(name) => {
                      haptics.tick();
                      setContexts((current) => toggleName(current, name));
                    }}
                  />
                </SheetSection>
              ) : null}

              <SheetSection title="Note" palette={palette}>
                <View
                  className="flex-row items-center gap-2 rounded-2xl px-3"
                  style={{
                    backgroundColor: palette.chipBg,
                    borderColor: palette.chipBorder,
                    borderWidth: 1,
                    minHeight: 42,
                  }}
                >
                  <Ionicons name="search" size={16} color={palette.subtle} />
                  <TextInput
                    accessibilityLabel="Note contains"
                    value={text}
                    onChangeText={setText}
                    placeholder="Search note text"
                    placeholderTextColor={palette.subtle}
                    autoCapitalize="none"
                    className="flex-1"
                    style={[typography.bodyMd, { color: palette.text }]}
                  />
                  {text ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear note search"
                      onPress={() => setText("")}
                      hitSlop={10}
                    >
                      <Ionicons name="close-circle" size={17} color={palette.subtle} />
                    </Pressable>
                  ) : null}
                </View>
              </SheetSection>
            </ScrollView>

            <View
              className="flex-row gap-3 px-5 pb-2 pt-3"
              style={{ borderTopColor: palette.divider, borderTopWidth: 1 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
                disabled={!dirty}
                onPress={clear}
                className="items-center justify-center rounded-2xl px-5"
                style={{
                  backgroundColor: palette.chipBg,
                  borderColor: palette.chipBorder,
                  borderWidth: 1,
                  minHeight: 46,
                  opacity: dirty ? 1 : 0.45,
                }}
              >
                <Text
                  style={[typography.bodyMd, { color: palette.text, fontWeight: "600" }]}
                >
                  Clear
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Apply filters"
                onPress={apply}
                className="flex-1 items-center justify-center rounded-2xl"
                style={{ backgroundColor: palette.accent, minHeight: 46 }}
              >
                <Text
                  style={[
                    typography.bodyMd,
                    { color: palette.onAccent, fontWeight: "700" },
                  ]}
                >
                  Show results
                </Text>
              </Pressable>
            </View>

            {picking ? (
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderTopColor: palette.divider,
                  borderTopWidth: 1,
                }}
              >
                {/* The iOS spinner stays mounted until it is dismissed, so it
                    needs its own confirm row. Android uses a system dialog. */}
                {Platform.OS === "ios" ? (
                  <View className="flex-row items-center justify-between px-5 pt-3">
                    <Text style={[typography.bodySm, { color: palette.subtle }]}>
                      {picking === "start" ? "Start date" : "End date"}
                    </Text>
                    <SectionResetButton
                      label="Done"
                      palette={palette}
                      onPress={() => setPicking(null)}
                    />
                  </View>
                ) : null}
                <DateTimePicker
                  value={picking === "start" ? customStart : customEnd}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={picking === "start" ? customEnd : new Date()}
                  minimumDate={picking === "start" ? undefined : customStart}
                  onChange={(_event, date) => {
                    if (Platform.OS !== "ios") setPicking(null);
                    if (!date) return;
                    if (picking === "start") setCustomStart(date);
                    else setCustomEnd(date);
                  }}
                />
              </View>
            ) : null}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default HistoryFilterSheet;
