import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { getAllMoods } from "@db/db";
import { getBackupInfo } from "@db/backup";
import { useSettingsStore } from "@/shared/state/settingsStore";

import { ProfileCard } from "../components/ProfileCard";
import { SettingsCategoryCard } from "../components/SettingsCategoryCard";

export function SettingsScreen() {
  const [entryCount, setEntryCount] = useState(0);
  const [daysTracking, setDaysTracking] = useState(0);
  const [backupCount, setBackupCount] = useState(0);

  const emotions = useSettingsStore((state) => state.emotions);
  const contexts = useSettingsStore((state) => state.contexts);
  const quickEntryPrefs = useSettingsStore((state) => state.quickEntryPrefs);
  const hydrate = useSettingsStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const loadStats = useCallback(async () => {
    try {
      const moods = await getAllMoods();
      setEntryCount(moods.length);
      if (moods.length > 0) {
        const uniqueDays = new Set(
          moods.map((mood) => {
            const date = new Date(mood.timestamp);
            return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          })
        );
        setDaysTracking(uniqueDays.size);
      }

      const backupInfo = await getBackupInfo();
      setBackupCount(backupInfo.count);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  // Reload stats when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  // Count active quick entry fields
  const activeQuickEntryFields = [
    quickEntryPrefs.showEmotions,
    quickEntryPrefs.showContext,
    quickEntryPrefs.showEnergy,
    quickEntryPrefs.showNotes,
  ].filter(Boolean).length;

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      {/* Header */}
      <View className="px-6 pt-4 pb-5 bg-paper-100 dark:bg-paper-900">
        <Text className="text-xs font-medium mb-1 text-sage-500 dark:text-sage-300">
          Customize your experience
        </Text>
        <Text className="text-2xl font-bold text-paper-800 dark:text-paper-200 tracking-tight">
          Settings
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <ProfileCard entryCount={entryCount} daysTracking={daysTracking} />

        {/* Categories */}
        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-500 dark:text-sand-400 mb-3 mt-2 ml-1">
          Preferences
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="Display"
            description="Labels, charts, and visual options"
            icon="eye-outline"
            href="/settings/display"
            accentColor="sage"
          />

          <SettingsCategoryCard
            title="Quick Entry"
            description="Customize what appears in quick entry"
            icon="flash-outline"
            href="/settings/quick-entry"
            accentColor="sand"
            badge={`${activeQuickEntryFields}/4`}
          />

          <SettingsCategoryCard
            title="Notifications"
            description="Manage your reminders"
            icon="notifications-outline"
            href="/notifications"
            accentColor="sage"
          />
        </View>

        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-500 dark:text-sand-400 mb-3 mt-6 ml-1">
          Customization
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="Emotions"
            description="Manage your emotion presets"
            icon="happy-outline"
            href="/settings/emotions"
            accentColor="coral"
            badge={emotions.length}
          />

          <SettingsCategoryCard
            title="Context Tags"
            description="Tags for where, who, and what"
            icon="pricetag-outline"
            href="/settings/contexts"
            accentColor="dusk"
            badge={contexts.length}
          />
        </View>

        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-500 dark:text-sand-400 mb-3 mt-6 ml-1">
          Data
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="Data & Backups"
            description="Export, import, and backup your data"
            icon="cloud-outline"
            href="/settings/data"
            accentColor="sage"
            preview={backupCount > 0 ? `${backupCount} backup${backupCount === 1 ? "" : "s"} saved` : undefined}
          />

          <SettingsCategoryCard
            title="Therapy Export"
            description="Create a report for your therapist"
            icon="medical-outline"
            href="/therapy-export"
            accentColor="dusk"
          />
        </View>

        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-500 dark:text-sand-400 mb-3 mt-6 ml-1">
          More
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="Developer"
            description="Advanced options and testing"
            icon="code-slash-outline"
            href="/settings/developer"
            accentColor="sand"
          />

          <SettingsCategoryCard
            title="About"
            description="App info and support"
            icon="information-circle-outline"
            href="/settings/about"
            accentColor="dusk"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
