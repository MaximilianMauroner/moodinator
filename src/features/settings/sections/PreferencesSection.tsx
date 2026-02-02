import React from "react";
import { Link } from "expo-router";
import { TouchableOpacity, View, Text } from "react-native";
import { SectionHeader } from "../components/SectionHeader";
import { SettingCard } from "../components/SettingCard";
import { ToggleRow } from "../components/ToggleRow";
import { SettingRow } from "../components/SettingRow";

export function PreferencesSection({
  showDetailedLabels,
  onToggleDetailedLabels,
}: {
  showDetailedLabels: boolean;
  onToggleDetailedLabels: (value: boolean) => void;
}) {
  return (
    <>
      <SectionHeader title="Display" icon="🎨" />
      <SettingCard>
        <ToggleRow
          title="Detailed Labels"
          description="Show mood descriptions in charts"
          value={showDetailedLabels}
          onChange={onToggleDetailedLabels}
          icon="text-outline"
        />
      </SettingCard>

      <SectionHeader title="Notifications" icon="🔔" />
      <SettingCard>
        <SettingRow
          label="Notification Settings"
          subLabel="Manage your reminders"
          icon="notifications-outline"
          isLast
          action={
            <Link href="/notifications" asChild>
              <TouchableOpacity>
                <View className="px-3 py-1.5 rounded-full bg-sage-100 dark:bg-sage-600/30">
                  <Text className="font-medium text-sm text-sage-500 dark:text-sage-300">
                    Configure
                  </Text>
                </View>
              </TouchableOpacity>
            </Link>
          }
        />
      </SettingCard>
    </>
  );
}
