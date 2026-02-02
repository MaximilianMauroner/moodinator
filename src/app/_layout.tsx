import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Stack } from "expo-router";
// import { registerBackgroundBackupTask } from "@db/backgroundBackup";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import "./global.css";

// Import backgroundBackup at module level to ensure task is defined before registration
// Temporarily disabled due to expo-task-manager compatibility issue with New Architecture
// import "@db/backgroundBackup";

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

export default function Layout() {
  useEffect(() => {
    // Background backup temporarily disabled due to expo-task-manager compatibility issue
    // TODO: Re-enable when expo-background-task supports New Architecture
    // registerBackgroundBackupTask();
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
