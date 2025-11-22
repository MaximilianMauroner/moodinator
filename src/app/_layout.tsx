import React, { useEffect } from "react";
import { View, AppState, AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { scheduleWeeklyBackup, checkScheduledBackup } from "@db/backup";

import "./global.css";

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
    // Provide a dark-aware background across the entire app so transparent screens/blur bars look correct
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
  );
}
