import React, { useCallback, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { clearMoods, seedMoods } from "@db/db";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";
import { ToggleRow } from "@/features/settings/components/ToggleRow";

export default function DeveloperSettingsScreen() {
  const hydrate = useSettingsStore((state) => state.hydrate);
  const devOptionsEnabled = useSettingsStore((state) => state.devOptionsEnabled);
  const setDevOptionsEnabled = useSettingsStore((state) => state.setDevOptionsEnabled);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleSeedMoods = useCallback(async () => {
    try {
      const result = await seedMoods();
      Alert.alert("Sample Data Added", `Successfully added ${result} sample mood entries.`);
    } catch {
      Alert.alert("Error", "Failed to add sample data");
    }
  }, []);

  const handleTestNotification = useCallback(async () => {
    await Notifications.scheduleNotificationAsync({
      content: { title: "Test Notification", body: "This is a test notification!" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
    });
    Alert.alert("Scheduled", "Notification will appear in 2 seconds.");
  }, []);

  const handleClearMoods = useCallback(() => {
    Alert.alert("Clear All Data", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All",
        style: "destructive",
        onPress: async () => {
          try {
            await clearMoods();
            Alert.alert("Success", "All mood data has been cleared.");
          } catch {
            Alert.alert("Error", "Failed to clear mood data");
          }
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Developer"
        subtitle="Advanced"
        icon="code-slash-outline"
        accentColor="sand"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning banner */}
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-sand-100 dark:bg-sand-800">
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl mr-2">⚠️</Text>
            <Text className="text-base font-bold text-sand-600 dark:text-sand-400">
              Advanced Options
            </Text>
          </View>
          <Text className="text-xs text-sand-500 dark:text-sand-400">
            These options are for development and testing. Use with caution as some actions cannot be undone.
          </Text>
        </View>

        <SettingsSection title="Mode">
          <ToggleRow
            title="Developer Mode"
            description="Enable advanced testing options"
            value={devOptionsEnabled}
            onChange={setDevOptionsEnabled}
            icon="code-slash-outline"
            isLast
          />
        </SettingsSection>

        {devOptionsEnabled && (
          <>
            <SettingsSection title="Testing">
              <SettingRow
                label="Add Sample Data"
                subLabel="Generate test mood entries"
                icon="flask-outline"
                onPress={handleSeedMoods}
              />
              <SettingRow
                label="Test Notification"
                subLabel="Send a push notification in 2s"
                icon="notifications-circle-outline"
                onPress={handleTestNotification}
                isLast
              />
            </SettingsSection>

            <SettingsSection title="Danger Zone">
              <SettingRow
                label="Clear All Data"
                subLabel="Permanently delete all mood entries"
                icon="trash-outline"
                destructive
                isLast
                onPress={handleClearMoods}
              />
            </SettingsSection>
          </>
        )}

        {!devOptionsEnabled && (
          <View className="mx-4 mt-4 p-6 items-center">
            <Text className="text-4xl mb-3">🔒</Text>
            <Text className="text-sm text-sand-500 dark:text-sand-400 text-center">
              Enable Developer Mode above to access testing and advanced options.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
