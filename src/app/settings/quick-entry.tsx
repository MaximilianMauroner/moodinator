import React, { useCallback, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettingsStore } from "@/shared/state/settingsStore";
import type { QuickEntryPrefs } from "@/lib/entrySettings";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { ToggleRow } from "@/features/settings/components/ToggleRow";

export default function QuickEntrySettingsScreen() {

  const hydrate = useSettingsStore((state) => state.hydrate);
  const quickEntryPrefs = useSettingsStore((state) => state.quickEntryPrefs);
  const setQuickEntryPrefs = useSettingsStore((state) => state.setQuickEntryPrefs);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleToggle = useCallback(
    async (key: keyof QuickEntryPrefs, value: boolean) => {
      await setQuickEntryPrefs({ ...quickEntryPrefs, [key]: value });
    },
    [quickEntryPrefs, setQuickEntryPrefs]
  );

  const activeCount = [
    quickEntryPrefs.showEmotions,
    quickEntryPrefs.showContext,
    quickEntryPrefs.showEnergy,
    quickEntryPrefs.showNotes,
  ].filter(Boolean).length;

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Quick Entry"
        subtitle="Preferences"
        icon="flash-outline"
        accentColor="sand"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-sand-100 dark:bg-sand-800">
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl mr-2">
              {activeCount === 4 ? "🎯" : activeCount >= 2 ? "⚡" : "💨"}
            </Text>
            <Text className="text-base font-bold text-sand-600 dark:text-sand-400">
              {activeCount} of 4 fields enabled
            </Text>
          </View>
          <Text className="text-xs text-sand-500 dark:text-sand-400">
            Quick entry appears when you tap the mood button. Long-press the button for detailed entry with all fields.
          </Text>
        </View>

        <SettingsSection title="Fields to show">
          <ToggleRow
            title="Emotions"
            description="Select how you're feeling"
            value={quickEntryPrefs.showEmotions}
            onChange={(v) => handleToggle("showEmotions", v)}
            icon="heart-outline"
          />
          <ToggleRow
            title="Context"
            description="Where, who, and what you're doing"
            value={quickEntryPrefs.showContext}
            onChange={(v) => handleToggle("showContext", v)}
            icon="location-outline"
          />
          <ToggleRow
            title="Energy"
            description="Your energy level slider"
            value={quickEntryPrefs.showEnergy}
            onChange={(v) => handleToggle("showEnergy", v)}
            icon="flash-outline"
          />
          <ToggleRow
            title="Notes"
            description="Quick note text field"
            value={quickEntryPrefs.showNotes}
            onChange={(v) => handleToggle("showNotes", v)}
            icon="document-text-outline"
            isLast
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
