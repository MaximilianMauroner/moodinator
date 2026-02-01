import React, { useEffect, useMemo, useState } from "react";
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
import { useColorScheme } from "@/hooks/useColorScheme";
import type { Emotion } from "../../db/types";

export type MoodEntryFormValues = {
    mood: number;
    emotions: Emotion[];
    contextTags: string[];
    energy: number | null;
    note: string;
};

export type MoodEntryFieldConfig = {
    emotions: boolean;
    context: boolean;
    energy: boolean;
    notes: boolean;
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

// Organic category colors
const getCategoryColors = (category: string | undefined, isSelected: boolean, isDark: boolean) => {
    if (isSelected) {
        switch (category) {
            case "positive":
                return { bg: isDark ? "#5B8A5B" : "#5B8A5B", text: "#FFFFFF" };
            case "negative":
                return { bg: isDark ? "#C75441" : "#E06B55", text: "#FFFFFF" };
            default:
                return { bg: isDark ? "#695C78" : "#847596", text: "#FFFFFF" };
        }
    }
    switch (category) {
        case "positive":
            return {
                bg: isDark ? "#2D3D2D" : "#E8EFE8",
                border: isDark ? "#3D4D3D" : "#D1DFD1",
                text: isDark ? "#A8C5A8" : "#5B8A5B",
            };
        case "negative":
            return {
                bg: isDark ? "#3D2822" : "#FDE8E4",
                border: isDark ? "#4D3832" : "#FACFC7",
                text: isDark ? "#F5A899" : "#C75441",
            };
        default:
            return {
                bg: isDark ? "#2D2A33" : "#EFECF2",
                border: isDark ? "#3D3A43" : "#DDD8E5",
                text: isDark ? "#C4BBCF" : "#695C78",
            };
    }
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
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const [mood, setMood] = useState(initialMood);
    const [emotions, setEmotions] = useState<Emotion[]>([]);
    const [contextTags, setContextTags] = useState<string[]>([]);
    const [energy, setEnergy] = useState<number | null>(null);
    const [note, setNote] = useState("");
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

    const toggleEmotion = (emotion: Emotion) => {
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
    };

    const toggleContext = (value: string) => {
        setContextTags((prev) =>
            prev.includes(value)
                ? prev.filter((item) => item !== value)
                : [...prev, value]
        );
    };

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
            });
            onClose();
        } catch (error) {
            console.error("Failed to save mood entry:", error);
            Alert.alert("Save failed", "Unable to save your entry. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                <View
                    className="rounded-t-3xl max-h-[90%]"
                    style={{ backgroundColor: isDark ? "#1C1916" : "#FDFCFA" }}
                >
                    {/* Header */}
                    <View
                        className="p-5"
                        style={{ borderBottomWidth: 1, borderBottomColor: isDark ? "#2A2520" : "#E5D9BF" }}
                    >
                        <View
                            className="w-10 h-1 rounded-full self-center mb-4"
                            style={{ backgroundColor: isDark ? "#3D352A" : "#E5D9BF" }}
                        />
                        <Text
                            className="text-xl font-bold text-center"
                            style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
                        >
                            {title}
                        </Text>
                    </View>

                    <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 24 }}>
                        {showMoodSelector && (
                            <View className="mb-6">
                                <Text
                                    className="text-sm font-semibold mb-3"
                                    style={{ color: isDark ? "#D4C4A0" : "#6B5C4A" }}
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
                                        style={{ color: isDark ? "#D4C4A0" : "#6B5C4A" }}
                                    >
                                        Emotions
                                    </Text>
                                    <View
                                        className="px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
                                    >
                                        <Text
                                            className="text-xs font-medium"
                                            style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
                                        >
                                            {emotions.length}/3
                                        </Text>
                                    </View>
                                </View>
                                <Text
                                    className="text-xs mb-3"
                                    style={{ color: isDark ? "#6B5C4A" : "#BDA77D" }}
                                >
                                    Choose up to three emotions
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {sortedEmotionOptions.map((emotion) => {
                                        const isSelected = emotions.some((e) => e.name === emotion.name);
                                        const disabled = !isSelected && emotions.length >= 3;
                                        const colors = getCategoryColors(emotion.category, isSelected, isDark);

                                        return (
                                            <Pressable
                                                key={emotion.name}
                                                onPress={() => toggleEmotion(emotion)}
                                                disabled={disabled}
                                                className={`px-3 py-2 rounded-xl ${disabled ? "opacity-40" : ""}`}
                                                style={{
                                                    backgroundColor: colors.bg,
                                                    borderWidth: isSelected ? 0 : 1,
                                                    borderColor: colors.border,
                                                }}
                                            >
                                                <Text
                                                    className="text-sm font-medium"
                                                    style={{ color: colors.text }}
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
                                    style={{ color: isDark ? "#D4C4A0" : "#6B5C4A" }}
                                >
                                    Context
                                </Text>
                                <Text
                                    className="text-xs mb-3"
                                    style={{ color: isDark ? "#6B5C4A" : "#BDA77D" }}
                                >
                                    What were you doing?
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {contextOptions.map((context) => {
                                        const isSelected = contextTags.includes(context);
                                        return (
                                            <Pressable
                                                key={context}
                                                onPress={() => toggleContext(context)}
                                                className="px-3 py-2 rounded-xl"
                                                style={{
                                                    backgroundColor: isSelected
                                                        ? (isDark ? "#695C78" : "#847596")
                                                        : (isDark ? "#2D2A33" : "#EFECF2"),
                                                    borderWidth: isSelected ? 0 : 1,
                                                    borderColor: isDark ? "#3D3A43" : "#DDD8E5",
                                                }}
                                            >
                                                <Text
                                                    className="text-sm font-medium"
                                                    style={{
                                                        color: isSelected
                                                            ? "#FFFFFF"
                                                            : (isDark ? "#C4BBCF" : "#695C78"),
                                                    }}
                                                >
                                                    {context}
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
                                        style={{ color: isDark ? "#D4C4A0" : "#6B5C4A" }}
                                    >
                                        Energy Level
                                    </Text>
                                    {energy !== null && (
                                        <View
                                            className="px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: isDark ? "#352D22" : "#F9F5ED" }}
                                        >
                                            <Text
                                                className="text-xs font-medium"
                                                style={{ color: isDark ? "#D4C4A0" : "#9D8660" }}
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
                                                        ? (isDark ? "#BDA77D" : "#9D8660")
                                                        : (isDark ? "#302A22" : "#F9F5ED"),
                                                    shadowColor: isSelected ? (isDark ? "#000" : "#9D8660") : "transparent",
                                                    shadowOffset: { width: 0, height: 4 },
                                                    shadowOpacity: 0.2,
                                                    shadowRadius: 8,
                                                    elevation: isSelected ? 4 : 0,
                                                }}
                                            >
                                                <Text
                                                    className="font-semibold"
                                                    style={{
                                                        color: isSelected
                                                            ? "#FFFFFF"
                                                            : (isDark ? "#D4C4A0" : "#9D8660"),
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
                                    style={{ backgroundColor: isDark ? "#2A2520" : "#F5F1E8" }}
                                >
                                    <Text
                                        className="text-xs font-medium"
                                        style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
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
                                    style={{ color: isDark ? "#D4C4A0" : "#6B5C4A" }}
                                >
                                    Notes
                                </Text>
                                <TextInput
                                    multiline
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder="Add any thoughts..."
                                    className="min-h-[100px] rounded-2xl p-4"
                                    placeholderTextColor={isDark ? "#6B5C4A" : "#BDA77D"}
                                    style={{
                                        textAlignVertical: "top",
                                        backgroundColor: isDark ? "#231F1B" : "#F9F5ED",
                                        borderWidth: 1,
                                        borderColor: isDark ? "#3D352A" : "#E5D9BF",
                                        color: isDark ? "#F5F1E8" : "#3D352A",
                                    }}
                                />
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer buttons */}
                    <View
                        className="flex-row justify-between p-5"
                        style={{ borderTopWidth: 1, borderTopColor: isDark ? "#2A2520" : "#E5D9BF" }}
                    >
                        <Pressable
                            onPress={onClose}
                            disabled={isSaving}
                            className="flex-1 mr-2 rounded-2xl py-4 items-center"
                            style={{ backgroundColor: isDark ? "#2A2520" : "#F5F1E8" }}
                        >
                            <Text
                                className="text-base font-semibold"
                                style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
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
                                    ? (isDark ? "#3D5A3D" : "#7BA87B")
                                    : (isDark ? "#5B8A5B" : "#5B8A5B"),
                                shadowColor: isDark ? "#000" : "#5B8A5B",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: isDark ? 0.3 : 0.25,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
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
