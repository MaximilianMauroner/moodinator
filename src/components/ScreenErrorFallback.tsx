import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useNavigation } from "expo-router";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { ErrorFallbackProps } from "./ErrorBoundary";

interface ScreenErrorFallbackProps extends ErrorFallbackProps {
  /** Optional screen title to display */
  screenTitle?: string;
}

/**
 * A reusable error fallback UI for screen-level errors.
 * Displays error information with retry and navigation options.
 */
export function ScreenErrorFallback({
  error,
  resetError,
  screenTitle,
}: ScreenErrorFallbackProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const navigation = useNavigation();

  const canGoBack = navigation.canGoBack();

  const handleGoBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDark ? "#1C1916" : "#FAF8F4",
      }}
    >
      <View className="flex-1 justify-center items-center p-8">
        <View
          className="w-full max-w-sm rounded-3xl p-6"
          style={{
            backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
            shadowColor: isDark ? "#000" : "#9D8660",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 24,
            elevation: 4,
          }}
        >
          {/* Error Icon */}
          <View
            className="w-16 h-16 rounded-2xl items-center justify-center self-center mb-4"
            style={{ backgroundColor: isDark ? "#3D2822" : "#FDE8E4" }}
          >
            <Text className="text-3xl">⚠️</Text>
          </View>

          {/* Title */}
          <Text
            className="text-xl font-bold text-center mb-2"
            style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
          >
            Something went wrong
          </Text>

          {/* Screen name if provided */}
          {screenTitle && (
            <Text
              className="text-sm text-center mb-3"
              style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
            >
              Error in {screenTitle}
            </Text>
          )}

          {/* Error message (dev only) */}
          {__DEV__ && (
            <View
              className="rounded-xl p-3 mb-4"
              style={{ backgroundColor: isDark ? "#2A2520" : "#F9F5ED" }}
            >
              <Text
                className="text-xs font-mono"
                style={{ color: isDark ? "#F5A899" : "#C75441" }}
                numberOfLines={4}
              >
                {error.message}
              </Text>
            </View>
          )}

          {/* Description */}
          <Text
            className="text-sm text-center mb-6 leading-5"
            style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
          >
            An unexpected error occurred. You can try again or go back to the previous screen.
          </Text>

          {/* Action Buttons */}
          <View className="gap-3">
            {/* Retry Button */}
            <Pressable
              onPress={resetError}
              className="rounded-2xl py-4 items-center"
              style={{
                backgroundColor: isDark ? "#5B8A5B" : "#5B8A5B",
                shadowColor: isDark ? "#000" : "#5B8A5B",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.3 : 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text className="text-base font-semibold text-white">
                Try Again
              </Text>
            </Pressable>

            {/* Go Back Button */}
            <Pressable
              onPress={handleGoBack}
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: isDark ? "#2A2520" : "#F5F1E8" }}
            >
              <Text
                className="text-base font-semibold"
                style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
              >
                {canGoBack ? "Go Back" : "Go Home"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * Creates a ScreenErrorFallback with a specific screen title.
 * Useful for wrapping screens with the ErrorBoundary component.
 */
export function createScreenErrorFallback(screenTitle: string) {
  return function BoundScreenErrorFallback(props: ErrorFallbackProps) {
    return <ScreenErrorFallback {...props} screenTitle={screenTitle} />;
  };
}

export default ScreenErrorFallback;
