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
      <SectionHeader title="Preferences" icon="⚙️" />
      <SettingCard>
        <ToggleRow
          title="Detailed Labels"
          description="Show mood descriptions in charts"
          value={showDetailedLabels}
          onChange={onToggleDetailedLabels}
        />
        <SettingRow
          label="Notifications"
          subLabel="Manage reminders"
          icon="notifications-outline"
          isLast
          action={
            <Link href="/notifications" asChild>
              <TouchableOpacity>
                <View className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                  <Text className="text-blue-600 dark:text-blue-400 font-medium text-sm">
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

