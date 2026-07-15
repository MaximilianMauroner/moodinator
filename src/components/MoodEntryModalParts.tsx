import React, { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { HapticTab } from "./HapticTab";
import { colors } from "@/constants/colors";
import { typography } from "@/constants/typography";
import { getMoodRatingDisplay } from "@/constants/moodScaleInterpretation";

// ─── Separator ─────────────────────────────────────────────────────────────
const Separator: React.FC<{ isDark: boolean }> = ({ isDark }) => (
    <View
        style={{
            height: 1,
            backgroundColor: isDark
                ? "rgba(61, 53, 42, 0.25)"
                : "rgba(229, 217, 191, 0.55)",
            marginVertical: 20,
        }}
    />
);

// ─── Section label ─────────────────────────────────────────────────────────
const SectionLabel: React.FC<{
    label: string;
    isDark: boolean;
    badge?: string;
    badgeColor?: string;
    action?: React.ReactNode;
}> = ({ label, isDark, badge, badgeColor, action }) => (
    <View className="flex-row items-center justify-between mb-3">
        <Text
            style={[
                typography.eyebrow,
                { color: isDark ? colors.textSubtle.dark : colors.textSubtle.light },
            ]}
        >
            {label}
        </Text>
        {(badge || action) && (
            <View className="flex-row items-center gap-2">
                {badge && (
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color:
                                badgeColor ??
                                (isDark ? colors.sand.text.dark : colors.sand.text.light),
                        }}
                    >
                        {badge}
                    </Text>
                )}
                {action}
            </View>
        )}
    </View>
);

// ─── Mood adjustment header ────────────────────────────────────────────────
const MoodAdjustRow: React.FC<{
    mood: number;
    onAdjust: (newMood: number) => void;
    isDark: boolean;
}> = ({ mood, onAdjust, isDark }) => {
    const moodData = getMoodRatingDisplay(mood, isDark);
    const bgHex = moodData.backgroundHex;
    const textHex = moodData.colorHex;
    const canDecrease = mood > 0;
    const canIncrease = mood < 10;

    // Spring bump on mood change
    const pillScale = useSharedValue(1);
    const prevMood = useRef(mood);
    useEffect(() => {
        if (prevMood.current !== mood) {
            prevMood.current = mood;
            pillScale.value = withSequence(
                withSpring(1.08, { damping: 20, stiffness: 480, overshootClamping: true }),
                withSpring(1, { damping: 22, stiffness: 320, overshootClamping: true })
            );
        }
    }, [mood, pillScale]);

    // Press feedback for chevron buttons
    const decScale = useSharedValue(1);
    const incScale = useSharedValue(1);

    const pillAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pillScale.value }],
    }));
    const decAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: decScale.value }],
    }));
    const incAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: incScale.value }],
    }));

    return (
        <View className="flex-row items-center justify-center gap-3 py-2">
            {/* Decrease (better) */}
            <Animated.View style={decAnimatedStyle}>
                <HapticTab
                    onPress={() => canDecrease && onAdjust(mood - 1)}
                    onPressIn={() => {
                        if (canDecrease) decScale.value = withSpring(0.88, { damping: 18, stiffness: 500 });
                    }}
                    onPressOut={() => {
                        decScale.value = withSpring(1, { damping: 14, stiffness: 350 });
                    }}
                    disabled={!canDecrease}
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{
                        backgroundColor: isDark
                            ? "rgba(42, 37, 32, 0.7)"
                            : "rgba(245, 241, 232, 0.9)",
                        borderWidth: 1,
                        borderColor: isDark
                            ? "rgba(61, 53, 42, 0.4)"
                            : "rgba(229, 217, 191, 0.8)",
                        opacity: canDecrease ? 1 : 0.25,
                    }}
                    accessibilityLabel={`Decrease mood to ${mood - 1}`}
                    accessibilityRole="button"
                >
                    <Ionicons
                        name="chevron-back"
                        size={16}
                        color={isDark ? colors.primary.dark : colors.primary.light}
                    />
                </HapticTab>
            </Animated.View>

            {/* Mood pill — springs on change */}
            <Animated.View
                style={[
                    {
                        backgroundColor: bgHex,
                        minWidth: 120,
                        paddingHorizontal: 20,
                        paddingVertical: 8,
                        borderRadius: 16,
                        alignItems: "center",
                        shadowColor: textHex,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: isDark ? 0.3 : 0.18,
                        shadowRadius: 8,
                        elevation: 4,
                    },
                    pillAnimatedStyle,
                ]}
            >
                <Text
                    style={{
                        ...typography.metricMd,
                        color: textHex,
                        fontSize: 26,
                        lineHeight: 30,
                    }}
                >
                    {mood}
                </Text>
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: textHex,
                        marginTop: 1,
                    }}
                >
                    {moodData.label}
                </Text>
            </Animated.View>

            {/* Increase (worse) */}
            <Animated.View style={incAnimatedStyle}>
                <HapticTab
                    onPress={() => canIncrease && onAdjust(mood + 1)}
                    onPressIn={() => {
                        if (canIncrease) incScale.value = withSpring(0.88, { damping: 18, stiffness: 500 });
                    }}
                    onPressOut={() => {
                        incScale.value = withSpring(1, { damping: 14, stiffness: 350 });
                    }}
                    disabled={!canIncrease}
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{
                        backgroundColor: isDark
                            ? "rgba(42, 37, 32, 0.7)"
                            : "rgba(245, 241, 232, 0.9)",
                        borderWidth: 1,
                        borderColor: isDark
                            ? "rgba(61, 53, 42, 0.4)"
                            : "rgba(229, 217, 191, 0.8)",
                        opacity: canIncrease ? 1 : 0.25,
                    }}
                    accessibilityLabel={`Increase mood to ${mood + 1}`}
                    accessibilityRole="button"
                >
                    <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={isDark ? colors.negative.text.dark : colors.negative.text.light}
                    />
                </HapticTab>
            </Animated.View>
        </View>
    );
};

