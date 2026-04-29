import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from "react";
import {
    Modal,
    View,
    Text,
    Pressable,
    ScrollView,
    TextInput,
    Alert,
    useWindowDimensions,
} from "react-native";
import Animated, {
    useSharedValue,
    withTiming,
    withSpring,
    withSequence,
    runOnJS,
    Easing,
    FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { moodScale } from "@/constants/moodScale";
import { HapticTab } from "./HapticTab";
import { useThemeColors, colors } from "@/constants/colors";
import { typography } from "@/constants/typography";
import type { Emotion, MoodEntry } from "../../db/types";
import { SameAsYesterdayButton } from "./entry";
import { EmotionPicker } from "./entry/EmotionPicker";
import { EnergySlider } from "./entry/EnergySlider";
import {
    getMoodButtonLabel,
    BUTTON_HINTS,
} from "@/constants/accessibility";
import { haptics } from "@/lib/haptics";

export type MoodEntryFormValues = {
    mood: number;
    emotions: Emotion[];
    contextTags: string[];
    energy: number | null;
    note: string;
    basedOnEntryId: number | null;
};

export type MoodEntryFieldConfig = {
    emotions: boolean;
    context: boolean;
    energy: boolean;
    notes: boolean;
};

type StepId = "mood" | "emotions" | "details";

type BaseMoodEntryModalProps = {
    visible: boolean;
    title: string;
    initialMood: number;
    emotionOptions: Emotion[];
    contextOptions: string[];
    fieldConfig: MoodEntryFieldConfig;
    onClose: () => void;
    onSubmit: (values: MoodEntryFormValues) => Promise<void> | void;
    initialValues?: Partial<MoodEntryFormValues>;
    showMoodSelector?: boolean;
};

// ─── Step title map ────────────────────────────────────────────────────────
const STEP_TITLES: Record<StepId, string> = {
    mood: "How are you feeling?",
    emotions: "What emotions are present?",
    details: "Any more context?",
};

// ─── Adaptive notes placeholders ───────────────────────────────────────────
function getNotesPlaceholder(mood: number): string {
    if (mood <= 2) return "What's making this day so good?";
    if (mood <= 4) return "What's on your mind today?";
    if (mood <= 6) return "What's weighing on you? Capturing it can help.";
    return "What's happening right now? You don't have to hold it alone.";
}

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
}> = ({ label, isDark, badge, badgeColor }) => (
    <View className="flex-row items-center justify-between mb-3">
        <Text
            style={[
                typography.eyebrow,
                { color: isDark ? "#5C4E3D" : "#B0A090" },
            ]}
        >
            {label}
        </Text>
        {badge && (
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color:
                        badgeColor ??
                        (isDark ? colors.sand.text.dark : colors.sand.text.light),
                }}
            >
                {badge}
            </Text>
        )}
    </View>
);

