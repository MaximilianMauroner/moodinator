import React, { useEffect } from "react";
import { View, Text, AppState, AppStateStatus, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { registerBackgroundBackupTask } from "@db/backgroundBackup";
import { LockScreen, useAppLockStore } from "@/features/appLock";
import { OnboardingScreen, useOnboardingStore } from "@/features/onboarding";
import { AppToaster } from "@/components/ui/AppToaster";
import { useSettingsStore } from "@/shared/state/settingsStore";

import "./global.css";

function AppBootSplash() {
  return (
    <View className="flex-1 bg-white dark:bg-slate-950 justify-center items-center px-8">
      <View className="w-20 h-20 rounded-3xl items-center justify-center mb-5 bg-emerald-50 dark:bg-emerald-900/20">
        <Ionicons name="leaf-outline" size={36} color="#5B8A5B" />
      </View>
      <Text className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Moodinator
      </Text>
      <Text className="text-sm text-slate-600 dark:text-slate-400 mb-5 text-center">
        Preparing your private space...
      </Text>
      <ActivityIndicator size="small" color="#5B8A5B" />
    </View>
  );
}

export default function Layout() {
  const { hydrated: lockHydrated, hydrate: hydrateLock, isEnabled, isLocked, lock } = useAppLockStore();
  const { hydrated: onboardingHydrated, hydrate: hydrateOnboarding, hasCompletedOnboarding } = useOnboardingStore();
  const { hydrated: settingsHydrated, hydrate: hydrateSettings } = useSettingsStore();

  // Hydrate all stores on mount before any screen renders.
  // AppBootSplash is shown until all three resolve.
  useEffect(() => {
    hydrateLock();
    hydrateOnboarding();
    hydrateSettings();
  }, [hydrateLock, hydrateOnboarding, hydrateSettings]);

  const hydrated = lockHydrated && onboardingHydrated && settingsHydrated;

  // Lock app when it goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        lock();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [lock]);

  useEffect(() => {
    registerBackgroundBackupTask();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-white dark:bg-slate-950">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "transparent",
            },
          }}
        />

        {!hydrated && (
          <View className="absolute inset-0">
            <AppBootSplash />
          </View>
        )}

        {hydrated && !hasCompletedOnboarding && (
          <View className="absolute inset-0">
            <OnboardingScreen />
          </View>
        )}

        {hydrated && hasCompletedOnboarding && isEnabled && isLocked && (
          <View className="absolute inset-0">
            <LockScreen />
          </View>
        )}

        <AppToaster />
      </View>
    </GestureHandlerRootView>
  );
}
