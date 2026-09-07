import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

type BiometricButtonProps = {
  onPress: () => void;
  label: string;
  icon: string;
  disabled?: boolean;
};

export function BiometricButton({ onPress, label, icon, disabled }: BiometricButtonProps) {
  const { isDark, get } = useThemeColors();
  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  return (
    <View>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className="items-center"
        style={({ pressed }) => ({
          opacity: pressed || disabled ? 0.7 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel={`Unlock with ${label}`}
        accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(disabled) }}
      >
        <View
          className="w-20 h-20 rounded-3xl items-center justify-center mb-4"
          style={{
            backgroundColor: isDark ? "rgba(91, 138, 91, 0.2)" : "rgba(91, 138, 91, 0.15)",
            shadowColor: isDark ? "#000" : "#5B8A5B",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.2,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={36}
            color={get("primary")}
          />
        </View>
        <Text
          className="text-base font-semibold"
          style={{ color: isDark ? get("primary") : "#476D47" }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