// ─── Mood adjustment header ────────────────────────────────────────────────
const MoodAdjustRow: React.FC<{
    mood: number;
    onAdjust: (newMood: number) => void;
    isDark: boolean;
}> = ({ mood, onAdjust, isDark }) => {
    const moodData = moodScale.find((m) => m.value === mood) ?? moodScale[5];
    const bgHex = isDark ? moodData.bgHexDark : moodData.bgHex;
    const textHex = isDark ? moodData.textHexDark : moodData.textHex;
    const canDecrease = mood > 0;
    const canIncrease = mood < 10;

    // Spring bump on mood change
    const pillScale = useSharedValue(1);
    const prevMood = useRef(mood);
    useEffect(() => {
        if (prevMood.current !== mood) {
            prevMood.current = mood;
            pillScale.value = withSequence(
                withSpring(1.1, { damping: 10, stiffness: 500, mass: 0.6 }),
                withSpring(1, { damping: 18, stiffness: 350 })
            );
        }
    }, [mood]);

    // Press feedback for chevron buttons
    const decScale = useSharedValue(1);
    const incScale = useSharedValue(1);

    return (
        <View className="flex-row items-center justify-center gap-3 py-2">
            {/* Decrease (better) */}
            <Animated.View style={{ transform: [{ scale: decScale }] }}>
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
                    { transform: [{ scale: pillScale }] },
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
                        opacity: 0.8,
                        marginTop: 1,
                    }}
                >
                    {moodData.label}
                </Text>
            </Animated.View>

            {/* Increase (worse) */}
            <Animated.View style={{ transform: [{ scale: incScale }] }}>
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
    }, [isActive]);

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
                { width, opacity },
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
    }, [isSelected]);

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                onPress={onPress}
                onPressIn={() => {
                    scale.value = withSpring(0.94, { damping: 20, stiffness: 500 });
                }}
                onPressOut={() => {
                    scale.value = withSpring(isSelected ? 1.04 : 1, { damping: 18, stiffness: 380 });
                }}
                className="px-3 py-2 rounded-xl"
                style={{
                    backgroundColor: bgColor,
                    borderWidth: 1,
                    borderColor: borderColor,
                }}
                accessibilityRole="button"
                accessibilityLabel={`Context: ${label}, ${isSelected ? "selected" : "not selected"}`}
                accessibilityState={{ selected: isSelected }}
            >
                <Text className="text-sm font-medium" style={{ color: textColor }}>
                    {label}
                </Text>
            </Pressable>
        </Animated.View>
    );
};

