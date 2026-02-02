import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
    Modal,
    View,
    Text,
    Pressable,
    ScrollView,
    TextInput,
    Alert,
    Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

// Color key type for the get function
type ColorKey = "background" | "surface" | "surfaceAlt" | "surfaceElevated" | "text" | "textMuted" | "textSubtle" | "textInverse" | "primary" | "primaryMuted" | "primaryBg" | "primaryBgHover" | "border" | "borderSubtle";

// Section wrapper component for consistent styling
const Section: React.FC<{
    title: string;
    subtitle?: string;
    badge?: string;
    isDark: boolean;
    get: (key: ColorKey) => string;
    children: React.ReactNode;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
}> = ({ title, subtitle, badge, isDark, get, children, icon, iconColor }) => (
    <View
        className="mb-5 rounded-2xl overflow-hidden"
        style={{
            backgroundColor: isDark ? "rgba(35, 31, 27, 0.6)" : "rgba(253, 252, 250, 0.8)",
            borderWidth: 1,
            borderColor: isDark ? "rgba(61, 53, 42, 0.5)" : "rgba(229, 217, 191, 0.6)",
        }}
    >
        <View
            className="flex-row items-center justify-between px-4 py-3"
            style={{
                backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
                borderBottomWidth: 1,
                borderBottomColor: isDark ? "rgba(61, 53, 42, 0.3)" : "rgba(229, 217, 191, 0.4)",
            }}
        >
            <View className="flex-row items-center flex-1">
                {icon && (
                    <View
                        className="w-7 h-7 rounded-lg items-center justify-center mr-2.5"
                        style={{
                            backgroundColor: isDark ? "rgba(91, 138, 91, 0.15)" : "rgba(91, 138, 91, 0.1)",
                        }}
                    >
                        <Ionicons
                            name={icon}
                            size={14}
                            color={iconColor || (isDark ? colors.positive.text.dark : colors.positive.text.light)}
                        />
                    </View>
                )}
                <View className="flex-1">
                    <Text
                        className="text-sm font-semibold"
                        style={{ color: get("text") }}
                    >
                        {title}
                    </Text>
                    {subtitle && (
                        <Text
                            className="text-xs mt-0.5"
                            style={{ color: get("textMuted") }}
                        >
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>
            {badge && (
                <View
                    className="px-2.5 py-1 rounded-full"
                    style={{
                        backgroundColor: isDark ? colors.positive.bg.dark : colors.positive.bg.light,
                    }}
                >
                    <Text
                        className="text-xs font-bold"
                        style={{ color: isDark ? colors.positive.text.dark : colors.positive.text.light }}
                    >
                        {badge}
                    </Text>
                </View>
            )}
        </View>
        <View className="p-4">
            {children}
        </View>
    </View>
);

// Compact media attachment row for photos, voice, and location
const MediaAttachmentRow: React.FC<{
    isDark: boolean;
    get: (key: ColorKey) => string;
    photos: string[];
    setPhotos: (photos: string[]) => void;
    location: Location | null;
    setLocation: (location: Location | null) => void;
    voiceMemos: string[];
    setVoiceMemos: (memos: string[]) => void;
    fieldConfig: MoodEntryFieldConfig;
}> = ({ isDark, get, photos, setPhotos, location, setLocation, voiceMemos, setVoiceMemos, fieldConfig }) => {
    const hasMedia = fieldConfig.photos || fieldConfig.location || fieldConfig.voiceMemos;
    if (!hasMedia) return null;

    const attachmentCount = photos.length + voiceMemos.length + (location ? 1 : 0);

    return (
        <Section
            title="Capture the Moment"
            subtitle="Add photos, voice memos, or your location"
            badge={attachmentCount > 0 ? `${attachmentCount} attached` : undefined}
            isDark={isDark}
            get={get}
            icon="attach"
            iconColor={isDark ? colors.sand.text.dark : colors.sand.text.light}
        >
            <View className="gap-3">
                {fieldConfig.photos && (
                    <PhotoAttachment
                        photos={photos}
                        onChange={setPhotos}
                    />
                )}

                {fieldConfig.voiceMemos && (
                    <VoiceMemoRecorder
                        memos={voiceMemos}
                        onChange={setVoiceMemos}
                    />
                )}

                {fieldConfig.location && (
                    <LocationPicker
                        location={location}
                        onChange={setLocation}
                    />
                )}
            </View>
        </Section>
    );
};

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
            haptics.success();
            onClose();
        } catch (error) {
            console.error("Failed to save mood entry:", error);
            haptics.error();
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

    // Calculate summary for header
    const summaryItems = useMemo(() => {
        const items: string[] = [];
        if (emotions.length > 0) items.push(`${emotions.length} emotion${emotions.length > 1 ? 's' : ''}`);
        if (contextTags.length > 0) items.push(`${contextTags.length} context`);
        if (energy !== null) items.push(`energy ${energy}`);
        if (photos.length > 0) items.push(`${photos.length} photo${photos.length > 1 ? 's' : ''}`);
        if (voiceMemos.length > 0) items.push(`${voiceMemos.length} memo${voiceMemos.length > 1 ? 's' : ''}`);
        if (location) items.push('location');
        if (note.trim()) items.push('note');
        return items;
    }, [emotions, contextTags, energy, photos, voiceMemos, location, note]);

    const currentMoodData = moodButtons.find(m => m.value === mood);

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
                    className="rounded-t-3xl max-h-[92%]"
                    style={{ backgroundColor: get("background") }}
                >
                    {/* Header with mood indicator */}
                    <View
                        className="px-5 pt-4 pb-4"
                        style={{
                            borderBottomWidth: 1,
                            borderBottomColor: isDark ? "rgba(61, 53, 42, 0.3)" : "rgba(229, 217, 191, 0.5)",
                        }}
                    >
                        {/* Drag handle */}
                        <View
                            className="w-10 h-1 rounded-full self-center mb-4"
                            style={{ backgroundColor: get("border") }}
                        />

                        {/* Top row: Title + Same as Yesterday */}
                        <View className="flex-row items-center justify-between mb-3">
                            <View className="flex-row items-center flex-1">
                                {currentMoodData && (
                                    <View
                                        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                                        style={{
                                            backgroundColor: currentMoodData.bgHex,
                                            shadowColor: currentMoodData.textHex,
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 4,
                                            elevation: 2,
                                        }}
                                    >
                                        <Text
                                            className="text-lg font-bold"
                                            style={{ color: currentMoodData.textHex }}
                                        >
                                            {mood}
                                        </Text>
                                    </View>
                                )}
                                <View>
                                    <Text
                                        className="text-xl font-bold"
                                        style={{ color: get("text") }}
                                    >
                                        {title}
                                    </Text>
                                    {currentMoodData && (
                                        <Text
                                            className="text-xs font-medium"
                                            style={{ color: currentMoodData.textHex }}
                                        >
                                            {currentMoodData.label}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <SameAsYesterdayButton onCopy={handleCopyYesterday} />
                        </View>

                        {/* Summary chips */}
                        {summaryItems.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                className="mt-1"
                            >
                                <View className="flex-row gap-2">
                                    {summaryItems.map((item, index) => (
                                        <View
                                            key={index}
                                            className="px-2.5 py-1 rounded-full"
                                            style={{
                                                backgroundColor: isDark ? "rgba(91, 138, 91, 0.15)" : "rgba(91, 138, 91, 0.1)",
                                                borderWidth: 1,
                                                borderColor: isDark ? "rgba(91, 138, 91, 0.2)" : "rgba(91, 138, 91, 0.15)",
                                            }}
                                        >
                                            <Text
                                                className="text-xs font-medium"
                                                style={{ color: isDark ? colors.positive.text.dark : colors.positive.text.light }}
                                            >
                                                {item}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        )}
                    </View>

                    <ScrollView
                        className="px-4 pt-4"
                        contentContainerStyle={{ paddingBottom: 24 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Mood Selector */}
                        {showMoodSelector && (
                            <Section
                                title="How are you feeling?"
                                subtitle="Select your current mood level"
                                isDark={isDark}
                                get={get}
                                icon="heart"
                                iconColor={isDark ? colors.negative.text.dark : colors.negative.text.light}
                            >
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
                                                    borderWidth: isSelected ? 2.5 : 0,
                                                    borderColor: item.textHex,
                                                    shadowColor: isDark ? "#000" : item.textHex,
                                                    shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                                                    shadowOpacity: isSelected ? (isDark ? 0.4 : 0.25) : 0.1,
                                                    shadowRadius: isSelected ? 8 : 4,
                                                    elevation: isSelected ? 4 : 2,
                                                    transform: [{ scale: isSelected ? 1.02 : 1 }],
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
                                                    style={{ color: item.textHex, opacity: 0.85 }}
                                                >
                                                    {item.label}
                                                </Text>
                                            </HapticTab>
                                        );
                                    })}
                                </View>
                            </Section>
                        )}

                        {/* Emotions */}
                        {fieldConfig.emotions && (
                            <Section
                                title="Emotions"
                                subtitle="Choose up to three emotions"
                                badge={`${emotions.length}/3`}
                                isDark={isDark}
                                get={get}
                                icon="sparkles"
                                iconColor={isDark ? colors.neutral.text.dark : colors.neutral.text.light}
                            >
                                <View className="flex-row flex-wrap gap-2">
                                    {sortedEmotionOptions.map((emotion) => {
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
                                                    transform: [{ scale: isSelected ? 1.02 : 1 }],
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
                            </Section>
                        )}

                        {/* Context Tags */}
                        {fieldConfig.context && (
                            <Section
                                title="Context"
                                subtitle="What were you doing?"
                                badge={contextTags.length > 0 ? `${contextTags.length} selected` : undefined}
                                isDark={isDark}
                                get={get}
                                icon="layers"
                                iconColor={isDark ? colors.dusk.text.dark : colors.dusk.text.light}
                            >
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
                                                    transform: [{ scale: isSelected ? 1.02 : 1 }],
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
                            </Section>
                        )}

                        {/* Energy Level */}
                        {fieldConfig.energy && (
                            <Section
                                title="Energy Level"
                                subtitle="How much energy do you have?"
                                badge={energy !== null ? `${energy}/10` : undefined}
                                isDark={isDark}
                                get={get}
                                icon="flash"
                                iconColor={isDark ? colors.sand.text.dark : colors.sand.text.light}
                            >
                                <View className="flex-row flex-wrap gap-2 mb-3">
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
                                                    transform: [{ scale: isSelected ? 1.08 : 1 }],
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
                                {energy !== null && (
                                    <Pressable
                                        onPress={() => setEnergy(null)}
                                        className="self-start px-3 py-1.5 rounded-lg flex-row items-center"
                                        style={{ backgroundColor: get("surfaceAlt") }}
                                    >
                                        <Ionicons
                                            name="close-circle"
                                            size={14}
                                            color={get("textMuted")}
                                            style={{ marginRight: 4 }}
                                        />
                                        <Text
                                            className="text-xs font-medium"
                                            style={{ color: get("textMuted") }}
                                        >
                                            Clear
                                        </Text>
                                    </Pressable>
                                )}
                            </Section>
                        )}

                        {/* Notes */}
                        {fieldConfig.notes && (
                            <Section
                                title="Notes"
                                subtitle="Write down your thoughts"
                                badge={note.trim() ? "Added" : undefined}
                                isDark={isDark}
                                get={get}
                                icon="create"
                                iconColor={isDark ? colors.positive.text.dark : colors.positive.text.light}
                            >
                                <TextInput
                                    multiline
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder="What's on your mind? Capture your thoughts, triggers, or anything you want to remember..."
                                    className="min-h-[100px] rounded-xl p-4"
                                    placeholderTextColor={get("textMuted")}
                                    style={{
                                        textAlignVertical: "top",
                                        backgroundColor: isDark ? "rgba(48, 42, 34, 0.5)" : "rgba(249, 245, 237, 0.8)",
                                        borderWidth: 1,
                                        borderColor: isDark ? "rgba(61, 53, 42, 0.5)" : "rgba(229, 217, 191, 0.6)",
                                        color: get("text"),
                                        fontSize: 14,
                                        lineHeight: 20,
                                    }}
                                    accessibilityLabel="Notes input"
                                    accessibilityHint="Add any thoughts or notes about your mood"
                                />
                            </Section>
                        )}

                        {/* Media Attachments */}
                        <MediaAttachmentRow
                            isDark={isDark}
                            get={get}
                            photos={photos}
                            setPhotos={setPhotos}
                            location={location}
                            setLocation={setLocation}
                            voiceMemos={voiceMemos}
                            setVoiceMemos={setVoiceMemos}
                            fieldConfig={fieldConfig}
                        />
                    </ScrollView>

                    {/* Footer buttons */}
                    <View
                        className="flex-row justify-between px-5 py-4"
                        style={{
                            borderTopWidth: 1,
                            borderTopColor: isDark ? "rgba(61, 53, 42, 0.3)" : "rgba(229, 217, 191, 0.5)",
                            backgroundColor: isDark ? "rgba(28, 25, 22, 0.95)" : "rgba(250, 248, 244, 0.95)",
                        }}
                    >
                        <Pressable
                            onPress={handleCancel}
                            disabled={isSaving}
                            className="flex-1 mr-3 rounded-2xl py-4 items-center flex-row justify-center"
                            style={{
                                backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
                                borderWidth: 1,
                                borderColor: isDark ? "rgba(61, 53, 42, 0.5)" : "rgba(229, 217, 191, 0.6)",
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel"
                            accessibilityHint={BUTTON_HINTS.cancel}
                        >
                            <Ionicons
                                name="close"
                                size={18}
                                color={get("textMuted")}
                                style={{ marginRight: 6 }}
                            />
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
                            className="flex-1 ml-3 rounded-2xl py-4 items-center flex-row justify-center"
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
                            <Ionicons
                                name={isSaving ? "hourglass" : "checkmark"}
                                size={18}
                                color="#FFFFFF"
                                style={{ marginRight: 6 }}
                            />
                            <Text className="text-base font-semibold text-white">
                                {isSaving ? "Saving..." : "Save Entry"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
