import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
    Modal,
    View,
    Text,
    Pressable,
    ScrollView,
    TextInput,
    Alert,
} from "react-native";
import { moodScale } from "@/constants/moodScale";
import { HapticTab } from "./HapticTab";
import { useThemeColors, colors } from "@/constants/colors";
import type { Emotion, Location, MoodEntry } from "../../db/types";
import { PhotoAttachment, LocationPicker, VoiceMemoRecorder, SameAsYesterdayButton } from "./entry";
import {
    getMoodButtonLabel,
    getEmotionChipLabel,
    getEmotionChipHint,
    getEnergyLevelLabel,
    BUTTON_HINTS,
} from "@/constants/accessibility";
import { haptics } from "@/lib/haptics";

export type MoodEntryFormValues = {
    mood: number;
    emotions: Emotion[];
    contextTags: string[];
    energy: number | null;
    note: string;
    photos: string[];
    location: Location | null;
    voiceMemos: string[];
    basedOnEntryId: number | null;
};

export type MoodEntryFieldConfig = {
    emotions: boolean;
    context: boolean;
    energy: boolean;
    notes: boolean;
    photos?: boolean;
    location?: boolean;
    voiceMemos?: boolean;
};

type MoodEntryModalProps = {
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

const energyValues = Array.from({ length: 11 }, (_, idx) => idx);

export const MoodEntryModal: React.FC<MoodEntryModalProps> = ({
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

    const [mood, setMood] = useState(initialMood);
    const [emotions, setEmotions] = useState<Emotion[]>([]);
    const [contextTags, setContextTags] = useState<string[]>([]);
    const [energy, setEnergy] = useState<number | null>(null);
    const [note, setNote] = useState("");
    const [photos, setPhotos] = useState<string[]>([]);
    const [location, setLocation] = useState<Location | null>(null);
    const [voiceMemos, setVoiceMemos] = useState<string[]>([]);
    const [basedOnEntryId, setBasedOnEntryId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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
            setPhotos(initialValues?.photos ?? []);
            setLocation(initialValues?.location ?? null);
            setVoiceMemos(initialValues?.voiceMemos ?? []);
            setBasedOnEntryId(initialValues?.basedOnEntryId ?? null);
            setIsSaving(false);
        }
    }, [visible, initialMood, initialValues]);

    useEffect(() => {
        if (!fieldConfig.emotions && emotions.length) {
            setEmotions([]);
        }
    }, [fieldConfig.emotions, emotions.length]);

    useEffect(() => {
        if (!fieldConfig.context && contextTags.length) {
            setContextTags([]);
        }
    }, [fieldConfig.context, contextTags.length]);

    useEffect(() => {
        if (!fieldConfig.energy && energy !== null) {
            setEnergy(null);
        }
    }, [fieldConfig.energy, energy]);

    const moodButtons = useMemo(() => {
        return moodScale.map((item) => ({
            value: item.value,
            label: item.label,
            color: item.color,
            bg: item.bg,
            description: item.description,
            borderColor: item.borderColor,
            textHex: isDark ? item.textHexDark : item.textHex,
            bgHex: isDark ? item.bgHexDark : item.bgHex,
        }));
    }, [isDark]);

    const sortedEmotionOptions = useMemo(() => {
        return [...emotionOptions].sort((a, b) => a.name.localeCompare(b.name));
    }, [emotionOptions]);

    // Use Set for O(1) emotion lookup
    const selectedEmotionNames = useMemo(() => {
        return new Set(emotions.map((e) => e.name));
    }, [emotions]);

    const toggleEmotion = useCallback((emotion: Emotion) => {
        setEmotions((prev) => {
            const exists = prev.some((item) => item.name === emotion.name);
            if (exists) {
                return prev.filter((item) => item.name !== emotion.name);
            }
            if (prev.length >= 3) {
                return prev;
            }
            return [...prev, emotion];
        });
    }, []);

    const toggleContext = useCallback((value: string) => {
        setContextTags((prev) =>
            prev.includes(value)
                ? prev.filter((item) => item !== value)
                : [...prev, value]
        );
    }, []);

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
                photos: fieldConfig.photos ? photos : [],
                location: fieldConfig.location ? location : null,
                voiceMemos: fieldConfig.voiceMemos ? voiceMemos : [],
                basedOnEntryId,
            });
            haptics.success(); // Success haptic on save
            onClose();
        } catch (error) {
            console.error("Failed to save mood entry:", error);
            haptics.error(); // Error haptic on failure
            Alert.alert("Save failed", "Unable to save your entry. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        haptics.light();
        onClose();
    };

    const handleCopyYesterday = (entry: MoodEntry) => {
        setMood(entry.mood);
        setEmotions(entry.emotions);
        setContextTags(entry.contextTags);
        setEnergy(entry.energy);
        setNote(entry.note ?? "");
        setBasedOnEntryId(entry.id);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            accessibilityViewIsModal={true}
            accessibilityLabel={`${title} form`}
        >
            <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
                <View
                    className="rounded-t-3xl max-h-[90%]"
                    style={{ backgroundColor: get("background") }}
                >
                    {/* Header */}
                    <View
                        className="p-5"
                        style={{ borderBottomWidth: 1, borderBottomColor: get("surfaceAlt") }}
                    >
                        <View
                            className="w-10 h-1 rounded-full self-center mb-4"
                            style={{ backgroundColor: get("border") }}
                        />
                        <View className="flex-row items-center justify-between">
                            <View style={{ width: 120 }} />
                            <Text
                                className="text-xl font-bold text-center flex-1"
                                style={{ color: get("text") }}
                            >
                                {title}
                            </Text>
                            <View style={{ width: 120, alignItems: "flex-end" }}>
                                <SameAsYesterdayButton onCopy={handleCopyYesterday} />
                            </View>
                        </View>
                    </View>

                    <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 24 }}>
                        {showMoodSelector && (
                            <View className="mb-6">
                                <Text
                                    className="text-sm font-semibold mb-3"
                                    style={{ color: get("textSubtle") }}
                                >
                                    Mood Level
                                </Text>
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
                                                    shadowColor: isDark ? "#000" : item.textHex,
                                                    shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                                                    shadowOpacity: isSelected ? (isDark ? 0.4 : 0.2) : 0.1,
                                                    shadowRadius: isSelected ? 8 : 4,
                                                    elevation: isSelected ? 4 : 2,
                                                }}
                                                accessibilityRole="button"
                                                accessibilityLabel={getMoodButtonLabel(item.value, item.label)}
                                                accessibilityState={{ selected: isSelected }}
                                            >
                                                <Text
                                                    className="text-lg font-bold"
                                                    style={{ color: item.textHex }}
                                                >
                                                    {item.value}
                                                </Text>
                                                <Text
                                                    className="text-[10px] font-medium"
                                                    style={{ color: item.textHex, opacity: 0.8 }}
                                                >
                                                    {item.label}
                                                </Text>
                                            </HapticTab>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {fieldConfig.emotions && (
                            <View className="mb-6">
                                <View className="flex-row items-center justify-between mb-2">
                                    <Text
                                        className="text-sm font-semibold"
                                        style={{ color: get("textSubtle") }}
                                    >
                                        Emotions
                                    </Text>
                                    <View
                                        className="px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: isDark ? colors.positive.bg.dark : colors.positive.bg.light }}
                                    >
                                        <Text
                                            className="text-xs font-medium"
                                            style={{ color: isDark ? colors.positive.text.dark : colors.positive.text.light }}
                                        >
                                            {emotions.length}/3
                                        </Text>
                                    </View>
                                </View>
                                <Text
                                    className="text-xs mb-3"
                                    style={{ color: get("textMuted") }}
                                >
                                    Choose up to three emotions
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {sortedEmotionOptions.map((emotion) => {
                                        // O(1) lookup using Set instead of O(n) with .some()
                                        const isSelected = selectedEmotionNames.has(emotion.name);
                                        const disabled = !isSelected && emotions.length >= 3;
                                        const catColors = getCategoryColors(emotion.category, isSelected);

                                        return (
                                            <Pressable
                                                key={emotion.name}
                                                onPress={() => toggleEmotion(emotion)}
                                                disabled={disabled}
                                                className={`px-3 py-2 rounded-xl ${disabled ? "opacity-40" : ""}`}
                                                style={{
                                                    backgroundColor: catColors.bg,
                                                    borderWidth: isSelected ? 0 : 1,
                                                    borderColor: catColors.border,
                                                }}
                                                accessibilityRole="button"
                                                accessibilityLabel={getEmotionChipLabel(emotion.name, emotion.category, isSelected)}
                                                accessibilityHint={getEmotionChipHint(isSelected)}
                                                accessibilityState={{ selected: isSelected, disabled }}
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
                        )}

                        {fieldConfig.context && (
                            <View className="mb-6">
                                <Text
                                    className="text-sm font-semibold mb-2"
                                    style={{ color: get("textSubtle") }}
                                >
                                    Context
                                </Text>
                                <Text
                                    className="text-xs mb-3"
                                    style={{ color: get("textMuted") }}
                                >
                                    What were you doing?
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {contextOptions.map((ctx) => {
                                        const isSelected = contextTags.includes(ctx);
                                        const ctxColors = getCategoryColors("neutral", isSelected);
                                        return (
                                            <Pressable
                                                key={ctx}
                                                onPress={() => toggleContext(ctx)}
                                                className="px-3 py-2 rounded-xl"
                                                style={{
                                                    backgroundColor: ctxColors.bg,
                                                    borderWidth: isSelected ? 0 : 1,
                                                    borderColor: ctxColors.border,
                                                }}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Context: ${ctx}, ${isSelected ? "selected" : "not selected"}`}
                                                accessibilityHint={isSelected ? "Tap to deselect" : "Tap to select"}
                                                accessibilityState={{ selected: isSelected }}
                                            >
                                                <Text
                                                    className="text-sm font-medium"
                                                    style={{ color: ctxColors.text }}
                                                >
                                                    {ctx}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {fieldConfig.energy && (
                            <View className="mb-6">
                                <View className="flex-row items-center justify-between mb-2">
                                    <Text
                                        className="text-sm font-semibold"
                                        style={{ color: get("textSubtle") }}
                                    >
                                        Energy Level
                                    </Text>
                                    {energy !== null && (
                                        <View
                                            className="px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light }}
                                        >
                                            <Text
                                                className="text-xs font-medium"
                                                style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
                                            >
                                                {energy}/10
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View className="flex-row flex-wrap gap-2">
                                    {energyValues.map((value) => {
                                        const isSelected = energy === value;
                                        return (
                                            <Pressable
                                                key={value}
                                                onPress={() => setEnergy(value)}
                                                className="w-10 h-10 rounded-xl items-center justify-center"
                                                style={{
                                                    backgroundColor: isSelected
                                                        ? (isDark ? colors.sand.bgSelected.dark : colors.sand.bgSelected.light)
                                                        : (isDark ? colors.surfaceElevated.dark : colors.sand.bg.light),
                                                    shadowColor: isSelected ? (isDark ? "#000" : colors.sand.text.light) : "transparent",
                                                    shadowOffset: { width: 0, height: 4 },
                                                    shadowOpacity: 0.2,
                                                    shadowRadius: 8,
                                                    elevation: isSelected ? 4 : 0,
                                                }}
                                                accessibilityRole="button"
                                                accessibilityLabel={getEnergyLevelLabel(value, isSelected)}
                                                accessibilityState={{ selected: isSelected }}
                                            >
                                                <Text
                                                    className="font-semibold"
                                                    style={{
                                                        color: isSelected
                                                            ? colors.textInverse.light
                                                            : (isDark ? colors.sand.text.dark : colors.sand.text.light),
                                                    }}
                                                >
                                                    {value}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                                <Pressable
                                    onPress={() => setEnergy(null)}
                                    className="mt-3 self-start px-3 py-1.5 rounded-lg"
                                    style={{ backgroundColor: get("surfaceAlt") }}
                                >
                                    <Text
                                        className="text-xs font-medium"
                                        style={{ color: isDark ? colors.sand.textMuted.dark : colors.sand.text.light }}
                                    >
                                        Clear
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {fieldConfig.notes && (
                            <View className="mb-6">
                                <Text
                                    className="text-sm font-semibold mb-2"
                                    style={{ color: get("textSubtle") }}
                                >
                                    Notes
                                </Text>
                                <TextInput
                                    multiline
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder="Add any thoughts..."
                                    className="min-h-[100px] rounded-2xl p-4"
                                    placeholderTextColor={get("textMuted")}
                                    style={{
                                        textAlignVertical: "top",
                                        backgroundColor: get("surface"),
                                        borderWidth: 1,
                                        borderColor: get("border"),
                                        color: get("text"),
                                    }}
                                    accessibilityLabel="Notes input"
                                    accessibilityHint="Add any thoughts or notes about your mood"
                                />
                            </View>
                        )}

                        {fieldConfig.photos && (
                            <PhotoAttachment
                                photos={photos}
                                onChange={setPhotos}
                            />
                        )}

                        {fieldConfig.location && (
                            <LocationPicker
                                location={location}
                                onChange={setLocation}
                            />
                        )}

                        {fieldConfig.voiceMemos && (
                            <VoiceMemoRecorder
                                memos={voiceMemos}
                                onChange={setVoiceMemos}
                            />
                        )}
                    </ScrollView>

                    {/* Footer buttons */}
                    <View
                        className="flex-row justify-between p-5"
                        style={{ borderTopWidth: 1, borderTopColor: get("surfaceAlt") }}
                    >
                        <Pressable
                            onPress={handleCancel}
                            disabled={isSaving}
                            className="flex-1 mr-2 rounded-2xl py-4 items-center"
                            style={{ backgroundColor: get("surfaceAlt") }}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            accessibilityHint={BUTTON_HINTS.cancel}
                        >
                            <Text
                                className="text-base font-semibold"
                                style={{ color: get("textMuted") }}
                            >
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSave}
                            disabled={isSaving}
                            className="flex-1 ml-2 rounded-2xl py-4 items-center"
                            style={{
                                backgroundColor: isSaving
                                    ? (isDark ? "#3D5A3D" : colors.primaryMuted.light)
                                    : get("primary"),
                                shadowColor: isDark ? "#000" : colors.primary.light,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: isDark ? 0.3 : 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={isSaving ? "Saving mood entry" : "Save mood entry"}
                            accessibilityHint={BUTTON_HINTS.save}
                            accessibilityState={{ disabled: isSaving }}
                        >
                            <Text className="text-base font-semibold text-white">
                                {isSaving ? "Saving..." : "Save"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