// ─── Base modal ────────────────────────────────────────────────────────────
const BaseMoodEntryModal: React.FC<BaseMoodEntryModalProps> = ({
    visible,
    title,
    initialMood,
    emotionOptions,
    contextOptions,
    fieldConfig,
    onClose,
    onSubmit,
    initialValues,
    showMoodSelector = true,
}) => {
    const { isDark, get, getCategoryColors } = useThemeColors();
    const { height: windowHeight } = useWindowDimensions();
    const sheetHeight = Math.round(windowHeight * 0.92);

    // ── Form state
    const [mood, setMood] = useState(initialMood);
    const [emotions, setEmotions] = useState<Emotion[]>([]);
    const [contextTags, setContextTags] = useState<string[]>([]);
    const [energy, setEnergy] = useState<number | null>(null);
    const [note, setNote] = useState("");
    const [basedOnEntryId, setBasedOnEntryId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // ── Step state
    const [currentStep, setCurrentStep] = useState(0);

    // ── Step transition animation
    const stepOpacity = useSharedValue(1);

    // ── Step title crossfade (matches body; no horizontal slide)
    const titleOpacity = useSharedValue(1);

    // ── Footer button press feedback
    const nextBtnScale = useSharedValue(1);
    const backBtnScale = useSharedValue(1);

    // ── Compute steps
    const steps = useMemo<StepId[]>(() => {
        const s: StepId[] = [];
        if (showMoodSelector) s.push("mood");
        if (fieldConfig.emotions) s.push("emotions");
        const hasDetails =
            fieldConfig.context ||
            fieldConfig.energy ||
            fieldConfig.notes;
        if (hasDetails) s.push("details");
        return s.length ? s : ["details"];
    }, [showMoodSelector, fieldConfig]);

    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;
    const isMultiStep = steps.length > 1;
    const currentStepId = steps[currentStep];

    // ── Adaptive placeholder
    const notesPlaceholder = useMemo(() => getNotesPlaceholder(mood), [mood]);

    // ── Reset on open
    useEffect(() => {
        if (visible) {
            setMood(initialValues?.mood ?? initialMood);
            setEmotions(initialValues?.emotions ?? []);
            setContextTags(initialValues?.contextTags ?? []);
            setEnergy(
                initialValues && typeof initialValues.energy === "number"
                    ? initialValues.energy
                    : null
            );
            setNote(initialValues?.note ?? "");
            setBasedOnEntryId(initialValues?.basedOnEntryId ?? null);
            setIsSaving(false);
            setCurrentStep(0);
            // Reset transition state when modal opens
            stepOpacity.value = 1;
            titleOpacity.value = 1;
        }
    }, [visible, initialMood, initialValues]);

    // ── Animated step navigation (opacity dissolve only)
    // Horizontal slide + dense grids (emotion chips) reads as “chips streaming away”.
    // Fade out → setCurrentStep → useLayoutEffect fades back in.
    // useLayoutEffect fires after React commits new content but before paint —
    // no frames at opacity-0 with wrong content, no double-flicker race.
    const prevStepRef = useRef(currentStep);
    useLayoutEffect(() => {
        if (prevStepRef.current !== currentStep) {
            prevStepRef.current = currentStep;
            stepOpacity.value = withTiming(1, { duration: 155, easing: Easing.out(Easing.cubic) });
            titleOpacity.value = withTiming(1, { duration: 155, easing: Easing.out(Easing.cubic) });
        }
    }, [currentStep]);

    const goToStep = useCallback(
        (newStep: number) => {
            titleOpacity.value = withTiming(0, { duration: 115, easing: Easing.in(Easing.cubic) });
            stepOpacity.value = withTiming(0, { duration: 115, easing: Easing.in(Easing.cubic) },
                (finished) => {
                    if (finished) runOnJS(setCurrentStep)(newStep);
                }
            );
        },
        [stepOpacity, titleOpacity]
    );

    const handleNext = () => {
        if (isLastStep) {
            handleSave();
        } else {
            haptics.light();
            goToStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (isFirstStep) {
            haptics.light();
            onClose();
        } else {
            haptics.light();
            goToStep(currentStep - 1);
        }
    };

    // ── Save
    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await onSubmit({
                mood,
                emotions: fieldConfig.emotions ? emotions : [],
                contextTags: fieldConfig.context ? contextTags : [],
                energy: fieldConfig.energy ? energy : null,
                note: fieldConfig.notes ? note.trim() : "",
                basedOnEntryId,
            });
            haptics.moodLogged();
            onClose();
        } catch (error) {
            console.error("Failed to save mood entry:", error);
            haptics.error();
            Alert.alert(
                "Save failed",
                "Unable to save your entry. Please try again."
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyYesterday = (entry: MoodEntry) => {
        setMood(entry.mood);
        setEmotions(entry.emotions);
        setContextTags(entry.contextTags);
        setEnergy(entry.energy);
        setNote(entry.note ?? "");
        setBasedOnEntryId(entry.id);
    };

    const toggleContext = useCallback((value: string) => {
        setContextTags((prev) =>
            prev.includes(value)
                ? prev.filter((item) => item !== value)
                : [...prev, value]
        );
    }, []);

    // ── Mood selector grid (Edit mode)
    const moodButtons = useMemo(
        () =>
            moodScale.map((item) => ({
                value: item.value,
                label: item.label,
                textHex: isDark ? item.textHexDark : item.textHex,
                bgHex: isDark ? item.bgHexDark : item.bgHex,
            })),
        [isDark]
    );

    // ── Step content renderers
    const renderMoodStep = () => (
        <View>
            <View className="flex-row flex-wrap gap-2">
                {moodButtons.map((item) => {
                    const isSelected = mood === item.value;
                    return (
                        <HapticTab
                            key={item.value}
                            onPress={() => {
                                setMood(item.value);
                                haptics.light();
                            }}
                            className="rounded-xl px-3 py-2.5 items-center"
                            style={{
                                width: "30%",
                                backgroundColor: item.bgHex,
                                borderWidth: isSelected ? 2 : 0,
                                borderColor: item.textHex,
                                shadowColor: isSelected ? item.textHex : "transparent",
                                shadowOffset: { width: 0, height: isSelected ? 4 : 0 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                                elevation: isSelected ? 4 : 0,
                                transform: [{ scale: isSelected ? 1.04 : 1 }],
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={getMoodButtonLabel(item.value, item.label)}
                            accessibilityState={{ selected: isSelected }}
                        >
                            <Text
                                style={{
                                    fontSize: 18,
                                    fontWeight: "700",
                                    color: item.textHex,
                                    fontVariant: ["tabular-nums"],
                                }}
                            >
                                {item.value}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 9,
                                    fontWeight: "600",
                                    color: item.textHex,
                                    opacity: 0.85,
                                    textAlign: "center",
                                    marginTop: 1,
                                }}
                                numberOfLines={1}
                            >
                                {item.label}
                            </Text>
                        </HapticTab>
                    );
                })}
            </View>
        </View>
    );

    const renderEmotionsStep = () => (
        <EmotionPicker
            options={emotionOptions}
            selected={emotions}
            onChange={setEmotions}
            maxSelections={3}
        />
    );

    const renderDetailsStep = () => {
        return (
            <View>
                {/* Context Tags */}
                        {fieldConfig.context && (
                            <View className="mb-2">
                                <SectionLabel
                                    label="Context"
                                    isDark={isDark}
                                    badge={
                                        contextTags.length > 0
                                            ? `${contextTags.length} selected`
                                            : undefined
                                    }
                                />
                                <View className="flex-row flex-wrap gap-2">
                                    {contextOptions.map((ctx) => {
                                        const isSelected = contextTags.includes(ctx);
                                        const ctxColors = getCategoryColors("neutral", isSelected);
                                        return (
                                            <ContextTagChip
                                                key={ctx}
                                                label={ctx}
                                                isSelected={isSelected}
                                                bgColor={ctxColors.bg}
                                                borderColor={ctxColors.border ?? ctxColors.bg}
                                                textColor={ctxColors.text}
                                                onPress={() => toggleContext(ctx)}
                                            />
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                {/* Energy */}
                {fieldConfig.energy && (
                    <>
                        {fieldConfig.context && <Separator isDark={isDark} />}
                        <View>
                            <SectionLabel
                                label="Energy"
                                isDark={isDark}
                                badge={
                                    energy !== null ? `${energy}/10` : undefined
                                }
                            />
                            <EnergySlider value={energy} onChange={setEnergy} />
                        </View>
                    </>
                )}

                {/* Notes */}
                {fieldConfig.notes && (
                    <>
                        {(fieldConfig.context || fieldConfig.energy) && (
                            <Separator isDark={isDark} />
                        )}
                        <View>
                            <SectionLabel
                                label="Notes"
                                isDark={isDark}
                                badge={note.trim() ? "Added" : undefined}
                            />
                            <TextInput
                                multiline
                                value={note}
                                onChangeText={setNote}
                                placeholder={notesPlaceholder}
                                placeholderTextColor={get("textMuted")}
                                style={{
                                    minHeight: 100,
                                    textAlignVertical: "top",
                                    backgroundColor: isDark
                                        ? "rgba(48, 42, 34, 0.5)"
                                        : "rgba(249, 245, 237, 0.8)",
                                    borderWidth: 1,
                                    borderColor: isDark
                                        ? "rgba(61, 53, 42, 0.4)"
                                        : "rgba(229, 217, 191, 0.6)",
                                    borderRadius: 14,
                                    padding: 14,
                                    color: get("text"),
                                    fontSize: 14,
                                    lineHeight: 21,
                                    fontFamily: undefined,
                                }}
                                accessibilityLabel="Notes input"
                                accessibilityHint={notesPlaceholder}
                            />
                        </View>
                    </>
                )}

            </View>
        );
    };

    const renderCurrentStep = () => {
        switch (currentStepId) {
            case "mood":
                return renderMoodStep();
            case "emotions":
                return renderEmotionsStep();
            case "details":
                return renderDetailsStep();
        }
    };

    // ── Moodinator color for save button
    const moodData = moodScale.find((m) => m.value === mood) ?? moodScale[5];
    const saveBgColor = isSaving
        ? isDark
            ? "#3D5A3D"
            : colors.primaryMuted.light
        : get("primary");

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            accessibilityViewIsModal
            accessibilityLabel={`${title} form`}
        >
            <View
                className="flex-1 justify-end"
                style={{ backgroundColor: colors.overlay }}
            >
                <View
                    className="rounded-t-3xl"
                    style={{
                        backgroundColor: get("background"),
                        height: sheetHeight,
                        maxHeight: "92%",
                    }}
                >
                    {/* ── Header ─────────────────────────────────────────── */}
                    <View
                        style={{
                            borderBottomWidth: 1,
                            borderBottomColor: isDark
                                ? "rgba(61, 53, 42, 0.25)"
                                : "rgba(229, 217, 191, 0.5)",
                        }}
                    >
                        {/* Drag handle */}
                        <View className="items-center pt-3 pb-1">
                            <View
                                style={{
                                    width: 36,
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: isDark
                                        ? "rgba(61, 53, 42, 0.5)"
                                        : "rgba(180, 160, 130, 0.4)",
                                }}
                            />
                        </View>

                        {/* Mood adjust row + Last Entry */}
                        <View className="flex-row items-center px-4 pb-1">
                            <View className="flex-1">
                                <MoodAdjustRow
                                    mood={mood}
                                    onAdjust={setMood}
                                    isDark={isDark}
                                />
                            </View>
                            <View className="ml-2">
                                <SameAsYesterdayButton onCopy={handleCopyYesterday} />
                            </View>
                        </View>

                        {/* Step dots */}
                        <View className="pb-3">
                            <StepDots
                                total={steps.length}
                                current={currentStep}
                                isDark={isDark}
                            />
                            {/* Step title — matches step body direction */}
                            <Animated.Text
                                style={[
                                    { opacity: titleOpacity },
                                    {
                                        ...typography.eyebrow,
                                        textAlign: "center",
                                        color: isDark ? "#5C4E3D" : "#B0A090",
                                        marginTop: 6,
                                    },
                                ]}
                            >
                                {STEP_TITLES[currentStepId]}
                            </Animated.Text>
                        </View>
                    </View>

                    {/* ── Step content ────────────────────────────────────── */}
                    <Animated.View
                        style={{
                            flex: 1,
                            opacity: stepOpacity,
                        }}
                    >
                        <ScrollView
                            className="px-5 pt-5"
                            contentContainerStyle={{ paddingBottom: 28 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {renderCurrentStep()}
                        </ScrollView>
                    </Animated.View>

                    {/* ── Footer ──────────────────────────────────────────── */}
                    <View
                        style={{
                            borderTopWidth: 1,
                            borderTopColor: isDark
                                ? "rgba(61, 53, 42, 0.25)"
                                : "rgba(229, 217, 191, 0.5)",
                            backgroundColor: isDark
                                ? "rgba(28, 25, 22, 0.97)"
                                : "rgba(250, 248, 244, 0.97)",
                            paddingHorizontal: 20,
                            paddingTop: 12,
                            paddingBottom: 20,
                        }}
                    >
                        {/* Primary row */}
                        <View className="flex-row gap-3">
                            {/* Back / Cancel */}
                            <Animated.View style={{ flex: 1, transform: [{ scale: backBtnScale }] }}>
                                <Pressable
                                    onPress={handleBack}
                                    onPressIn={() => {
                                        backBtnScale.value = withSpring(0.96, { damping: 20, stiffness: 500 });
                                    }}
                                    onPressOut={() => {
                                        backBtnScale.value = withSpring(1, { damping: 14, stiffness: 350 });
                                    }}
                                    disabled={isSaving}
                                    className="rounded-2xl py-4 items-center flex-row justify-center gap-1.5"
                                    style={{
                                        backgroundColor: isDark
                                            ? "rgba(42, 37, 32, 0.8)"
                                            : "rgba(245, 241, 232, 0.9)",
                                        borderWidth: 1,
                                        borderColor: isDark
                                            ? "rgba(61, 53, 42, 0.5)"
                                            : "rgba(229, 217, 191, 0.6)",
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={isFirstStep ? "Cancel" : "Go back"}
                                >
                                    {!isFirstStep && (
                                        <Ionicons
                                            name="chevron-back"
                                            size={14}
                                            color={get("textMuted")}
                                        />
                                    )}
                                    <Text
                                        style={{
                                            fontSize: 15,
                                            fontWeight: "600",
                                            color: get("textMuted"),
                                        }}
                                    >
                                        {isFirstStep ? "Cancel" : "Back"}
                                    </Text>
                                </Pressable>
                            </Animated.View>

                            {/* Next / Save */}
                            <Animated.View style={{ flex: 1, transform: [{ scale: nextBtnScale }] }}>
                                <Pressable
                                    onPress={handleNext}
                                    onPressIn={() => {
                                        if (!isSaving) nextBtnScale.value = withSpring(0.96, { damping: 20, stiffness: 500 });
                                    }}
                                    onPressOut={() => {
                                        nextBtnScale.value = withSpring(1, { damping: 14, stiffness: 350 });
                                    }}
                                    disabled={isSaving}
                                    className="rounded-2xl py-4 items-center flex-row justify-center gap-1.5"
                                    style={{
                                        backgroundColor: saveBgColor,
                                        shadowColor: isDark
                                            ? "#000"
                                            : moodData.textHex,
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: isDark ? 0.3 : 0.22,
                                        shadowRadius: 10,
                                        elevation: 5,
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        isSaving
                                            ? "Saving"
                                            : isLastStep
                                            ? "Save entry"
                                            : "Next step"
                                    }
                                    accessibilityState={{ disabled: isSaving }}
                                    accessibilityHint={
                                        isLastStep ? BUTTON_HINTS.save : "Proceed to next step"
                                    }
                                >
                                    <Text
                                        style={{
                                            fontSize: 15,
                                            fontWeight: "700",
                                            color: "#FFFFFF",
                                        }}
                                    >
                                        {isSaving
                                            ? "Saving…"
                                            : isLastStep
                                            ? "Save Entry"
                                            : "Next"}
                                    </Text>
                                    {!isSaving && !isLastStep && (
                                        <Ionicons
                                            name="chevron-forward"
                                            size={14}
                                            color="#FFFFFF"
                                        />
                                    )}
                                    {!isSaving && isLastStep && (
                                        <Ionicons
                                            name="checkmark"
                                            size={15}
                                            color="#FFFFFF"
                                        />
                                    )}
                                    {isSaving && (
                                        <Ionicons
                                            name="hourglass"
                                            size={14}
                                            color="#FFFFFF"
                                        />
                                    )}
                                </Pressable>
                            </Animated.View>
                        </View>

                        {/* "Save now" shortcut — only when not on last step */}
                        {isMultiStep && !isLastStep && (
                            <Animated.View
                                entering={FadeIn.duration(180)}
                                exiting={FadeIn.duration(120)}
                            >
                                <Pressable
                                    onPress={handleSave}
                                    disabled={isSaving}
                                    className="items-center mt-3"
                                    accessibilityRole="button"
                                    accessibilityLabel="Save entry now without completing all steps"
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: isDark ? "#5C4E3D" : "#B0A090",
                                            fontWeight: "500",
                                        }}
                                    >
                                        Save now
                                    </Text>
                                </Pressable>
                            </Animated.View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// ─── Public modal variants ─────────────────────────────────────────────────
type MoodEntryModalSharedProps = {
    visible: boolean;
    initialMood: number;
    emotionOptions: Emotion[];
    contextOptions: string[];
    onClose: () => void;
    onSubmit: (values: MoodEntryFormValues) => Promise<void> | void;
    initialValues?: Partial<MoodEntryFormValues>;
};

type MoodEntryModalVariantProps = MoodEntryModalSharedProps & {
    fieldConfig: MoodEntryFieldConfig;
};

export type QuickMoodEntryModalProps = MoodEntryModalVariantProps;
export type DetailedMoodEntryModalProps = MoodEntryModalVariantProps;
export type EditMoodEntryModalProps = MoodEntryModalVariantProps;

export const QuickMoodEntryModal: React.FC<QuickMoodEntryModalProps> = (
    props
) => <BaseMoodEntryModal {...props} title="Quick Entry" showMoodSelector={false} />;

export const DetailedMoodEntryModal: React.FC<DetailedMoodEntryModalProps> = (
    props
) => <BaseMoodEntryModal {...props} title="Detailed Entry" showMoodSelector={false} />;

export const EditMoodEntryModal: React.FC<EditMoodEntryModalProps> = (
    props
) => <BaseMoodEntryModal {...props} title="Edit Entry" showMoodSelector={true} />;
