import React, { useEffect } from "react";
import { View, Text, AppState, AppStateStatus, Pressable } from "react-native";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { scheduleWeeklyBackup, checkScheduledBackup } from "@db/backup";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import "./global.css";

/**
 * Root-level error fallback for critical app errors.
 */
function RootErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <View className="flex-1 bg-white dark:bg-slate-950 justify-center items-center p-8">
      <View className="w-20 h-20 rounded-3xl items-center justify-center mb-5 bg-red-100 dark:bg-red-900/20">
        <Text className="text-4xl">⚠️</Text>
      </View>
      <Text className="text-xl font-bold text-center mb-2 text-slate-900 dark:text-slate-100">
        App Error
      </Text>
      <Text className="text-sm text-center mb-6 text-slate-600 dark:text-slate-400">
        Something went wrong. Please try restarting the app.
      </Text>
      {__DEV__ && (
        <Text className="text-xs text-center mb-4 text-red-600 dark:text-red-400 font-mono">
          {error.message}
        </Text>
      )}
      <Pressable
        onPress={resetError}
        className="bg-blue-600 rounded-xl py-3 px-8"
      >
        <Text className="text-white font-semibold">Try Again</Text>
      </Pressable>
    </View>
  );
}

// Note: Notification handler is configured in useNotifications.ts
// Backup notifications are configured to be silent (sound: false, no alert)

export default function Layout() {
  useEffect(() => {
    // Initialize weekly backup schedule
    scheduleWeeklyBackup();

    // Check for scheduled backup when app becomes active
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          // App has come to the foreground, check if scheduled backup is needed
          checkScheduledBackup();
        }
      }
    );

    // Also listen for notification responses (when user taps notification)
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const notificationType = response.notification.request.content.data?.type;
        if (notificationType === "weekly-backup") {
          // Perform backup when notification is received
          checkScheduledBackup();
        }
      }
    );

    return () => {
      subscription.remove();
      notificationSubscription.remove();
    };
  }, []);

  return (
    <ErrorBoundary FallbackComponent={RootErrorFallback}>
      {/* Provide a dark-aware background across the entire app so transparent screens/blur bars look correct */}
      <View className="flex-1 bg-white dark:bg-slate-950">
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "transparent",
            },
          }}
        />
      </View>
    </ErrorBoundary>
  );
}
