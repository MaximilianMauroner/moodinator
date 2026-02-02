import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useThemeColors } from "@/constants/colors";

interface LoadingSpinnerProps {
  message?: string;
  size?: "small" | "large";
}

/**
 * Centered loading spinner with optional message.
 * Uses theme colors for consistent styling.
 */
export function LoadingSpinner({
  message,
  size = "large",
}: LoadingSpinnerProps) {
  const { get } = useThemeColors();

  return (
    <View
      className="flex-1 items-center justify-center p-8"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message || "Loading"}
    >
      <ActivityIndicator
        size={size}
        color={get("primary")}
      />
      {message && (
        <Text
          className="text-center mt-4"
          style={{ color: get("textMuted") }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

export default LoadingSpinner;
