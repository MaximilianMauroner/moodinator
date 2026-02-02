import React, { useEffect } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { ToggleRow } from "@/features/settings/components/ToggleRow";

export default function DisplaySettingsScreen() {
  const hydrate = useSettingsStore((state) => state.hydrate);
  const showDetailedLabels = useSettingsStore((state) => state.showDetailedLabels);
  const setShowDetailedLabels = useSettingsStore((state) => state.setShowDetailedLabels);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Display"
        subtitle="Preferences"
        icon="eye-outline"
        accentColor="sage"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Charts">
          <ToggleRow
            title="Detailed Labels"
            description="Show mood descriptions on chart axes and tooltips"
            value={showDetailedLabels}
            onChange={setShowDetailedLabels}
            icon="text-outline"
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Feedback">
          <ToggleRow
            title="Haptic Feedback"
            description="Vibration feedback when interacting with buttons and controls"
            value={hapticsEnabled}
            onChange={setHapticsEnabled}
            icon="hand-left-outline"
            isLast
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
