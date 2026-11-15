import React from "react";
import { Pressable, Text } from "react-native";
import { useThemeColors } from "@/constants/colors";
import { typography } from "@/constants/typography";

type Props = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function CheckInChip({
  label,
  selected = false,
  disabled = false,
  onPress,
}: Props) {
  const { get } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      className="justify-center rounded-xl px-3"
      style={{
        minHeight: 44,
        borderWidth: 1,
        borderColor: get(selected ? "primary" : "border"),
        backgroundColor: get(selected ? "primaryBg" : "surfaceAlt"),
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Text
        style={[
          typography.bodySm,
          { color: get("text"), fontWeight: selected ? "700" : "400" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
