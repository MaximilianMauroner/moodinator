import React, { useMemo, useCallback, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, {
    useSharedValue,
    withSpring,
    FadeIn,
} from "react-native-reanimated";
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

// ─── Animated emotion chip ──────────────────────────────────────────────────
interface EmotionChipProps {
    emotion: Emotion;
    isSelected: boolean;
    disabled: boolean;
    bgColor: string;
    borderColor: string;
    textColor: string;
    onPress: () => void;
}

const EmotionChip: React.FC<EmotionChipProps> = ({
    emotion,
    isSelected,
    disabled,
    bgColor,
    borderColor,
    textColor,
    onPress,
}) => {
    const scale = useSharedValue(isSelected ? 1.04 : 1);

    useEffect(() => {
        scale.value = withSpring(isSelected ? 1.04 : 1, {
            damping: 20,
            stiffness: 380,
            overshootClamping: true,
        });
    }, [isSelected]);

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                onPress={onPress}
                onPressIn={() => {
                    if (!disabled) scale.value = withSpring(0.93, { damping: 20, stiffness: 500 });
                }}
                onPressOut={() => {
                    scale.value = withSpring(isSelected ? 1.04 : 1, { damping: 18, stiffness: 380 });
                }}
                disabled={disabled}
                className="px-3 py-2 rounded-xl"
                style={{
                    backgroundColor: bgColor,
                    // Keep layout stable: borderWidth must NOT change on select.
                    borderWidth: 1,
                    borderColor,
                    opacity: disabled ? 0.28 : 1,
                    // Selection emphasis uses transform + shadow (no layout change)
                    shadowColor: isSelected ? textColor : "transparent",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isSelected ? 0.22 : 0,
                    shadowRadius: isSelected ? 6 : 0,
                    elevation: isSelected ? 2 : 0,
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={`${emotion.name}, ${
                    isSelected
                        ? "selected, tap to deselect"
                        : disabled
                        ? "unavailable, deselect one first"
                        : "tap to select"
                }`}
            >
                <Text className="text-sm font-medium" style={{ color: textColor }}>
                    {emotion.name}
                </Text>
            </Pressable>
        </Animated.View>
    );
};

// ─── Selected chip (in summary bar) ────────────────────────────────────────
const SelectedChip: React.FC<{
    emotion: Emotion;
    bgColor: string;
    textColor: string;
    onRemove: () => void;
}> = ({ emotion, bgColor, textColor, onRemove }) => {
    const scale = useSharedValue(0.8);

    useEffect(() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 300 });
    }, []);

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                onPress={onRemove}
                className="flex-row items-center px-2.5 py-1.5 rounded-full gap-1"
                style={{ backgroundColor: bgColor }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${emotion.name}`}
            >
                <Text className="text-xs font-semibold" style={{ color: textColor }}>
                    {emotion.name}
                </Text>
                <Text
                    className="text-sm"
                    style={{ color: textColor, opacity: 0.55, lineHeight: 14 }}
                >
                    ×
                </Text>
            </Pressable>
        </Animated.View>
    );
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
            {/* Selected summary — fixed-height, always present (no up/down coupling). */}
            <View
                className="mb-4"
                style={{
                    minHeight: 54,
                    paddingTop: 2,
                    paddingBottom: 2,
                }}
            >
                {selected.length > 0 ? (
                    <View style={{ flex: 1 }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                paddingVertical: 6,
                            }}
                        >
                            {selected.map((e) => {
                                const catColors = getCategoryColors(e.category, true);
                                return (
                                    <SelectedChip
                                        key={e.name}
                                        emotion={e}
                                        bgColor={catColors.bg}
                                        textColor={catColors.text}
                                        onRemove={() => toggle(e)}
                                    />
                                );
                            })}
                        </ScrollView>
                    </View>
                ) : (
                    <Animated.View
                        entering={FadeIn.duration(160)}
                        style={{
                            flex: 1,
                            justifyContent: "center",
                        }}
                    >
                        <Text
                            className="text-xs"
                            style={{
                                color: isDark ? "#6B5C48" : "#B0A090",
                                fontStyle: "italic",
                                opacity: 0.95,
                            }}
                        >
                            Pick up to {maxSelections}
                        </Text>
                    </Animated.View>
                )}

                {/* Hint is overlayed so it never changes layout */}
                {atLimit && (
                    <Animated.Text
                        entering={FadeIn.duration(160)}
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            fontSize: 12,
                            color: isDark ? "#8C7A60" : "#9D8660",
                            fontStyle: "italic",
                        }}
                    >
                        Tap any chip above to swap it out
                    </Animated.Text>
                )}
            </View>

            {/* Category groups — no layout animation (avoid “related” vertical movement). */}
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
                                const catColors = getCategoryColors(emotion.category, isSelected);

                                return (
                                    <EmotionChip
                                        key={emotion.name}
                                        emotion={emotion}
                                        isSelected={isSelected}
                                        disabled={disabled}
                                        bgColor={catColors.bg}
                                        borderColor={catColors.border ?? catColors.bg}
                                        textColor={catColors.text}
                                        onPress={() => toggle(emotion)}
                                    />
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
