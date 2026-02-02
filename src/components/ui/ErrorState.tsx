import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, colors } from "@/constants/colors";

interface ErrorStateProps {
  message: string;
  details?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Error state component with message, optional details, and retry button.
 * Uses the negative/coral color scheme from the theme.
 */
export function ErrorState({
  message,
  details,
  onRetry,
  retryLabel = "Try Again",
}: ErrorStateProps) {
  const { get, isDark } = useThemeColors();
  const errorBg = isDark ? colors.negative.bg.dark : colors.negative.bg.light;
  const errorText = isDark ? colors.negative.text.dark : colors.negative.text.light;
  const errorBgSelected = isDark ? colors.negative.bgSelected.dark : colors.negative.bgSelected.light;

  return (
    <View
      className="flex-1 items-center justify-center p-8"
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`Error: ${message}${details ? `. ${details}` : ""}`}
    >
      <View
        className="w-20 h-20 rounded-3xl items-center justify-center mb-5"
        style={{
          backgroundColor: errorBg,
          shadowColor: errorBgSelected,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        <Ionicons name="alert-circle-outline" size={40} color={errorText} />
      </View>

      <Text
        className="text-center font-semibold text-lg mb-2"
        style={{ color: errorText }}
      >
        {message}
      </Text>

      {details && (
        <Text
          className="text-center text-sm max-w-[250px] mb-4"
          style={{ color: get("textMuted") }}
        >
          {details}
        </Text>
      )}

      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="mt-4 px-6 py-3 rounded-xl flex-row items-center gap-2"
          style={{ backgroundColor: errorBgSelected }}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          accessibilityHint="Tap to retry the failed action"
        >
          <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
          <Text className="text-white font-semibold">{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default ErrorState;
