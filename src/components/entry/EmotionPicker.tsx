import React, { useMemo, useCallback, useEffect } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import {
    EMOTION_ENERGY_BAND_LABELS,
    EMOTION_ENERGY_BAND_ORDER,
    getEmotionEnergyBand,
    type EmotionEnergyBand,
} from "@/lib/entrySettings";
import type { Emotion } from "@db/types";

interface EmotionPickerProps {
    options: Emotion[];
    selected: Emotion[];
    onChange: (emotions: Emotion[]) => void;
    maxSelections?: number;
}

// Chips are drawn at 36 and the press target is extended to 48 with hitSlop, so
// the layout stays dense without shrinking the touch area. The 6dp of slop stays
// inside the 8dp row gap, so neighbouring targets never overlap.
const CHIP_HEIGHT = 36;
const CHIP_HIT_SLOP = { top: 6, bottom: 6, left: 3, right: 3 };
const DISABLED_OPACITY = 0.28;

// Emotions without an arousal rating (every custom emotion) keep their own group
// at the end rather than being filed under an activation level nobody chose.
const UNRATED = "unrated" as const;
type EmotionGroup = EmotionEnergyBand | typeof UNRATED;

const GROUP_LABELS: Record<EmotionGroup, string> = {
    ...EMOTION_ENERGY_BAND_LABELS,
    [UNRATED]: "Your own",
};

// Bar heights for the small activation meter beside each band label.
const GROUP_BARS: Record<EmotionGroup, number> = {
    high: 3,
    steady: 2,
    low: 1,
    [UNRATED]: 0,
};

const GROUP_ORDER: readonly EmotionGroup[] = [
    ...EMOTION_ENERGY_BAND_ORDER,
    UNRATED,
];

// ─── Activation meter ───────────────────────────────────────────────────────
const BandMeter: React.FC<{ filled: number; color: string; dimColor: string }> = ({
    filled,
    color,
    dimColor,
}) => (
    <View className="flex-row items-end gap-0.5" accessible={false}>
        {[1, 2, 3].map((step) => (
            <View
                key={step}
                style={{
                    width: 3,
                    height: 4 + step * 3,
                    borderRadius: 1,
                    backgroundColor: step <= filled ? color : dimColor,
                }}
            />
        ))}
    </View>
);

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
    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withSpring(1, {
            damping: 20,
            stiffness: 380,
            overshootClamping: true,
        });
    }, [scale]);

    const chipAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={chipAnimatedStyle}>
            <Pressable
                onPress={onPress}
                onPressIn={() => {
                    if (!disabled) scale.value = withSpring(0.93, { damping: 20, stiffness: 500 });
                }}
                onPressOut={() => {
                    scale.value = withSpring(1, { damping: 18, stiffness: 380 });
                }}
                disabled={disabled}
                hitSlop={CHIP_HIT_SLOP}
                testID={`emotion-option-${emotion.name}`}
                className="justify-center px-3 rounded-[10px]"
                style={{
                    minHeight: CHIP_HEIGHT,
                    backgroundColor: bgColor,
                    // Keep layout stable: borderWidth must NOT change on select.
                    borderWidth: 1,
                    borderColor,
                    opacity: disabled ? DISABLED_OPACITY : 1,
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
                <Ionicons
                    name="checkmark-circle"
                    size={13}
                    color={textColor}
                    accessible={false}
                    style={{
                        position: "absolute",
                        right: -4,
                        top: -4,
                        opacity: isSelected ? 1 : 0,
                    }}
                />
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
        scale.value = withSpring(1, { damping: 22, stiffness: 320, overshootClamping: true });
    }, [scale]);

    const selectedChipAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={selectedChipAnimatedStyle}>
            <Pressable
                onPress={onRemove}
                hitSlop={CHIP_HIT_SLOP}
                testID={`emotion-remove-${emotion.name}`}
                className="flex-row items-center justify-center px-2.5 rounded-[9px] gap-1.5"
                style={{ minHeight: 28, backgroundColor: bgColor }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${emotion.name}`}
            >
                <Text className="text-xs font-semibold" style={{ color: textColor }}>
                    {emotion.name}
                </Text>
                <Text
                    className="text-sm"
                    style={{ color: textColor, lineHeight: 14 }}
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

    const labelColor = isDark ? "#9EB894" : "#7A6B55";
    const meterDimColor = isDark ? "rgba(158, 184, 148, 0.28)" : "rgba(122, 107, 85, 0.25)";
    const ruleColor = isDark ? "rgba(61, 53, 42, 0.25)" : "rgba(229, 217, 191, 0.5)";

    const grouped = useMemo(() => {
        const map: Record<EmotionGroup, Emotion[]> = {
            high: [],
            steady: [],
            low: [],
            [UNRATED]: [],
        };
        for (const emotion of options) {
            map[getEmotionEnergyBand(emotion.name) ?? UNRATED].push(emotion);
        }
        for (const group of GROUP_ORDER) {
            map[group].sort((a, b) => a.name.localeCompare(b.name));
        }
        return map;
    }, [options]);

    const toggle = useCallback(
        (emotion: Emotion) => {
            const isSelected = selectedNames.has(emotion.name);
            if (isSelected) {
                haptics.tick();
                onChange(selected.filter((e) => e.name !== emotion.name));
            } else if (!atLimit) {
                haptics.tick();
                onChange([...selected, emotion]);
            }
        },
        [selectedNames, atLimit, selected, onChange]
    );

    const renderEmotionChip = (emotion: Emotion) => {
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
    };

    return (
        <View>
            {/* Selected summary. Fixed height so the grid never shifts when the
                selection changes, but only one row tall. */}
            <View style={{ height: 34, justifyContent: "center" }}>
                {selected.length > 0 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
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
                ) : (
                    <Animated.View entering={FadeIn.duration(160)}>
                        <Text
                            className="text-xs"
                            style={{
                                color: labelColor,
                                fontStyle: "italic",
                                opacity: 0.95,
                            }}
                        >
                            Pick up to {maxSelections}
                        </Text>
                    </Animated.View>
                )}
            </View>

            {/* Reserved line, so reaching the limit never shifts the bands below. */}
            <View className="mb-3" style={{ height: 15, justifyContent: "center" }}>
                {atLimit && (
                    <Animated.Text
                        entering={FadeIn.duration(160)}
                        style={{ fontSize: 12, color: labelColor, fontStyle: "italic" }}
                    >
                        Tap a selected emotion to remove it
                    </Animated.Text>
                )}
            </View>

            {/* Energy bands. Colour still carries valence, so both axes read at once. */}
            {GROUP_ORDER.map((group) => {
                const list = grouped[group];
                if (!list.length) return null;

                return (
                    <View key={group} className="mb-3.5">
                        <View className="flex-row items-center mb-2 gap-2">
                            {group !== UNRATED && (
                                <BandMeter
                                    filled={GROUP_BARS[group]}
                                    color={labelColor}
                                    dimColor={meterDimColor}
                                />
                            )}
                            <Text
                                style={{
                                    fontSize: 11.5,
                                    fontWeight: "700",
                                    letterSpacing: 1.1,
                                    textTransform: "uppercase",
                                    color: labelColor,
                                }}
                            >
                                {GROUP_LABELS[group]}
                            </Text>
                            <Text style={{ fontSize: 11, color: labelColor, opacity: 0.7 }}>
                                {list.length}
                            </Text>
                            <View
                                className="flex-1"
                                style={{ height: 1, backgroundColor: ruleColor }}
                            />
                        </View>

                        <View className="flex-row flex-wrap gap-2">
                            {list.map(renderEmotionChip)}
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

export default EmotionPicker;
