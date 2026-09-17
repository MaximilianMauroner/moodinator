import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
    Modal,
    View,
    Text,
    Pressable,
    ScrollView,
    TextInput,
    useWindowDimensions,
    Keyboard,
    Platform,
} from "react-native";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "@/components/ui/AppAlert";
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
import { CreatePresetModal } from "./entry/CreatePresetModal";
import {
    getMoodButtonLabel,
    BUTTON_HINTS,
} from "@/constants/accessibility";
import { haptics } from "@/lib/haptics";
import { shouldOfferCrisisSupport } from "@/lib/crisisSupport";
import { showCrisisSupportAlert } from "@/lib/showCrisisSupportAlert";
import { toastService } from "@/services/toastService";
import {
    ContextTagChip,
    MoodAdjustRow,
    SectionLabel,
    Separator,
    StepDots,
} from "./MoodEntryModalParts";
import {
    buildMoodEntrySubmitValues,
    createMoodEntryFormValues,
    getMoodEntrySteps,
    getNotesPlaceholder,
    resolveMoodEntryBackAction,
    type MoodEntryFlow,
    type MoodEntryFieldConfig,
    type MoodEntryFormValues,
    type MoodEntryStepId,
} from "./entry/moodEntryDraft";

export type { MoodEntryFieldConfig, MoodEntryFormValues } from "./entry/moodEntryDraft";

type EntryPresetCreateResult<T> = {
    value: T;
    created: boolean;
};

type CreateEmotionOption = (
    name: string,
    category: Emotion["category"]
) => Promise<EntryPresetCreateResult<Emotion> | null> | EntryPresetCreateResult<Emotion> | null;

type CreateContextOption = (
    name: string
) => Promise<EntryPresetCreateResult<string> | null> | EntryPresetCreateResult<string> | null;

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
    flow?: MoodEntryFlow;
    onCreateEmotion?: CreateEmotionOption;
    onCreateContextTag?: CreateContextOption;
};

// ─── Step title map ────────────────────────────────────────────────────────
const STEP_TITLES: Record<MoodEntryStepId, string> = {
    mood: "How are you feeling?",
    emotions: "What emotions are present?",
    details: "Any more context?",
};

function getDefaultEmotionCategory(mood: number): Emotion["category"] {
    if (mood <= 4) return "positive";
    if (mood >= 6) return "negative";
    return "neutral";
}

