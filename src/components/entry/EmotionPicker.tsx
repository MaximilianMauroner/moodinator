import React, { useMemo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useThemeColors } from "@/constants/colors";
import type { Emotion } from "@db/types";

interface EmotionPickerProps {
    options: Emotion[];
    selected: Emotion[];
    onChange: (emotions: Emotion[]) => void;
    maxSelections?: number;
}

const CATEGORY_ORDER = ["positive", "negative", "neutral"] as const;
type EmotionCategory = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<EmotionCategory, string> = {
    positive: "Positive",
    negative: "Negative",
    neutral: "Neutral",
};

export const EmotionPicker: React.FC<EmotionPickerProps> = ({
    options,
    selected,
    onChange,
    maxSelections = 3,
}) => {
    const { isDark, getCategoryColors } = useThemeColors();

    const selectedNames = useMemo(
        () => new Set(selected.map((e) => e.name)),
        [selected]
    );
    const atLimit = selected.length >= maxSelections;

    const grouped = useMemo(() => {
        const map: Record<EmotionCategory, Emotion[]> = {
            positive: [],
            negative: [],
            neutral: [],
        };
        for (const emotion of options) {
            const cat = (emotion.category as EmotionCategory) ?? "neutral";
            if (cat in map) map[cat].push(emotion);
        }
        for (const cat of CATEGORY_ORDER) {
            map[cat].sort((a, b) => a.name.localeCompare(b.name));
        }
        return map;
    }, [options]);

    const toggle = useCallback(
        (emotion: Emotion) => {
            const isSelected = selectedNames.has(emotion.name);
            if (isSelected) {
                onChange(selected.filter((e) => e.name !== emotion.name));
            } else if (!atLimit) {
                onChange([...selected, emotion]);
            }
        },
        [selectedNames, atLimit, selected, onChange]
    );

    return (
        <View>
            {/* Selected summary */}
            {selected.length > 0 && (
                <View className="mb-4">
                    <View className="flex-row items-center flex-wrap gap-2 mb-1.5">
                        {selected.map((e) => {
                            const catColors = getCategoryColors(e.category, true);
                            return (
                                <Pressable
                                    key={e.name}
                                    onPress={() => toggle(e)}
                                    className="flex-row items-center px-2.5 py-1.5 rounded-full gap-1"
                                    style={{ backgroundColor: catColors.bg }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remove ${e.name}`}
                                >
                                    <Text
                                        className="text-xs font-semibold"
                                        style={{ color: catColors.text }}
                                    >
                                        {e.name}
                                    </Text>
                                    <Text
                                        className="text-sm"
                                        style={{ color: catColors.text, opacity: 0.55, lineHeight: 14 }}
                                    >
                                        ×
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    {atLimit && (
                        <Text
                            className="text-xs"
                            style={{
                                color: isDark ? "#8C7A60" : "#9D8660",
                                fontStyle: "italic",
                            }}
                        >
                            Tap any chip above to swap it out
                        </Text>
                    )}
                </View>
            )}

            {/* Category groups */}
            {CATEGORY_ORDER.map((cat) => {
                const list = grouped[cat];
                if (!list.length) return null;

                return (
                    <View key={cat} className="mb-4">
                        {/* Category header */}
                        <View
                            className="flex-row items-center mb-2.5 gap-2"
                            style={{
                                borderBottomWidth: 1,
                                borderBottomColor: isDark
                                    ? "rgba(61, 53, 42, 0.25)"
                                    : "rgba(229, 217, 191, 0.5)",
                                paddingBottom: 5,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    letterSpacing: 1.2,
                                    textTransform: "uppercase",
                                    color: isDark ? "#5C4E3D" : "#B0A090",
                                }}
                            >
                                {CATEGORY_LABELS[cat]}
                            </Text>
                        </View>

                        {/* Chips */}
                        <View className="flex-row flex-wrap gap-2">
                            {list.map((emotion) => {
                                const isSelected = selectedNames.has(emotion.name);
                                const disabled = !isSelected && atLimit;
                                const catColors = getCategoryColors(
                                    emotion.category,
                                    isSelected
                                );

                                return (
                                    <Pressable
                                        key={emotion.name}
                                        onPress={() => toggle(emotion)}
                                        disabled={disabled}
                                        className="px-3 py-2 rounded-xl"
                                        style={{
                                            backgroundColor: catColors.bg,
                                            borderWidth: isSelected ? 1.5 : 1,
                                            borderColor: catColors.border ?? catColors.bg,
                                            opacity: disabled ? 0.28 : 1,
                                            transform: [{ scale: isSelected ? 1.04 : 1 }],
                                            shadowColor:
                                                isSelected && !isDark
                                                    ? catColors.text
                                                    : "transparent",
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 4,
                                            elevation: isSelected ? 2 : 0,
                                        }}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected: isSelected,
                                            disabled,
                                        }}
                                        accessibilityLabel={`${emotion.name}, ${
                                            isSelected
                                                ? "selected, tap to deselect"
                                                : disabled
                                                ? "unavailable, deselect one first"
                                                : "tap to select"
                                        }`}
                                    >
                                        <Text
                                            className="text-sm font-medium"
                                            style={{ color: catColors.text }}
                                        >
                                            {emotion.name}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

export default EmotionPicker;
