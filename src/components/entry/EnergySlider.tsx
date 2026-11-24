import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
    FadeOut,
} from "react-native-reanimated";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/constants/colors";

interface EnergySliderProps {
    value: number | null;
    onChange: (value: number | null) => void;
    variant?: "default" | "compact";
    reducedMotion?: boolean;
}

export const ENERGY_LABELS: Record<number, string> = {
    0: "Drained",
    1: "Very low",
    2: "Low",
    3: "Below avg",
    4: "A bit low",
    5: "Neutral",
    6: "Average",
    7: "Above avg",
    8: "High",
    9: "Very high",
    10: "Wired",
};

const ENERGY_ROWS: readonly (readonly number[])[] = [
    [0, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
];

// ─── Individual animated segment ────────────────────────────────────────────
const EnergySegment: React.FC<{
    index: number;
    value: number | null;
    fillColor: string;
    emptyBg: string;
    emptyBorder: string;
    emptyText: string;
    selectedBorder: string;
    isDark: boolean;
    compact: boolean;
    reducedMotion: boolean;
    onPress: () => void;
}> = ({
    index,
    value,
    fillColor,
    emptyBg,
    emptyBorder,
    emptyText,
    selectedBorder,
    isDark,
    compact,
    reducedMotion,
    onPress,
}) => {
    const isFilled = value !== null && index <= value;
    const isSelected = value === index;

    const scale = useSharedValue(isSelected && !reducedMotion ? 1.05 : 1);

    useEffect(() => {
        if (reducedMotion) {
            scale.value = 1;
            return;
        }
        scale.value = withSpring(isSelected ? 1.06 : 1, {
            damping: 18,
            stiffness: 420,
            overshootClamping: true,
        });
    }, [isSelected, reducedMotion, scale]);

    const segmentAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const filledTextColor = isDark && index < 8 ? "#FFFFFF" : "#171410";

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => {
                if (!reducedMotion) {
                    scale.value = withSpring(0.93, { damping: 18, stiffness: 500 });
                }
            }}
            onPressOut={() => {
                if (!reducedMotion) {
                    scale.value = withSpring(isSelected ? 1.06 : 1, {
                        damping: 16,
                        stiffness: 380,
                    });
                }
            }}
            testID={`energy-level-${index}`}
            style={{
                flex: 1,
                minWidth: 0,
                minHeight: compact ? 44 : 48,
                justifyContent: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel={`Energy level ${index}: ${ENERGY_LABELS[index]}`}
            accessibilityState={{ selected: isSelected }}
        >
            <Animated.View
                style={[
                    {
                        height: compact ? 36 : 38,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isFilled ? fillColor : emptyBg,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected
                            ? selectedBorder
                            : isFilled
                              ? fillColor
                              : emptyBorder,
                        shadowColor: isSelected ? fillColor : "transparent",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isSelected ? (isDark ? 0.35 : 0.25) : 0,
                        shadowRadius: 4,
                        elevation: isSelected ? 2 : 0,
                    },
                    segmentAnimatedStyle,
                ]}
            >
                <Text
                    maxFontSizeMultiplier={1.3}
                    style={{
                        fontSize: compact ? 13 : 14,
                        fontVariant: ["tabular-nums"],
                        color: isFilled ? filledTextColor : emptyText,
                        fontWeight: isSelected ? "700" : isFilled ? "600" : "500",
                    }}
                >
                    {index}
                </Text>
            </Animated.View>
        </Pressable>
    );
};

export const EnergySlider: React.FC<EnergySliderProps> = ({
    value,
    onChange,
    variant = "default",
    reducedMotion = false,
}) => {
    const { isDark, get, colors } = useThemeColors();
    const compact = variant === "compact";
    const fillColors = isDark
        ? colors.energySegmentColors.dark
        : colors.energySegmentColors.light;
    const emptyBg = isDark ? colors.surfaceAlt.dark : colors.sand.bg.light;
    const emptyBorder = isDark ? colors.border.dark : colors.sand.border.light;
    const emptyText = get("textMuted");
    const selectedBorder = get("text");

    return (
        <View>
            {/* Two balanced rows (0–5 and 6–10) keep every level visible and thumb-friendly without an orphan row. */}
            <View className={compact ? "mb-1.5 gap-1" : "mb-2 gap-1.5"}>
                {ENERGY_ROWS.map((row) => (
                    <View key={row[0]} className="flex-row gap-1.5">
                        {row.map((index) => (
                            <EnergySegment
                                key={index}
                                index={index}
                                value={value}
                                fillColor={fillColors[index]}
                                emptyBg={emptyBg}
                                emptyBorder={emptyBorder}
                                emptyText={emptyText}
                                selectedBorder={selectedBorder}
                                isDark={isDark}
                                compact={compact}
                                reducedMotion={reducedMotion}
                                onPress={() => {
                                    haptics.tick();
                                    onChange(value === index ? null : index);
                                }}
                            />
                        ))}
                    </View>
                ))}
            </View>

            {/* Scale labels + current value */}
            <View className={`flex-row items-center justify-between px-0.5 ${compact ? "" : "mb-2"}`}>
                <Text
                    style={{
                        fontSize: 12,
                        color: get("textSubtle"),
                        fontWeight: "500",
                    }}
                >
                    Drained
                </Text>

                {value !== null ? (
                    <Animated.Text
                        key={value}
                        entering={reducedMotion ? undefined : FadeIn.duration(160)}
                        style={{
                            fontSize: 12,
                            fontWeight: "600",
                            fontVariant: ["tabular-nums"],
                            color: get("text"),
                        }}
                    >
                        {ENERGY_LABELS[value]} · {value}/10
                    </Animated.Text>
                ) : (
                    <Text
                        style={{
                            fontSize: 12,
                            color: get("textSubtle"),
                        }}
                    >
                        Tap a level
                    </Text>
                )}

                <Text
                    style={{
                        fontSize: 12,
                        color: get("textSubtle"),
                        fontWeight: "500",
                    }}
                >
                    Wired
                </Text>
            </View>

            {/* Clear (in default modal variant; compact variant renders Clear in its header) */}
            {!compact && value !== null && (
                <Animated.View
                    entering={reducedMotion ? undefined : FadeIn.duration(160)}
                    exiting={reducedMotion ? undefined : FadeOut.duration(120)}
                >
                    <Pressable
                        testID="energy-clear"
                        onPress={() => {
                            haptics.tick();
                            onChange(null);
                        }}
                        className="min-h-12 min-w-12 justify-center self-center px-4 py-1.5 rounded-full"
                        style={{
                            backgroundColor: get("surfaceAlt"),
                            borderWidth: 1,
                            borderColor: get("border"),
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Clear energy level"
                    >
                        <Text
                            style={{
                                fontSize: 12,
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
