import React from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/constants/colors";
import { ALL_REMINDER_DAYS, formatReminderDays } from "@/lib/reminderDays";
import { REMINDER_PRESETS } from "@/lib/reminderPresets";
import { formatReminderTime } from "@/lib/reminderTimePresentation";

export function ReminderSetupChoices({ languageTag, uses24hourClock, onChoose }: {
  languageTag: string;
  uses24hourClock: boolean | null;
  onChoose: (hour: number, minute: number, weekdays: number[]) => void;
}) {
  const { get } = useThemeColors();
  return <View className="mb-5 gap-3">
    <Text className="text-base" style={{ color: get("text") }}>
      Start with a suggestion or choose your own schedule. Review and edit before saving.
    </Text>
    {REMINDER_PRESETS.map((preset) => {
      const summary = `${formatReminderTime(preset.hour, preset.minute, languageTag, uses24hourClock)} · ${formatReminderDays(preset.weekdays, languageTag)}`;
      return <Pressable key={preset.id} accessibilityRole="button"
        accessibilityLabel={`${preset.label}, ${summary}`}
        accessibilityHint="Opens an editable draft. Nothing is scheduled yet."
        onPress={() => onChoose(preset.hour, preset.minute, [...preset.weekdays])}
        className="rounded-xl p-4" style={{ backgroundColor: get("surface"), borderWidth: 1, borderColor: get("border") }}>
        <Text className="font-semibold text-base" style={{ color: get("text") }}>{preset.label}</Text>
        <Text className="text-sm mt-1" style={{ color: get("textMuted") }}>{summary}</Text>
      </Pressable>;
    })}
    <Pressable accessibilityRole="button" accessibilityLabel="Custom schedule"
      accessibilityHint="Choose a time and days, then review before saving."
      onPress={() => onChoose(20, 0, [...ALL_REMINDER_DAYS])}
      className="rounded-xl p-4" style={{ backgroundColor: get("primaryBg") }}>
      <Text className="font-semibold text-base" style={{ color: get("text") }}>Custom schedule</Text>
    </Pressable>
    <Text className="text-sm" style={{ color: get("textMuted") }}>Reminders are optional. Choosing a suggestion does not enable notifications.</Text>
  </View>;
}

export function ReminderDayChoices({ weekdays, languageTag, onChange }: {
  weekdays: number[];
  languageTag: string;
  onChange: (days: number[]) => void;
}) {
  const { get } = useThemeColors();
  return <View className="mb-5 gap-2">
    <Text className="font-semibold text-base" style={{ color: get("text") }}>Repeat on</Text>
    <Pressable accessibilityRole="checkbox" accessibilityLabel="Every day"
      accessibilityState={{ checked: weekdays.length === 7 }}
      onPress={() => onChange(weekdays.length === 7 ? [] : [...ALL_REMINDER_DAYS])}
      className="rounded-xl p-3" style={{ backgroundColor: weekdays.length === 7 ? get("primaryBg") : get("surface") }}>
      <Text style={{ color: get("text") }}>Every day{weekdays.length === 7 ? " · Selected" : ""}</Text>
    </Pressable>
    <View className="flex-row flex-wrap gap-2">
      {ALL_REMINDER_DAYS.map((day) => {
        const date = new Date(2024, 0, 6 + day);
        const label = new Intl.DateTimeFormat(languageTag, { weekday: "long" }).format(date);
        const selected = weekdays.includes(day);
        return <Pressable key={day} accessibilityRole="checkbox" accessibilityLabel={label}
          accessibilityState={{ checked: selected }}
          onPress={() => onChange(selected ? weekdays.filter((value) => value !== day) : [...weekdays, day].sort())}
          className="rounded-xl px-4 py-3" style={{ backgroundColor: selected ? get("primaryBg") : get("surface"), borderWidth: 1, borderColor: selected ? get("primary") : get("border") }}>
          <Text style={{ color: get("text") }}>{label}{selected ? " · Selected" : ""}</Text>
        </Pressable>;
      })}
    </View>
    {weekdays.length === 0 && <Text accessibilityRole="alert" style={{ color: get("text") }}>Choose at least one day.</Text>}
  </View>;
}