// ─── Animated step dot ─────────────────────────────────────────────────────
const AnimatedDot: React.FC<{ isActive: boolean; isDark: boolean }> = ({
    isActive,
    isDark,
}) => {
    const width = useSharedValue(isActive ? 16 : 6);
    const opacity = useSharedValue(isActive ? 1 : 0.35);

    useEffect(() => {
        width.value = withSpring(isActive ? 16 : 6, {
            damping: 22,
            stiffness: 380,
            overshootClamping: true,
        });
        opacity.value = withTiming(isActive ? 1 : 0.35, { duration: 200 });
    }, [isActive, opacity, width]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: width.value,
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                {
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: isDark
                        ? colors.primary.dark
                        : colors.primary.light,
                },
                animatedStyle,
            ]}
        />
    );
};

// ─── Step dots ─────────────────────────────────────────────────────────────
const StepDots: React.FC<{
    total: number;
    current: number;
    isDark: boolean;
}> = ({ total, current, isDark }) => {
    if (total <= 1) return null;
    return (
        <View className="flex-row items-center justify-center gap-1.5 mt-2">
            {Array.from({ length: total }, (_, i) => (
                <AnimatedDot key={i} isActive={i === current} isDark={isDark} />
            ))}
        </View>
    );
};

// ─── Context tag chip (animated) ───────────────────────────────────────────
const ContextTagChip: React.FC<{
    label: string;
    isSelected: boolean;
    bgColor: string;
    borderColor: string;
    textColor: string;
    onPress: () => void;
}> = ({ label, isSelected, bgColor, borderColor, textColor, onPress }) => {
    const scale = useSharedValue(isSelected ? 1.04 : 1);

    useEffect(() => {
        scale.value = withSpring(isSelected ? 1.04 : 1, {
            damping: 20,
            stiffness: 380,
            overshootClamping: true,
        });
    }, [isSelected, scale]);

    const chipAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={chipAnimatedStyle}>
            <Pressable
                onPress={onPress}
                onPressIn={() => {
                    scale.value = withSpring(0.94, { damping: 20, stiffness: 500 });
                }}
                onPressOut={() => {
                    scale.value = withSpring(isSelected ? 1.04 : 1, { damping: 18, stiffness: 380 });
                }}
                className="flex-row items-center px-3 py-2 rounded-xl gap-1.5"
                style={{
                    backgroundColor: bgColor,
                    borderWidth: 1,
                    borderColor: borderColor,
                }}
                accessibilityRole="button"
                accessibilityLabel={`Context: ${label}, ${isSelected ? "selected" : "not selected"}`}
                accessibilityState={{ selected: isSelected }}
            >
                {isSelected && (
                    <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={textColor}
                    />
                )}
                <Text className="text-sm font-medium" style={{ color: textColor }}>
                    {label}
                </Text>
            </Pressable>
        </Animated.View>
    );
};

// ─── Base modal ────────────────────────────────────────────────────────────

export { Separator, SectionLabel, MoodAdjustRow, StepDots, ContextTagChip };
