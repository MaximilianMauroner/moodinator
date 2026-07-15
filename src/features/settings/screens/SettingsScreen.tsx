import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { dataPortabilityService } from "@/services/dataPortabilityService";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { useAppLockStore } from "@/features/appLock";
import { Ionicons } from "@expo/vector-icons";

import { ProfileCard } from "../components/ProfileCard";
import { SettingsCategoryCard } from "../components/SettingsCategoryCard";
import { SettingsHeader } from "../components/SettingsHeader";
import { ScreenBackgroundAccent } from "@/components/layout/ScreenBackgroundAccent";

export function SettingsScreen() {
  const [backupCount, setBackupCount] = useState(0);
  const [statsError, setStatsError] = useState(false);
  const appLockEnabled = useAppLockStore((state) => state.isEnabled);

  const moods = useMoodsStore((state) => state.moods);
  const ensureFresh = useMoodsStore((state) => state.ensureFresh);
  const emotions = useSettingsStore((state) => state.emotions);
  const contexts = useSettingsStore((state) => state.contexts);
  const quickEntryPrefs = useSettingsStore((state) => state.quickEntryPrefs);

  const loadStats = useCallback(async () => {
    try {
      setStatsError(false);
      await ensureFresh();
      const backupInfo = await dataPortabilityService.getBackupInfo();
      setBackupCount(backupInfo.count);
    } catch (error) {
      setStatsError(true);
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
      <ScreenBackgroundAccent />
      <SettingsHeader />

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <ProfileCard entryCount={entryCount} daysTracking={daysTracking} />

        <View className="mb-5 rounded-2xl border border-sage-200 dark:border-sage-700 bg-sage-50 dark:bg-sage-900/20 p-4">
          <View className="flex-row items-center">
            <Ionicons name="lock-closed" size={20} color="#5B8A5B" />
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-paper-800 dark:text-paper-100">Local privacy</Text>
              <Text className="text-xs mt-0.5 text-paper-700 dark:text-sand-400">
                Stored on this device · App lock {appLockEnabled ? "on" : "off"}
              </Text>
              <Text className="text-xs mt-0.5 text-paper-700 dark:text-sand-400">
                {backupCount > 0 ? `${backupCount} local backup${backupCount === 1 ? "" : "s"} saved` : "No local backups yet"}
              </Text>
            </View>
          </View>
          {statsError && (
            <Text className="text-xs mt-2 text-coral-700 dark:text-coral-300">
              Some local status details could not be refreshed.
            </Text>
          )}
        </View>

        {/* Categories */}
        <Text className="text-xs font-semibold uppercase tracking-wider text-paper-700 dark:text-paper-400 mb-3 mt-2 ml-1">
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

        <Text className="text-xs font-semibold uppercase tracking-wider text-paper-700 dark:text-paper-400 mb-3 mt-6 ml-1">
          App Experience
        </Text>

        <View className="gap-3">
          <SettingsCategoryCard
            title="Reminders"
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

        <Text className="text-xs font-semibold uppercase tracking-wider text-paper-700 dark:text-paper-400 mb-3 mt-6 ml-1">
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
            icon="folder-outline"
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

        <Text className="text-xs font-semibold uppercase tracking-wider text-paper-700 dark:text-paper-400 mb-3 mt-6 ml-1">
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

          {__DEV__ && (
            <SettingsCategoryCard
              title="Developer"
              description="Advanced options and testing"
              icon="code-slash-outline"
              href="/settings/developer"
              accentColor="sand"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
