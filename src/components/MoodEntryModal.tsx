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
import type { Emotion } from "../../db/types";
import { getCategoryColors } from "@/lib/emotionColors";

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
        }));
    }, []);

    // Memoize sorted emotions to avoid re-sorting on every render
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
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white dark:bg-slate-900 rounded-t-3xl max-h-[90%]">
                    <View className="p-4 border-b border-slate-200 dark:border-slate-800">
                        <Text className="text-xl font-semibold text-slate-900 dark:text-slate-100 text-center">
                            {title}
                        </Text>
                    </View>
                    <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 24 }}>
                        {showMoodSelector && (
                            <View className="mb-6">
                                <Text className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3">
                                    Mood
                                </Text>
                                <View className="flex-row flex-wrap gap-3">
                                    {moodButtons.map((item) => (
                                        <HapticTab
                                            key={item.value}
                                            onPress={() => setMood(item.value)}
                                            className={`basis-[30%] rounded-2xl px-3 py-3 items-center border ${
                                                mood === item.value
                                                    ? "bg-blue-600 border-blue-600"
                                                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                            }`}
                                            style={{ minWidth: "30%" }}
                                        >
                                            <Text
                                                className={`text-base font-bold ${
                                                    mood === item.value
                                                        ? "text-white"
                                                        : "text-slate-900 dark:text-slate-100"
                                                }`}
                                            >
                                                {item.value}
                                            </Text>
                                            <Text
                                                className={`text-xs ${
                                                    mood === item.value
                                                        ? "text-white/90"
                                                        : "text-slate-500 dark:text-slate-400"
                                                }`}
                                            >
                                                {item.label}
                                            </Text>
                                        </HapticTab>
                                    ))}
                                </View>
                            </View>
                        )}

                        {fieldConfig.emotions && (
                            <View className="mb-6">
                                <View className="flex-row items-center justify-between mb-2">
                                    <Text className="text-base font-semibold text-slate-800 dark:text-slate-100">
                                        Emotions
                                    </Text>
                                    <Text className="text-sm text-slate-500 dark:text-slate-400">
                                        {emotions.length}/3 selected
                                    </Text>
                                </View>
                                <Text className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                    Choose up to three emotions that best describe how you feel.
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {sortedEmotionOptions.map((emotion) => {
                                        const isSelected = emotions.some((e) => e.name === emotion.name);
                                        const disabled = !isSelected && emotions.length >= 3;

                                        const colors = getCategoryColors(emotion.category, "button");

                                        return (
                                            <Pressable
                                                key={emotion.name}
                                                onPress={() => toggleEmotion(emotion)}
                                                disabled={disabled}
                                                className={`px-3 py-1 rounded-full border ${
                                                    isSelected ? colors.selected : colors.unselected
                                                } ${disabled ? "opacity-50" : ""}`}
                                            >
                                                <Text
                                                    className={`text-sm ${
                                                        isSelected
                                                            ? "text-white"
                                                            : emotion.category === "positive"
                                                            ? "text-green-700 dark:text-green-300"
                                                            : emotion.category === "negative"
                                                            ? "text-red-700 dark:text-red-300"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    }`}
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
                                <Text className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
                                    Context
                                </Text>
                                <Text className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                    Tag where you were or what you were doing.
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {contextOptions.map((context) => {
                                        const isSelected = contextTags.includes(context);
                                        return (
                                            <Pressable
                                                key={context}
                                                onPress={() => toggleContext(context)}
                                                className={`px-3 py-1 rounded-full border ${
                                                    isSelected
                                                        ? "bg-emerald-100 border-emerald-500"
                                                        : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                                                }`}
                                            >
                                                <Text
                                                    className={`text-sm ${
                                                        isSelected
                                                            ? "text-emerald-700"
                                                            : "text-slate-800 dark:text-slate-200"
                                                    }`}
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
                                    <Text className="text-base font-semibold text-slate-800 dark:text-slate-100">
                                        Energy Level
                                    </Text>
                                    {energy !== null && (
                                        <Text className="text-sm text-slate-500 dark:text-slate-400">
                                            {energy}/10
                                        </Text>
                                    )}
                                </View>
                                <View className="flex-row flex-wrap gap-2">
                                    {energyValues.map((value) => {
                                        const isSelected = energy === value;
                                        return (
                                            <Pressable
                                                key={value}
                                                onPress={() => setEnergy(value)}
                                                className={`w-10 h-10 rounded-full items-center justify-center ${
                                                    isSelected
                                                        ? "bg-orange-500"
                                                        : "bg-slate-100 dark:bg-slate-800"
                                                }`}
                                            >
                                                <Text
                                                    className={`font-semibold ${
                                                        isSelected
                                                            ? "text-white"
                                                            : "text-slate-800 dark:text-slate-100"
                                                    }`}
                                                >
                                                    {value}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                                <Pressable
                                    onPress={() => setEnergy(null)}
                                    className="mt-3 self-start px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800"
                                >
                                    <Text className="text-xs text-slate-700 dark:text-slate-300">
                                        Clear Energy
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {fieldConfig.notes && (
                            <View className="mb-6">
                                <Text className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
                                    Notes
                                </Text>
                                <TextInput
                                    multiline
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder="Add any context or thoughts..."
                                    className="min-h-[100px] border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        )}
                    </ScrollView>
                    <View className="flex-row justify-between p-4 border-t border-slate-200 dark:border-slate-800">
                        <Pressable
                            onPress={onClose}
                            disabled={isSaving}
                            className="flex-1 mr-2 border border-slate-300 dark:border-slate-700 rounded-xl py-3 items-center"
                        >
                            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSave}
                            disabled={isSaving}
                            className={`flex-1 ml-2 rounded-xl py-3 items-center ${
                                isSaving ? "bg-blue-400" : "bg-blue-600"
                            }`}
                        >
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

