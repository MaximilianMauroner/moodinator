import React, { useCallback, useEffect, useState } from "react";
import { View, Text, AppState, AppStateStatus, ActivityIndicator, Pressable } from "react-native";
import { Stack, useNavigationContainerRef, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { registerBackgroundBackupTask } from "@db/backgroundBackup";
import { LockScreen, useAppLockStore } from "@/features/appLock";
import { OnboardingScreen, useOnboardingStore } from "@/features/onboarding";
import { AppToaster } from "@/components/ui/AppToaster";
import { AppAlertProvider } from "@/components/ui/AppAlert";
import { useSettingsStore } from "@/shared/state/settingsStore";
import { runAppBootstrap, type AppBootstrapStatus } from "@/services/bootstrapService";
import {
  startPendingReminderNavigation,
  useNotifications,
} from "@/hooks/useNotifications";

import "./global.css";

function AppBootSplash() {
  return (
    <View className="flex-1 bg-paper-100 dark:bg-paper-900 justify-center items-center px-8">
      <View className="w-20 h-20 rounded-3xl items-center justify-center mb-5 bg-sage-100 dark:bg-sage-600/20">
        <Ionicons name="leaf-outline" size={36} color="#5B8A5B" />
      </View>
      <Text className="text-2xl font-bold text-paper-800 dark:text-paper-100 mb-2">
        Moodinator
      </Text>
      <Text className="text-sm text-paper-700 dark:text-sand-400 mb-5 text-center">
        Preparing your private space...
      </Text>
      <ActivityIndicator size="small" color="#5B8A5B" />
    </View>
  );
}

function AppLockRecovery({ retry }: { retry: () => void }) {
  return (
    <View
      accessibilityViewIsModal
      className="flex-1 bg-paper-100 dark:bg-paper-900 justify-center items-center px-8"
    >
      <View className="w-16 h-16 rounded-2xl items-center justify-center mb-5 bg-coral-100 dark:bg-coral-600/20">
        <Ionicons name="warning-outline" size={30} color="#C75441" />
      </View>
      <Text accessibilityRole="header" className="text-xl font-bold text-paper-800 dark:text-paper-100 text-center">
        App lock needs attention
      </Text>
      <Text className="text-sm text-paper-700 dark:text-paper-300 mt-2 mb-5 text-center">
        Moodinator could not safely read your security settings. Your private content remains hidden.
      </Text>
      <Pressable
        onPress={retry}
        className="min-h-11 px-6 rounded-xl items-center justify-center bg-sage-600 dark:bg-sage-400"
        accessibilityRole="button"
        accessibilityLabel="Retry loading app lock settings"
      >
        <Text className="font-semibold text-white dark:text-paper-900">Try again</Text>
      </Pressable>
    </View>
  );
}

export default function Layout() {
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const [bootstrapStatus, setBootstrapStatus] =
    useState<AppBootstrapStatus>("running");
  const [hasPendingReminderNavigation, setHasPendingReminderNavigation] =
    useState(false);
  const {
    hydrated: lockHydrated,
    hydrationError: lockHydrationError,
    hydrate: hydrateLock,
    isEnabled,
    isLocked,
    lock,
  } = useAppLockStore();
  const { hydrated: onboardingHydrated, hydrate: hydrateOnboarding, hasCompletedOnboarding } = useOnboardingStore();
  const { hydrated: settingsHydrated, hydrate: hydrateSettings } = useSettingsStore();
  const handleMoodReminderResponse = useCallback(() => {
    setHasPendingReminderNavigation(true);
  }, []);
  useNotifications(handleMoodReminderResponse);

  // Hydrate all stores on mount before any screen renders.
  // AppBootSplash is shown until all three resolve.
  useEffect(() => {
    hydrateLock();
    hydrateOnboarding();
    hydrateSettings();
  }, [hydrateLock, hydrateOnboarding, hydrateSettings]);

  const hydrated =
    lockHydrated && onboardingHydrated && settingsHydrated && bootstrapStatus !== "running";
  const showLockScreen =
    hydrated && !lockHydrationError && hasCompletedOnboarding && isEnabled && isLocked;
  const shouldMountNavigator = hydrated && !lockHydrationError && hasCompletedOnboarding;
  const blocksNavigator = !hydrated || Boolean(lockHydrationError) || !hasCompletedOnboarding || showLockScreen;

  useEffect(() => {
    if (!hasPendingReminderNavigation || !shouldMountNavigator || blocksNavigator) {
      return;
    }

    return startPendingReminderNavigation({
      isReady: () => navigationRef.isReady(),
      subscribeToState: (listener) => navigationRef.addListener("state", listener),
      navigate: () => {
        router.replace("/");
        setHasPendingReminderNavigation(false);
      },
    });
  }, [
    blocksNavigator,
    hasPendingReminderNavigation,
    navigationRef,
    router,
    shouldMountNavigator,
  ]);

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

  useEffect(() => {
    let isMounted = true;

    runAppBootstrap()
      .then((result) => {
        if (isMounted) {
          setBootstrapStatus(result.status);
        }
      })
      .catch((error) => {
        console.error("[layout] Failed to run app bootstrap:", error);
        if (isMounted) {
          setBootstrapStatus("ready-with-warning");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-paper-100 dark:bg-paper-900">
        <View
          className="flex-1"
          style={blocksNavigator ? { display: "none" } : undefined}
          accessibilityElementsHidden={blocksNavigator}
          importantForAccessibility={blocksNavigator ? "no-hide-descendants" : "auto"}
        >
          {shouldMountNavigator && (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: "transparent",
                },
              }}
            />
          )}
        </View>

        {!hydrated && !lockHydrationError && (
          <View className="absolute inset-0">
            <AppBootSplash />
          </View>
        )}

        {hydrated && !lockHydrationError && !hasCompletedOnboarding && (
          <View className="absolute inset-0">
            <OnboardingScreen />
          </View>
        )}

        {showLockScreen && (
          <View className="absolute inset-0">
            <LockScreen />
          </View>
        )}

        {lockHydrationError && (
          <View className="absolute inset-0">
            <AppLockRecovery retry={() => void hydrateLock()} />
          </View>
        )}

        {!blocksNavigator && <AppToaster />}
        {!blocksNavigator && <AppAlertProvider />}
      </View>
    </GestureHandlerRootView>
  );
}
