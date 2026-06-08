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
    Keyboard,
    Platform,
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    runOnJS,
    Easing,
    FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
    getAllMoodRatingDisplays,
    getMoodRatingDisplay,
} from "@/constants/moodScaleInterpretation";
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
import {
    ContextTagChip,
    MoodAdjustRow,
    SectionLabel,
    Separator,
    StepDots,
} from "./MoodEntryModalParts";

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
    const scrollViewRef = useRef<ScrollView>(null);
    const notesFocusedRef = useRef(false);
    const notesContainerYRef = useRef(0);
    const notesScrollTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    // ── Form state
    const [mood, setMood] = useState(initialMood);
    const [emotions, setEmotions] = useState<Emotion[]>([]);
    const [contextTags, setContextTags] = useState<string[]>([]);
    const [energy, setEnergy] = useState<number | null>(null);
    const [note, setNote] = useState("");
    const [basedOnEntryId, setBasedOnEntryId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isNotesFocused, setIsNotesFocused] = useState(false);

    // ── Step state
    const [currentStep, setCurrentStep] = useState(0);

    // ── Step transition animation
    const stepOpacity = useSharedValue(1);

    // ── Step title crossfade (matches body; no horizontal slide)
    const titleOpacity = useSharedValue(1);

    // ── Footer button press feedback
    const nextBtnScale = useSharedValue(1);
    const backBtnScale = useSharedValue(1);

    const titleOpacityStyle = useAnimatedStyle(() => ({
        opacity: titleOpacity.value,
    }));
    const stepOpacityStyle = useAnimatedStyle(() => ({
        opacity: stepOpacity.value,
    }));
    const backBtnAnimatedStyle = useAnimatedStyle(() => ({
        flex: 1,
        transform: [{ scale: backBtnScale.value }],
    }));
    const nextBtnAnimatedStyle = useAnimatedStyle(() => ({
        flex: 1,
        transform: [{ scale: nextBtnScale.value }],
    }));

    const clearScheduledNotesScrolls = useCallback(() => {
        notesScrollTimeoutsRef.current.forEach(clearTimeout);
        notesScrollTimeoutsRef.current = [];
    }, []);

    const scrollNotesIntoView = useCallback(() => {
        requestAnimationFrame(() => {
            scrollViewRef.current?.scrollTo({
                y: Math.max(notesContainerYRef.current - 8, 0),
                animated: true,
            });
        });
    }, []);

    const scheduleScrollNotesIntoView = useCallback(() => {
        clearScheduledNotesScrolls();
        scrollNotesIntoView();
        notesScrollTimeoutsRef.current = [80, 180, 320].map((delayMs) =>
            setTimeout(scrollNotesIntoView, delayMs)
        );
    }, [clearScheduledNotesScrolls, scrollNotesIntoView]);

    useEffect(() => {
        if (!visible) {
            setKeyboardHeight(0);
            setIsNotesFocused(false);
            notesFocusedRef.current = false;
            clearScheduledNotesScrolls();
            return;
        }

        const keyboardShowEvent =
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const keyboardHideEvent =
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const showSubscription = Keyboard.addListener(keyboardShowEvent, (event) => {
            setKeyboardHeight(event.endCoordinates.height);
            if (notesFocusedRef.current) {
                scheduleScrollNotesIntoView();
            }
        });
        const hideSubscription = Keyboard.addListener(keyboardHideEvent, () => {
            setKeyboardHeight(0);
            setIsNotesFocused(false);
            notesFocusedRef.current = false;
            clearScheduledNotesScrolls();
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
            clearScheduledNotesScrolls();
        };
    }, [
        clearScheduledNotesScrolls,
        scheduleScrollNotesIntoView,
        visible,
    ]);

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
    const isNotesKeyboardActive = isNotesFocused && keyboardHeight > 0;

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
            setIsNotesFocused(false);
            notesFocusedRef.current = false;
            // Reset transition state when modal opens
            stepOpacity.value = 1;
            titleOpacity.value = 1;
        }
    }, [visible, initialMood, initialValues, stepOpacity, titleOpacity]);

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
    }, [currentStep, stepOpacity, titleOpacity]);

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

    const handleNoteChange = useCallback(
        (value: string) => {
            setNote(value);
            if (notesFocusedRef.current) {
                scrollNotesIntoView();
            }
        },
        [scrollNotesIntoView]
    );

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
            getAllMoodRatingDisplays(isDark).map((item) => ({
                value: item.value,
                label: item.label,
                textHex: item.colorHex,
                bgHex: item.backgroundHex,
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
                        <View
                            onLayout={(event) => {
                                notesContainerYRef.current = event.nativeEvent.layout.y;
                            }}
                        >
                            {!isNotesKeyboardActive && (
                                <SectionLabel
                                    label="Notes"
                                    isDark={isDark}
                                    badge={note.trim() ? "Added" : undefined}
                                />
                            )}
                            <TextInput
                                multiline
                                value={note}
                                onChangeText={handleNoteChange}
                                placeholder={notesPlaceholder}
                                placeholderTextColor={get("textMuted")}
                                onFocus={() => {
                                    notesFocusedRef.current = true;
                                    setIsNotesFocused(true);
                                    scheduleScrollNotesIntoView();
                                }}
                                onBlur={() => {
                                    notesFocusedRef.current = false;
                                    setIsNotesFocused(false);
                                    clearScheduledNotesScrolls();
                                }}
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
                                cursorColor={get("primary")}
                                selectionColor={isDark ? "rgba(166, 227, 155, 0.32)" : "rgba(91, 138, 91, 0.24)"}
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
    const moodData = getMoodRatingDisplay(mood, isDark);
    const saveBgColor = isSaving
        ? isDark
            ? "#3D5A3D"
            : colors.primaryMuted.light
        : get("primary");
    // Keyboard-aware sheet sizing. Transparent modals do not reliably receive
    // Android's usual adjustResize behavior, so lift and shrink the sheet
    // ourselves on both platforms when the keyboard is visible.
    const keyboardOffset = Math.min(
        keyboardHeight,
        Math.max(windowHeight - 1, 0)
    );
    const availableHeight = Math.max(0, windowHeight - keyboardOffset);
    const scrollBottomPadding = isNotesKeyboardActive ? 12 : 28;
    const sheetHeight = Math.min(
        Math.round(windowHeight * 0.92),
        Math.max(
            1,
            Math.round(availableHeight - (isNotesKeyboardActive ? 0 : 24))
        )
    );

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
                        marginBottom: keyboardOffset,
                    }}
                >
                    {!isNotesKeyboardActive && (
                        <>
                            {/* ── Header ─────────────────────────────────── */}
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
                                            titleOpacityStyle,
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
                        </>
                    )}

                    {/* ── Step content ────────────────────────────────────── */}
                    <Animated.View style={[{ flex: 1 }, stepOpacityStyle]}>
                        <ScrollView
                            ref={scrollViewRef}
                            className="px-5 pt-5"
                            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                        >
                            {renderCurrentStep()}
                        </ScrollView>
                    </Animated.View>

                    {!isNotesKeyboardActive && (
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
                            {/* ── Footer ─────────────────────────────────── */}
                        {/* Primary row */}
                        <View className="flex-row gap-3">
                            {/* Back / Cancel */}
                            <Animated.View style={backBtnAnimatedStyle}>
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
                            <Animated.View style={nextBtnAnimatedStyle}>
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
                    )}
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
