import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
    FadeOut,
} from "react-native-reanimated";
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

const FILL_COLORS_LIGHT = [
    "#B8CDD5",
    "#AECAD3",
    "#A8C5D0",
    "#B8C8BA",
    "#C8BFA0",
    "#BDA77D",
    "#D4A574",
    "#E09B5A",
    "#E08860",
    "#D47845",
    "#C47040",
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

// ─── Individual animated segment ────────────────────────────────────────────
const EnergySegment: React.FC<{
    index: number;
    value: number | null;
    fillColor: string;
    emptyColorDark: string;
    emptyColorLight: string;
    isDark: boolean;
    onPress: () => void;
}> = ({ index, value, fillColor, emptyColorDark, emptyColorLight, isDark, onPress }) => {
    const isFilled = value !== null && index <= value;
    const isSelected = value === index;

    const scaleY = useSharedValue(isSelected ? 1.12 : 1);

    useEffect(() => {
        scaleY.value = withSpring(isSelected ? 1.15 : 1, {
            damping: 16,
            stiffness: 420,
            overshootClamping: true,
        });
    }, [isSelected]);

    const segmentAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scaleY: scaleY.value }],
    }));

    return (
        <Animated.View
            style={[
                {
                    flex: 1,
                    height: 32,
                    borderRadius: 4,
                    backgroundColor: isFilled
                        ? fillColor
                        : isDark
                        ? emptyColorDark
                        : emptyColorLight,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: isSelected ? fillColor : "transparent",
                    shadowColor: isSelected ? fillColor : "transparent",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.4 : 0.3,
                    shadowRadius: 4,
                    elevation: isSelected ? 3 : 0,
                },
                segmentAnimatedStyle,
            ]}
        >
            <Pressable
                onPress={onPress}
                onPressIn={() => {
                    scaleY.value = withSpring(0.9, { damping: 18, stiffness: 500 });
                }}
                onPressOut={() => {
                    scaleY.value = withSpring(isSelected ? 1.15 : 1, { damping: 14, stiffness: 380 });
                }}
                style={{ flex: 1 }}
                accessibilityRole="button"
                accessibilityLabel={`Energy level ${index}: ${ENERGY_LABELS[index]}`}
                accessibilityState={{ selected: isSelected }}
            />
        </Animated.View>
    );
};

export const EnergySlider: React.FC<EnergySliderProps> = ({ value, onChange }) => {
    const { isDark, get } = useThemeColors();
    const fillColors = isDark ? FILL_COLORS_DARK : FILL_COLORS_LIGHT;

    return (
        <View>
            {/* Segmented bar */}
            <View className="flex-row gap-1 mb-2">
                {Array.from({ length: 11 }, (_, i) => (
                    <EnergySegment
                        key={i}
                        index={i}
                        value={value}
                        fillColor={fillColors[i]}
                        emptyColorDark="rgba(61, 53, 42, 0.25)"
                        emptyColorLight="rgba(229, 217, 191, 0.25)"
                        isDark={isDark}
                        onPress={() => onChange(value === i ? null : i)}
                    />
                ))}
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
                    <Animated.Text
                        key={value}
                        entering={FadeIn.duration(160)}
                        style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: fillColors[value],
                        }}
                    >
                        {ENERGY_LABELS[value]} · {value}/10
                    </Animated.Text>
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
                <Animated.View
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(120)}
                >
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
                </Animated.View>
            )}
        </View>
    );
};

export default EnergySlider;
