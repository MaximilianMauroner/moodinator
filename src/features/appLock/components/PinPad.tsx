import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

type PinPadProps = {
  onDigitPress: (digit: string) => void;
  onDeletePress: () => void;
  disabled?: boolean;
};

const digits = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "delete"],
];

export function PinPad({ onDigitPress, onDeletePress, disabled }: PinPadProps) {
  const { isDark, get } = useThemeColors();

  const handlePress = (value: string) => {
    if (disabled) return;

    if (value === "delete") {
      haptics.light();
      onDeletePress();
    } else if (value) {
      haptics.pinDigit();
      onDigitPress(value);
    }
  };

  return (
    <View className="px-8">
      {digits.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row justify-center mb-4">
          {row.map((digit, digitIndex) => (
            <PinButton
              key={`${rowIndex}-${digitIndex}`}
              digit={digit}
              onPress={handlePress}
              disabled={disabled}
              isDark={isDark}
              surfaceColor={get("surface")}
              textColor={get("text")}
              mutedColor={get("textMuted")}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

type PinButtonProps = {
  digit: string;
  onPress: (digit: string) => void;
  disabled?: boolean;
  isDark: boolean;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
};

function PinButton({
  digit,
  onPress,
  disabled,
  isDark,
  surfaceColor,
  textColor,
  mutedColor,
}: PinButtonProps) {
  if (!digit) {
    return <View style={{ width: 80, height: 80, marginHorizontal: 12 }} />;
  }

  const isDelete = digit === "delete";

  return (
    <Pressable
      onPress={() => onPress(digit)}
      disabled={disabled}
      className="mx-3"
      style={({ pressed }) => ({
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: pressed
          ? isDark
            ? "rgba(91, 138, 91, 0.2)"
            : "rgba(91, 138, 91, 0.1)"
          : surfaceColor,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: isDark ? "#000" : "#9D8660",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.25 : 0.1,
        shadowRadius: 8,
        elevation: 3,
        opacity: disabled ? 0.5 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={isDelete ? "Delete" : digit}
    >
      {isDelete ? (
        <Ionicons name="backspace-outline" size={28} color={mutedColor} />
      ) : (
        <Text
          style={{
            fontSize: 32,
            fontWeight: "600",
            color: textColor,
          }}
        >
          {digit}
        </Text>
      )}
    </Pressable>
  );
}
