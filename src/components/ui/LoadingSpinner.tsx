import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useThemeColors } from "@/constants/colors";
import { SurfaceCard } from "./SurfaceCard";
import { IconBadge } from "./IconBadge";
import { typography } from "@/constants/typography";

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
      <SurfaceCard tone="sage" style={{ width: "100%", maxWidth: 280 }}>
        <View className="items-center">
          <IconBadge icon="hourglass-outline" tone="sage" size="lg" />
          <ActivityIndicator
            size={size}
            color={get("primary")}
            style={{ marginTop: 12 }}
          />
          {message && (
            <Text
              className="text-center mt-4"
              style={[typography.bodyMd, { color: get("textMuted") }]}
            >
              {message}
            </Text>
          )}
        </View>
      </SurfaceCard>
    </View>
  );
}

export default LoadingSpinner;
