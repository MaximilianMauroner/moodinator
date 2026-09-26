import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Platform, Pressable, Switch, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { useCalendars, useLocales } from "expo-localization";
import { useThemeColors } from "@/constants/colors";
import { Alert } from "@/components/ui/AppAlert";
import { formatReminderTime } from "@/lib/reminderTimePresentation";
import { getNoEntryReminderSettings, saveNoEntryReminderSettings, reconcileNoEntryReminder } from "@/services/notificationService";
import type { NoEntryReminderSettings as Settings } from "@/services/noEntryReminderScheduler";

export function NoEntryReminderSettings() {
  const { get } = useThemeColors();
  const [{ languageTag }] = useLocales();
  const [{ uses24hourClock }] = useCalendars();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void getNoEntryReminderSettings().then((value) => {
      if (!active) return;
      setSettings(value); setHour(value.hour); setMinute(value.minute);
    }).catch(() => {
      if (active) Alert.alert("Reminder unavailable", "Your saved reminder setting could not be read. Try opening Reminders again.");
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void reconcileNoEntryReminder().then((value) => {
        if (active) setSettings(value);
      }).catch(() => {
        if (active) Alert.alert("Reminder unavailable", "Your reminder status could not be refreshed. Try opening Reminders again.");
      });
    });
    return () => { active = false; subscription.remove(); };
  }, []));

  const save = async (enabled: boolean) => {
    if (busy.current) return;
    busy.current = true; setSaving(true);
    try {
      setSettings(await saveNoEntryReminderSettings({ enabled, hour, minute }));
    } catch {
      Alert.alert("Reminder not saved", "Your setting could not be saved. Please try again.");
    } finally { busy.current = false; setSaving(false); }
  };
  const toggle = (enabled: boolean) => {
    if (!enabled) { void save(false); return; }
    Alert.alert("Enable optional reminders?", "Moodinator will ask for notification permission if needed. Reminders are planned locally from your saved entries for up to 14 days. Reopen the app to refresh them and after changing timezones.", [
      { text: "Cancel", style: "cancel" },
      { text: "Enable", onPress: () => { void save(true); } },
    ]);
  };
  const changeTime = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setPickerOpen(false);
    if (date && event.type !== "dismissed") { setHour(date.getHours()); setMinute(date.getMinutes()); }
  };
  const time = formatReminderTime(hour, minute, languageTag, uses24hourClock);
  return <View className="rounded-2xl p-4 mb-5 gap-3" style={{ backgroundColor: get("surface"), borderWidth: 1, borderColor: get("border") }}>
    <View className="flex-row items-center gap-3">
      <Text className="flex-1 text-lg font-semibold" style={{ color: get("text") }}>No entry today</Text>
      <Switch accessibilityLabel="No entry today reminder" accessibilityHint="Enable or disable optional reminders"
        value={settings?.enabled ?? false} disabled={!settings || saving} onValueChange={toggle} />
    </View>
    <Text style={{ color: get("textMuted") }}>An optional check-in on days without a saved mood entry. Plans up to 14 days ahead and refreshes when you log or reopen. Reopen after timezone changes.</Text>
    <Text className="text-sm" style={{ color: get("textMuted") }}>Your other reminders still run on days you log. When one uses this time, no extra prompt is planned. If notification cleanup fails, a prompt may still arrive.</Text>
    {!settings ? <ActivityIndicator accessibilityLabel="Loading optional reminder" /> : <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Choose no-entry reminder time, currently ${time}`}
        disabled={saving} onPress={() => setPickerOpen(true)} className="rounded-xl p-3" style={{ backgroundColor: get("primaryBg") }}>
        <Text style={{ color: get("text") }}>{time} · Local time</Text>
      </Pressable>
      {pickerOpen && <>
        <DateTimePicker mode="time" display={Platform.OS === "ios" ? "spinner" : "default"}
          value={new Date(new Date().setHours(hour, minute, 0, 0))} onChange={changeTime} is24Hour={uses24hourClock ?? undefined} />
        {Platform.OS === "ios" && <Pressable accessibilityRole="button" accessibilityLabel="Done choosing no-entry reminder time" onPress={() => setPickerOpen(false)} className="p-3">
          <Text style={{ color: get("text") }}>Done</Text>
        </Pressable>}
      </>}
      {(hour !== settings.hour || minute !== settings.minute) && <Pressable accessibilityRole="button" accessibilityLabel="Save no-entry reminder time"
        disabled={saving} onPress={() => { void save(settings.enabled); }} className="p-3 rounded-xl" style={{ backgroundColor: get("primaryBg") }}>
        <Text style={{ color: get("text") }}>Save time</Text>
      </Pressable>}
      <Text accessibilityLiveRegion="polite" style={{ color: get("text") }}>
        {settings.status === "disabled" ? "Off" : settings.status === "scheduled"
          ? `Planned through ${settings.scheduledThroughDayKey}. Device delivery may be delayed.`
          : settings.status === "limited" ? "Only some days could be planned."
          : settings.status === "failed" ? "Schedule needs attention" : "Not scheduled"}
      </Text>
      {settings.message && <Text accessibilityRole="alert" style={{ color: get("text") }}>{settings.message}</Text>}
      {settings.status === "permission-denied" && <Pressable accessibilityRole="button" accessibilityLabel="Open no-entry notification settings" className="p-3"
        onPress={() => { void Linking.openSettings().catch(() => Alert.alert("Open device settings", "Allow notifications for Moodinator in your device settings.")); }}>
        <Text style={{ color: get("text") }}>Open notification settings</Text>
      </Pressable>}
    </>}
  </View>;
}
