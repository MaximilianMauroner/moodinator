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

const digitHints: Record<string, string> = {
  "1": "",
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
  "0": "+",
};

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
    <View className="px-5 mt-3">
      <View
        className="rounded-[28px] px-3 pt-4 pb-2"
        style={{
          backgroundColor: get("surfaceAlt"),
          borderColor: get("borderSubtle"),
          borderWidth: 1,
        }}
      >
        {digits.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row justify-center mb-3">
            {row.map((digit, digitIndex) => (
              <PinButton
                key={`${rowIndex}-${digitIndex}`}
                digit={digit}
                onPress={handlePress}
                disabled={disabled}
                isDark={isDark}
                surfaceColor={get("surfaceElevated")}
                textColor={get("text")}
                mutedColor={get("textMuted")}
                borderColor={get("borderSubtle")}
                primaryBgColor={get("primaryBg")}
              />
            ))}
          </View>
        ))}
      </View>
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
  borderColor: string;
  primaryBgColor: string;
};

function PinButton({
  digit,
  onPress,
  disabled,
  isDark,
  surfaceColor,
  textColor,
  mutedColor,
  borderColor,
  primaryBgColor,
}: PinButtonProps) {
  if (!digit) {
    return <View style={{ width: 94, height: 76, marginHorizontal: 5 }} />;
  }

  const isDelete = digit === "delete";
  const hint = digitHints[digit];

  return (
    <Pressable
      onPress={() => onPress(digit)}
      disabled={disabled}
      className="mx-[5px]"
      style={({ pressed }) => ({
        width: 94,
        height: 76,
        borderRadius: 24,
        backgroundColor: pressed ? primaryBgColor : surfaceColor,
        borderWidth: 1,
        borderColor: pressed ? (isDark ? "rgba(168, 197, 168, 0.35)" : "rgba(91, 138, 91, 0.22)") : borderColor,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: isDark ? "#000" : "#9D8660",
        shadowOffset: { width: 0, height: pressed ? 1 : 6 },
        shadowOpacity: isDark ? (pressed ? 0.2 : 0.35) : (pressed ? 0.08 : 0.14),
        shadowRadius: pressed ? 4 : 10,
        elevation: pressed ? 1 : 3,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        opacity: disabled ? 0.5 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={isDelete ? "Delete" : digit}
    >
      {isDelete ? (
        <View className="items-center">
          <Ionicons name="backspace-outline" size={22} color={mutedColor} />
          <Text
            className="mt-[1px] text-[10px] font-semibold tracking-[1px]"
            style={{ color: mutedColor }}
          >
            DEL
          </Text>
        </View>
      ) : (
        <View className="items-center">
          <Text
            style={{
              fontSize: 33,
              fontWeight: "600",
              lineHeight: 36,
              color: textColor,
            }}
          >
            {digit}
          </Text>
          {hint ? (
            <Text
              className="text-[10px] font-semibold tracking-[1.5px]"
              style={{ color: mutedColor }}
            >
              {hint}
            </Text>
          ) : (
            <View style={{ height: 12 }} />
          )}
        </View>
      )}
    </Pressable>
  );
}
