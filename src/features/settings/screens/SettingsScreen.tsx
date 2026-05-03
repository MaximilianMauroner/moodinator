import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { dataPortabilityService } from "@/services/dataPortabilityService";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { useMoodsStore } from "@/shared/state/moodsStore";

import { ProfileCard } from "../components/ProfileCard";
import { SettingsCategoryCard } from "../components/SettingsCategoryCard";

export function SettingsScreen() {
  const [backupCount, setBackupCount] = useState(0);

  const moods = useMoodsStore((state) => state.moods);
  const ensureFresh = useMoodsStore((state) => state.ensureFresh);
  const emotions = useSettingsStore((state) => state.emotions);
  const contexts = useSettingsStore((state) => state.contexts);
  const quickEntryPrefs = useSettingsStore((state) => state.quickEntryPrefs);

  const loadStats = useCallback(async () => {
    try {
      await ensureFresh();
      const backupInfo = await dataPortabilityService.getBackupInfo();
      setBackupCount(backupInfo.count);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, [ensureFresh]);

  // Reload stats when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats])
  );

  const entryCount = moods.length;
  const daysTracking = useMemo(() => {
    if (moods.length === 0) {
      return 0;
    }

    return new Set(
      moods.map((mood) => {
        const date = new Date(mood.timestamp);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      })
    ).size;
  }, [moods]);

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
        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-600 dark:text-paper-400 mb-3 mt-2 ml-1">
          Mood Tracking
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="Quick Entry"
            description="Choose fields shown while logging"
            icon="flash-outline"
            href="/settings/quick-entry"
            accentColor="sand"
            badge={`${activeQuickEntryFields}/4`}
          />

          <SettingsCategoryCard
            title="Emotions"
            description="Manage your emotion presets"
            icon="heart-outline"
            href="/settings/emotions"
            accentColor="coral"
            badge={emotions.length}
          />

          <SettingsCategoryCard
            title="Context Tags"
            description="Places, people, and recurring situations"
            icon="pricetag-outline"
            href="/settings/contexts"
            accentColor="dusk"
            badge={contexts.length}
          />
        </View>

        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-600 dark:text-paper-400 mb-3 mt-6 ml-1">
          App Experience
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="Notifications"
            description="Manage check-in reminders"
            icon="notifications-outline"
            href="/notifications"
            accentColor="sage"
          />

          <SettingsCategoryCard
            title="Display"
            description="Labels, charts, and history cards"
            icon="eye-outline"
            href="/settings/display"
            accentColor="sage"
          />
        </View>

        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-600 dark:text-paper-400 mb-3 mt-6 ml-1">
          Privacy & Data
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="Security"
            description="App lock and local privacy controls"
            icon="lock-closed-outline"
            href="/settings/security"
            accentColor="sand"
          />

          <SettingsCategoryCard
            title="Data & Backups"
            description="Data export, import, and backups"
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

        <Text className="text-xs font-semibold uppercase tracking-wider text-sand-600 dark:text-paper-400 mb-3 mt-6 ml-1">
          Support & Advanced
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="About"
            description="App info, support, and legal"
            icon="information-circle-outline"
            href="/settings/about"
            accentColor="dusk"
          />

          <SettingsCategoryCard
            title="Developer"
            description="Advanced options and testing"
            icon="code-slash-outline"
            href="/settings/developer"
            accentColor="sand"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
