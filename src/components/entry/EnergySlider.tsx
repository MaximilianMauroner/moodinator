import React from "react";
import { View, Text, Pressable } from "react-native";
import { useThemeColors } from "@/constants/colors";

interface EnergySliderProps {
    value: number | null;
    onChange: (value: number | null) => void;
}

const ENERGY_LABELS: Record<number, string> = {
    0: "Drained",
    1: "Very low",
    2: "Low",
    3: "Below avg",
    4: "A bit low",
    5: "Moderate",
    6: "Average",
    7: "Above avg",
    8: "High",
    9: "Very high",
    10: "Wired",
};

// Segment fill colors — cool-to-warm gradient across the energy range
const FILL_COLORS_LIGHT = [
    "#B8CDD5", // 0 drained — cool muted blue
    "#AECAD3",
    "#A8C5D0",
    "#B8C8BA", // 3 — starts warming
    "#C8BFA0",
    "#BDA77D", // 5 moderate — sand
    "#D4A574",
    "#E09B5A", // 7
    "#E08860",
    "#D47845",
    "#C47040", // 10 wired — warm amber
];

const FILL_COLORS_DARK = [
    "#2D4855",
    "#2A4552",
    "#284250",
    "#3D3D2A",
    "#4D3D22",
    "#5C4228",
    "#6B4A28",
    "#7A5030",
    "#855535",
    "#8A5030",
    "#7D4528",
];

export const EnergySlider: React.FC<EnergySliderProps> = ({ value, onChange }) => {
    const { isDark, get } = useThemeColors();
    const fillColors = isDark ? FILL_COLORS_DARK : FILL_COLORS_LIGHT;

    return (
        <View>
            {/* Segmented bar */}
            <View className="flex-row gap-1 mb-2">
                {Array.from({ length: 11 }, (_, i) => {
                    const isFilled = value !== null && i <= value;
                    const isSelected = value === i;

                    return (
                        <Pressable
                            key={i}
                            onPress={() => onChange(value === i ? null : i)}
                            className="flex-1 rounded items-center justify-center"
                            style={{
                                height: 32,
                                backgroundColor: isFilled
                                    ? fillColors[i]
                                    : isDark
                                    ? "rgba(61, 53, 42, 0.25)"
                                    : "rgba(229, 217, 191, 0.25)",
                                borderWidth: isSelected ? 2 : 0,
                                borderColor: isSelected ? fillColors[i] : "transparent",
                                // Selected segment slightly taller for emphasis
                                transform: [{ scaleY: isSelected ? 1.12 : 1 }],
                                shadowColor: isSelected ? fillColors[i] : "transparent",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: isDark ? 0.4 : 0.3,
                                shadowRadius: 4,
                                elevation: isSelected ? 3 : 0,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Energy level ${i}: ${ENERGY_LABELS[i]}`}
                            accessibilityState={{ selected: isSelected }}
                        />
                    );
                })}
            </View>

            {/* Scale labels + current value */}
            <View className="flex-row items-center justify-between px-0.5 mb-2">
                <Text
                    style={{
                        fontSize: 10,
                        color: isDark ? "#5C4E3D" : "#B0A090",
                        fontWeight: "500",
                    }}
                >
                    Drained
                </Text>

                {value !== null ? (
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: fillColors[value],
                        }}
                    >
                        {ENERGY_LABELS[value]} · {value}/10
                    </Text>
                ) : (
                    <Text
                        style={{
                            fontSize: 11,
                            color: isDark ? "#4D453A" : "#C0B090",
                            fontStyle: "italic",
                        }}
                    >
                        tap to set
                    </Text>
                )}

                <Text
                    style={{
                        fontSize: 10,
                        color: isDark ? "#5C4E3D" : "#B0A090",
                        fontWeight: "500",
                    }}
                >
                    Wired
                </Text>
            </View>

            {/* Clear */}
            {value !== null && (
                <Pressable
                    onPress={() => onChange(null)}
                    className="self-center px-4 py-1.5 rounded-full"
                    style={{
                        backgroundColor: isDark
                            ? "rgba(42, 37, 32, 0.6)"
                            : "rgba(245, 241, 232, 0.9)",
                        borderWidth: 1,
                        borderColor: isDark
                            ? "rgba(61, 53, 42, 0.4)"
                            : "rgba(229, 217, 191, 0.7)",
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear energy level"
                >
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "500",
                            color: get("textMuted"),
                        }}
                    >
                        Clear
                    </Text>
                </Pressable>
            )}
        </View>
    );
};

export default EnergySlider;
