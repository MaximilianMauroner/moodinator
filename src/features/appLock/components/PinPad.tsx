import React from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
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
  const { get } = useThemeColors();
  const { height } = useWindowDimensions();
  const buttonSize = height < 700 ? 56 : 64;

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
    <View className="w-full max-w-[300px] self-center mt-4 px-2 gap-2">
      {digits.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row">
          {row.map((digit, digitIndex) => (
            <PinButton
              key={`${rowIndex}-${digitIndex}`}
              digit={digit}
              onPress={handlePress}
              disabled={disabled}
              textColor={get("text")}
              mutedColor={get("textMuted")}
              primaryBgColor={get("primaryBg")}
              size={buttonSize}
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
  textColor: string;
  mutedColor: string;
  primaryBgColor: string;
  size: number;
};

function PinButton({
  digit,
  onPress,
  disabled,
  textColor,
  mutedColor,
  primaryBgColor,
  size,
}: PinButtonProps) {
  if (!digit) {
    return <View className="flex-1" style={{ height: size }} importantForAccessibility="no" />;
  }

  const isDelete = digit === "delete";

  return (
    <View className="flex-1 items-center" style={{ height: size }}>
      <Pressable
        onPress={() => onPress(digit)}
        disabled={disabled}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityRole="button"
        accessibilityLabel={isDelete ? "Delete digit" : digit}
        accessibilityState={{ disabled: Boolean(disabled) }}
      >
        {({ pressed }) => (
          <View
            className="flex-1 rounded-full items-center justify-center"
            style={{
              backgroundColor: pressed ? primaryBgColor : "transparent",
              transform: [{ scale: pressed ? 0.94 : 1 }],
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {isDelete ? (
              <Ionicons name="backspace-outline" size={24} color={mutedColor} />
            ) : (
              <Text
                maxFontSizeMultiplier={1.35}
                style={{
                  fontSize: 28,
                  fontWeight: "600",
                  lineHeight: 32,
                  color: textColor,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {digit}
              </Text>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}