function normalizeEntryPresetKey(value: string): string {
    return value.trim().toLowerCase();
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
    flow = "detailed",
    onCreateEmotion,
    onCreateContextTag,
}) => {
    const { isDark, get } = useThemeColors();
    const { height: windowHeight } = useWindowDimensions();
    const pagerRef = useRef<PagerView>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const notesFocusedRef = useRef(false);
    const notesContainerYRef = useRef(0);
    const notesScrollTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const saveInFlightRef = useRef(false);
    const mountedRef = useRef(true);

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
    const [newEmotionName, setNewEmotionName] = useState("");
    const [newEmotionCategory, setNewEmotionCategory] = useState<Emotion["category"]>(
        getDefaultEmotionCategory(initialMood)
    );
    const [newEmotionError, setNewEmotionError] = useState<string | null>(null);
    const [newContextName, setNewContextName] = useState("");
    const [newContextError, setNewContextError] = useState<string | null>(null);
    const [isAddingEmotion, setIsAddingEmotion] = useState(false);
    const [isAddingContext, setIsAddingContext] = useState(false);
    const [createPresetModal, setCreatePresetModal] = useState<
        "emotion" | "context" | null
    >(null);

    // ── Step state
    const [currentStep, setCurrentStep] = useState(0);

    // ── Footer button press feedback
    const nextBtnScale = useSharedValue(1);
    const backBtnScale = useSharedValue(1);

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
    const steps = useMemo(
        () => getMoodEntrySteps(fieldConfig, showMoodSelector, flow),
        [showMoodSelector, fieldConfig, flow]
    );

    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;
    const currentStepId = steps[currentStep];
    const currentStepTitle = STEP_TITLES[currentStepId];
    const primaryActionSaves = isLastStep;
    const isNotesKeyboardActive = isNotesFocused && keyboardHeight > 0;

    // ── Adaptive placeholder
    const notesPlaceholder = useMemo(() => getNotesPlaceholder(mood), [mood]);
    const initialDraft = useMemo(
        () => createMoodEntryFormValues(initialMood, initialValues),
        [initialMood, initialValues]
    );
    const isDirty = useMemo(
        () =>
            JSON.stringify({ mood, emotions, contextTags, energy, note, basedOnEntryId }) !==
            JSON.stringify(initialDraft),
        [basedOnEntryId, contextTags, emotions, energy, initialDraft, mood, note]
    );

    // ── Reset on open
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (visible) {
            const draft = initialDraft;
            setMood(draft.mood);
            setEmotions(draft.emotions);
            setContextTags(draft.contextTags);
            setEnergy(draft.energy);
            setNote(draft.note);
            setBasedOnEntryId(draft.basedOnEntryId);
            saveInFlightRef.current = false;
            setIsSaving(false);
            setCurrentStep(0);
            setIsNotesFocused(false);
            setNewEmotionName("");
            setNewEmotionCategory(getDefaultEmotionCategory(draft.mood));
            setNewEmotionError(null);
            setNewContextName("");
            setNewContextError(null);
            setIsAddingEmotion(false);
            setIsAddingContext(false);
            setCreatePresetModal(null);
            notesFocusedRef.current = false;
            requestAnimationFrame(() => {
                pagerRef.current?.setPageWithoutAnimation(0);
            });
        }
    }, [initialDraft, visible]);

    const goToStep = useCallback(
        (newStep: number) => {
            const nextStep = Math.max(0, Math.min(newStep, steps.length - 1));
            setCurrentStep(nextStep);
            pagerRef.current?.setPage(nextStep);
        },
        [steps.length]
    );

    // ── Save
    const handleSave = useCallback(async () => {
        if (saveInFlightRef.current) return;
        saveInFlightRef.current = true;
        setIsSaving(true);

        try {
            await onSubmit(
                buildMoodEntrySubmitValues(
                    { mood, emotions, contextTags, energy, note, basedOnEntryId },
                    fieldConfig
                )
            );
            const offersCrisisSupport = shouldOfferCrisisSupport(mood);
            if (offersCrisisSupport) haptics.reject();
            else {
                haptics.commit();
                toastService.success(title === "Edit Entry" ? "Entry updated" : "Entry saved");
            }

            onClose();
            if (offersCrisisSupport) {
                setTimeout(showCrisisSupportAlert, 250);
            }
        } catch (error) {
            console.error("Failed to save mood entry:", error);
            haptics.reject();
            Alert.alert(
                "Save failed",
                "Unable to save your entry. Please try again."
            );
        } finally {
            saveInFlightRef.current = false;
            if (mountedRef.current) setIsSaving(false);
        }
    }, [
        basedOnEntryId,
        contextTags,
        emotions,
        energy,
        fieldConfig,
        mood,
        note,
        onClose,
        onSubmit,
        title,
    ]);

    const handleNext = useCallback(() => {
        if (isLastStep) {
            handleSave();
        } else {
            haptics.tick();
            goToStep(currentStep + 1);
        }
    }, [currentStep, goToStep, handleSave, isLastStep]);

    const handlePrimaryAction = useCallback(() => {
        if (primaryActionSaves) {
            handleSave();
            return;
        }

        handleNext();
    }, [handleNext, handleSave, primaryActionSaves]);

    const closeWithConfirmation = useCallback(() => {
        if (!isDirty) {
            onClose();
            return;
        }

        Alert.alert(
            "Discard changes?",
            "Your unsaved changes will be lost.",
            [
                { text: "Keep editing", style: "cancel" },
                { text: "Discard", style: "destructive", onPress: onClose },
            ]
        );
    }, [isDirty, onClose]);

    const handleBack = useCallback(() => {
        if (isFirstStep) {
            haptics.tap();
            closeWithConfirmation();
        } else {
            haptics.tick();
            goToStep(currentStep - 1);
        }
    }, [closeWithConfirmation, currentStep, goToStep, isFirstStep]);

    const handlePageSelected = useCallback(
        (event: PagerViewOnPageSelectedEvent) => {
            const nextStep = event.nativeEvent.position;
            if (nextStep === currentStep) return;

            haptics.tick();
            setCurrentStep(nextStep);
        },
        [currentStep]
    );

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
        haptics.tick();
        setContextTags((prev) =>
            prev.includes(value)
                ? prev.filter((item) => item !== value)
                : [...prev, value]
        );
    }, []);

    const handleCreateEmotion = useCallback(async () => {
        const trimmed = newEmotionName.trim();
        if (!trimmed || isAddingEmotion) return false;

        if (!onCreateEmotion) {
            setNewEmotionError("Emotion list is not available.");
            haptics.reject();
            return false;
        }

        const alreadySelected = emotions.some(
            (emotion) =>
                normalizeEntryPresetKey(emotion.name) === normalizeEntryPresetKey(trimmed)
        );
        if (!alreadySelected && emotions.length >= 3) {
            setNewEmotionError("Remove one selected emotion first.");
            haptics.reject();
            return false;
        }

        setIsAddingEmotion(true);
        setNewEmotionError(null);

        try {
            const result = await onCreateEmotion(trimmed, newEmotionCategory);
            if (!result) {
                setNewEmotionError("Enter an emotion name.");
                return false;
            }

            setEmotions((current) => {
                const exists = current.some(
                    (emotion) =>
                        normalizeEntryPresetKey(emotion.name) ===
                        normalizeEntryPresetKey(result.value.name)
                );
                if (exists || current.length >= 3) return current;
                return [...current, result.value];
            });
            setNewEmotionName("");
            // A new preset is written to storage; an existing one is only selected.
            haptics[result.created ? "commit" : "tick"]();
            return true;
        } catch {
            setNewEmotionError("Could not add emotion.");
            haptics.reject();
            return false;
        } finally {
            setIsAddingEmotion(false);
        }
    }, [
        emotions,
        isAddingEmotion,
        newEmotionCategory,
        newEmotionName,
        onCreateEmotion,
    ]);

    const handleCreateContextTag = useCallback(async () => {
        const trimmed = newContextName.trim();
        if (!trimmed || isAddingContext) return false;

        if (!onCreateContextTag) {
            setNewContextError("Context Tag List is not available.");
            haptics.reject();
            return false;
        }

        setIsAddingContext(true);
        setNewContextError(null);

        try {
            const result = await onCreateContextTag(trimmed);
            if (!result) {
                setNewContextError("Enter a context tag.");
                return false;
            }

            setContextTags((current) => {
                const exists = current.some(
                    (context) =>
                        normalizeEntryPresetKey(context) ===
                        normalizeEntryPresetKey(result.value)
                );
                return exists ? current : [...current, result.value];
            });
            setNewContextName("");
            // A new preset is written to storage; an existing one is only selected.
            haptics[result.created ? "commit" : "tick"]();
            return true;
        } catch {
            setNewContextError("Could not add context tag.");
            haptics.reject();
            return false;
        } finally {
            setIsAddingContext(false);
        }
    }, [isAddingContext, newContextName, onCreateContextTag]);

    const openCreateEmotionModal = useCallback(() => {
        setNewEmotionName("");
        setNewEmotionCategory(getDefaultEmotionCategory(mood));
        setNewEmotionError(null);
        setCreatePresetModal("emotion");
        haptics.tap();
    }, [mood]);

    const openCreateContextModal = useCallback(() => {
        setNewContextName("");
        setNewContextError(null);
        setCreatePresetModal("context");
        haptics.tap();
    }, []);

    const closeCreatePresetModal = useCallback(() => {
        if (isAddingEmotion || isAddingContext) return;
        Keyboard.dismiss();
        setCreatePresetModal(null);
        setNewEmotionError(null);
        setNewContextError(null);
    }, [isAddingContext, isAddingEmotion]);

    const handleRequestClose = useCallback(() => {
        const backAction = resolveMoodEntryBackAction({
            isSaving,
            isPresetModalOpen: createPresetModal !== null,
            isNotesKeyboardActive,
            isFirstStep,
        });

        switch (backAction) {
            case "ignore":
                return;
            case "closePreset":
                closeCreatePresetModal();
                return;
            case "dismissKeyboard":
                Keyboard.dismiss();
                setIsNotesFocused(false);
                notesFocusedRef.current = false;
                clearScheduledNotesScrolls();
                return;
            case "previousStep":
            case "closeEntry":
                handleBack();
                return;
        }
    }, [
        clearScheduledNotesScrolls,
        closeCreatePresetModal,
        createPresetModal,
        handleBack,
        isFirstStep,
        isNotesKeyboardActive,
        isSaving,
    ]);

    const submitCreatePresetModal = useCallback(async () => {
        const didCreate =
            createPresetModal === "emotion"
                ? await handleCreateEmotion()
                : createPresetModal === "context"
                ? await handleCreateContextTag()
                : false;

        if (didCreate) {
            Keyboard.dismiss();
            setCreatePresetModal(null);
        }
    }, [createPresetModal, handleCreateContextTag, handleCreateEmotion]);

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
                            onPress={() => setMood(item.value)}
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
                                    fontSize: 12,
                                    fontWeight: "600",
                                    color: item.textHex,
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

    const renderAddPresetButton = ({
        onPress,
        color,
        textColor,
        label,
    }: {
        onPress: () => void;
        color: string;
        textColor: string;
        label: string;
    }) => (
        <Pressable
            onPress={onPress}
            className="items-center justify-center rounded-xl"
            style={{
                width: 32,
                height: 32,
                backgroundColor: color,
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name="add" size={18} color={textColor} />
        </Pressable>
    );



    const renderEmotionsStep = () => (
        <View>
            <SectionLabel
                label="Emotions"
                isDark={isDark}
                badge={
                    emotions.length > 0
                        ? `${emotions.length}/3 selected`
                        : undefined
                }
                action={
                    onCreateEmotion
                        ? renderAddPresetButton({
                              onPress: openCreateEmotionModal,
                              color: isDark
                                  ? colors.negative.bgSelected.dark
                                  : colors.negative.bgSelected.light,
                              textColor: isDark
                                  ? colors.negative.textSelected.dark
                                  : colors.negative.textSelected.light,
                              label: "Add new emotion",
                          })
                        : undefined
                }
            />
            <EmotionPicker
                options={emotionOptions}
                selected={emotions}
                onChange={setEmotions}
                maxSelections={3}
            />
        </View>
    );

    const getContextTagColors = (isSelected: boolean) => {
        if (isSelected) {
            return {
                bg: isDark ? colors.dusk.bgSelected.dark : colors.dusk.bgSelected.light,
                border: undefined,
                text: isDark
                    ? colors.neutral.textSelected.dark
                    : colors.neutral.textSelected.light,
            };
        }

        return {
            bg: isDark ? colors.dusk.bg.dark : colors.dusk.bg.light,
            border: isDark ? colors.dusk.border.dark : colors.dusk.border.light,
            text: isDark ? colors.dusk.text.dark : colors.dusk.text.light,
        };
    };

    const renderContextSection = (options?: { compact?: boolean }) => {
        if (!fieldConfig.context) return null;

        return (
            <View className={options?.compact ? "mt-5" : "mb-2"}>
                <SectionLabel
                    label="Context Tags"
                    isDark={isDark}
                    badge={
                        contextTags.length > 0
                            ? `${contextTags.length} selected`
                            : undefined
                    }
                    action={
                        onCreateContextTag
                            ? renderAddPresetButton({
                                  onPress: openCreateContextModal,
                                  color: isDark
                                      ? colors.dusk.bgSelected.dark
                                      : colors.dusk.bgSelected.light,
                                  textColor: isDark
                                      ? colors.neutral.textSelected.dark
                                      : colors.neutral.textSelected.light,
                                  label: "Add new context tag",
                              })
                            : undefined
                    }
                />
                <View className="flex-row flex-wrap gap-2">
                    {contextOptions.map((ctx) => {
                        const isSelected = contextTags.includes(ctx);
                        const ctxColors = getContextTagColors(isSelected);
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
        );
    };

    const renderDetailsStep = () => {
        const showContextInDetails = fieldConfig.context;
        return (
            <View>
                {/* Context Tags */}
                {showContextInDetails && renderContextSection()}

                {/* Energy */}
                {fieldConfig.energy && (
                    <>
                        {showContextInDetails && <Separator isDark={isDark} />}
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
                        {(showContextInDetails || fieldConfig.energy) && (
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
                                testID="entry-notes"
                                accessibilityLabel="Notes input"
                                accessibilityHint={notesPlaceholder}
                            />
                        </View>
                    </>
                )}

            </View>
        );
    };

    const renderStepContent = (stepId: MoodEntryStepId) => {
        switch (stepId) {
            case "mood":
                return renderMoodStep();
            case "emotions":
                return renderEmotionsStep();
            case "details":
                return renderDetailsStep();
        }
    };

    const renderStepPage = (stepId: MoodEntryStepId) => (
        <View key={stepId} style={{ flex: 1 }}>
            <ScrollView
                ref={stepId === "details" ? scrollViewRef : undefined}
                className="px-5 pt-5"
                contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            >
                {renderStepContent(stepId)}
            </ScrollView>
        </View>
    );

    // ── Moodinator color for save button
    const moodData = getMoodRatingDisplay(mood, isDark);
    const saveBgColor = isSaving
        ? isDark
            ? "#3D5A3D"
            : colors.primaryMuted.light
        : get("primary");
    const saveContentColor = isSaving && isDark
        ? colors.textInverse.dark
        : get("onPrimary");
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
            onRequestClose={handleRequestClose}
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

                                <View className="flex-row items-center px-4 pb-2">
                                    <Text
                                        className="flex-1 text-lg font-bold"
                                        style={{ color: get("text") }}
                                    >
                                        {title}
                                    </Text>
                                    <Pressable
                                        onPress={closeWithConfirmation}
                                        className="h-11 w-11 items-center justify-center rounded-full"
                                        accessibilityRole="button"
                                        accessibilityLabel={`Close ${title}`}
                                    >
                                        <Ionicons name="close" size={24} color={get("textMuted")} />
                                    </Pressable>
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
                                        style={{
                                            ...typography.eyebrow,
                                            textAlign: "center",
                                            color: get("textSubtle"),
                                            marginTop: 6,
                                        }}
                                    >
                                        {currentStepTitle}
                                    </Animated.Text>
                                </View>
                            </View>
                        </>
                    )}

                    {/* ── Step content ────────────────────────────────────── */}
                    <PagerView
                        ref={pagerRef}
                        style={{ flex: 1 }}
                        initialPage={0}
                        scrollEnabled={!isSaving && !isNotesKeyboardActive}
                        onPageSelected={handlePageSelected}
                        offscreenPageLimit={1}
                    >
                        {steps.map(renderStepPage)}
                    </PagerView>

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
                                    onPress={handlePrimaryAction}
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
                                            : primaryActionSaves
                                            ? "Save entry"
                                            : "Next step"
                                    }
                                    accessibilityState={{ disabled: isSaving }}
                                    accessibilityHint={
                                        primaryActionSaves ? BUTTON_HINTS.save : "Proceed to next step"
                                    }
                                >
                                    <Text
                                        style={{
                                            fontSize: 15,
                                            fontWeight: "700",
                                            color: saveContentColor,
                                        }}
                                    >
                                        {isSaving
                                            ? "Saving…"
                                            : primaryActionSaves
                                            ? "Save Entry"
                                            : "Next"}
                                    </Text>
                                    {!isSaving && !primaryActionSaves && (
                                        <Ionicons
                                            name="chevron-forward"
                                            size={14}
                                            color={saveContentColor}
                                        />
                                    )}
                                    {!isSaving && primaryActionSaves && (
                                        <Ionicons
                                            name="checkmark"
                                            size={15}
                                            color={saveContentColor}
                                        />
                                    )}
                                    {isSaving && (
                                        <Ionicons
                                            name="hourglass"
                                            size={14}
                                            color={saveContentColor}
                                        />
                                    )}
                                </Pressable>
                            </Animated.View>
                        </View>

                        </View>
                    )}
                </View>
                <CreatePresetModal
                    kind={createPresetModal}
                    name={
                        createPresetModal === "emotion"
                            ? newEmotionName
                            : newContextName
                    }
                    error={
                        createPresetModal === "emotion"
                            ? newEmotionError
                            : newContextError
                    }
                    isSubmitting={
                        createPresetModal === "emotion"
                            ? isAddingEmotion
                            : isAddingContext
                    }
                    category={newEmotionCategory}
                    isDark={isDark}
                    onChangeName={(text) => {
                        if (createPresetModal === "emotion") {
                            setNewEmotionName(text);
                            if (newEmotionError) setNewEmotionError(null);
                        } else {
                            setNewContextName(text);
                            if (newContextError) setNewContextError(null);
                        }
                    }}
                    onChangeCategory={setNewEmotionCategory}
                    onClose={closeCreatePresetModal}
                    onSubmit={() => {
                        void submitCreatePresetModal();
                    }}
                />
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
    onCreateEmotion?: CreateEmotionOption;
    onCreateContextTag?: CreateContextOption;
};

type MoodEntryModalVariantProps = MoodEntryModalSharedProps & {
    fieldConfig: MoodEntryFieldConfig;
};

export type QuickMoodEntryModalProps = MoodEntryModalVariantProps;
export type DetailedMoodEntryModalProps = MoodEntryModalVariantProps;
export type EditMoodEntryModalProps = MoodEntryModalVariantProps;

export const QuickMoodEntryModal: React.FC<QuickMoodEntryModalProps> = (
    props
) => <BaseMoodEntryModal {...props} title="Quick Entry" showMoodSelector={false} flow="quick" />;

export const DetailedMoodEntryModal: React.FC<DetailedMoodEntryModalProps> = (
    props
) => <BaseMoodEntryModal {...props} title="Detailed Entry" showMoodSelector={false} />;

export const EditMoodEntryModal: React.FC<EditMoodEntryModalProps> = (
    props
) => <BaseMoodEntryModal {...props} title="Edit Entry" showMoodSelector={true} />;
