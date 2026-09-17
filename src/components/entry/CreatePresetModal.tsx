import React from "react";
import {
    View,
    Text,
    Pressable,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import type { Emotion } from "@db/types";

/**
 * Sheet for naming a new emotion or context tag from inside the entry flow.
 *
 * It lived inside MoodEntryModal as a 215-line render closure over ten pieces
 * of that component's state. The two variants differ only in their copy, their
 * accent colour, and whether a category picker is shown, so the caller maps
 * whichever variant is open onto one set of props.
 */
export type CreatePresetKind = "emotion" | "context";

const EMOTION_CATEGORIES = ["positive", "negative", "neutral"] as const;
const EMOTION_CATEGORY_LABELS: Record<Emotion["category"], string> = {
    positive: "Positive",
    negative: "Negative",
    neutral: "Neutral",
};

function EmotionCategoryControl({
    category,
    isDark,
    onChange,
}: {
    category: Emotion["category"];
    isDark: boolean;
    onChange: (category: Emotion["category"]) => void;
}) {
    return (

            <View className="flex-row gap-2 mt-2">
                {EMOTION_CATEGORIES.map((item) => {
                    const isSelected = category === item;
                    const catColors = isSelected
                        ? {
                              bg: isDark
                                  ? colors[item].bgSelected.dark
                                  : colors[item].bgSelected.light,
                              border: isDark
                                  ? colors[item].bgSelected.dark
                                  : colors[item].bgSelected.light,
                              text: isDark
                                  ? colors[item].textSelected.dark
                                  : colors[item].textSelected.light,
                          }
                        : {
                              bg: isDark
                                  ? colors[item].bg.dark
                                  : colors[item].bg.light,
                              border: isDark
                                  ? colors[item].border.dark
                                  : colors[item].border.light,
                              text: isDark
                                  ? colors[item].text.dark
                                  : colors[item].text.light,
                          };

                    return (
                        <Pressable
                            key={item}
                            onPress={() => {
                                if (item === category) return;
                                onChange(item);
                                haptics.tick();
                            }}
                            className="flex-1 items-center rounded-xl px-2 py-2"
                            style={{
                                backgroundColor: catColors.bg,
                                borderWidth: 1,
                                borderColor: catColors.border,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`${EMOTION_CATEGORY_LABELS[item]} emotion category`}
                            accessibilityState={{ selected: isSelected }}
                        >
                            <Text
                                numberOfLines={1}
                                style={{
                                    color: catColors.text,
                                    fontSize: 12,
                                    fontWeight: "700",
                                }}
                            >
                                {EMOTION_CATEGORY_LABELS[item]}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
    );
}

export function CreatePresetModal({
    kind,
    name,
    error,
    isSubmitting,
    category,
    isDark,
    onChangeName,
    onChangeCategory,
    onClose,
    onSubmit,
}: {
    kind: CreatePresetKind | null;
    name: string;
    error: string | null;
    isSubmitting: boolean;
    category: Emotion["category"];
    isDark: boolean;
    onChangeName: (name: string) => void;
    onChangeCategory: (category: Emotion["category"]) => void;
    onClose: () => void;
    onSubmit: () => void;
}) {
    const { get } = useThemeColors();

if (!kind) return null;

const isEmotionModal = kind === "emotion";
const inputValue = name;
const inputError = error;
const isAdding = isSubmitting;
const titleText = isEmotionModal ? "New Emotion" : "New Context Tag";
    const placeholder = isEmotionModal
        ? "Name the emotion"
        : "Name the context tag";
    const actionColor = isEmotionModal
        ? isDark
            ? colors.negative.bgSelected.dark
            : colors.negative.bgSelected.light
        : isDark
        ? colors.dusk.bgSelected.dark
        : colors.dusk.bgSelected.light;
    const actionTextColor = isEmotionModal
        ? isDark
            ? colors.negative.textSelected.dark
            : colors.negative.textSelected.light
        : isDark
        ? colors.neutral.textSelected.dark
        : colors.neutral.textSelected.light;

return (
    <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                justifyContent: "flex-end",
                backgroundColor: colors.overlay,
                zIndex: 20,
                elevation: 20,
            }}
            accessibilityViewIsModal
            accessibilityLabel={`${titleText} form`}
        >
            <Pressable
                style={{ flex: 1 }}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close add form"
            />
            <View
                className="rounded-t-3xl px-5 pt-4 pb-6"
                style={{
                    backgroundColor: get("background"),
                    borderTopWidth: 1,
                    borderColor: isDark
                        ? "rgba(61, 53, 42, 0.35)"
                        : "rgba(229, 217, 191, 0.65)",
                }}
            >
                <View className="flex-row items-center justify-between mb-4">
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: get("text"),
                        }}
                    >
                        {titleText}
                    </Text>
                    <Pressable
                        onPress={onClose}
                        className="items-center justify-center rounded-xl"
                        style={{
                            width: 36,
                            height: 36,
                            backgroundColor: isDark
                                ? "rgba(42, 37, 32, 0.8)"
                                : "rgba(245, 241, 232, 0.9)",
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                    >
                        <Ionicons
                            name="close"
                            size={18}
                            color={get("textMuted")}
                        />
                    </Pressable>
                </View>

                <TextInput
                    value={inputValue}
                    onChangeText={(text) => {
                        onChangeName(text);
                    }}
                    onSubmitEditing={() => {
                        onSubmit();
                    }}
                    placeholder={placeholder}
                    placeholderTextColor={get("textMuted")}
                    returnKeyType="done"
                    autoCorrect
                    autoFocus
                    style={{
                        minHeight: 48,
                        backgroundColor: isDark
                            ? "rgba(48, 42, 34, 0.5)"
                            : "rgba(249, 245, 237, 0.8)",
                        borderWidth: 1,
                        borderColor: inputError
                            ? isDark
                                ? colors.negative.border.dark
                                : colors.negative.border.light
                            : isDark
                            ? "rgba(61, 53, 42, 0.4)"
                            : "rgba(229, 217, 191, 0.6)",
                        borderRadius: 14,
                        color: get("text"),
                        fontSize: 15,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                    }}
                    cursorColor={get("primary")}
                    selectionColor={
                        isDark
                            ? "rgba(166, 227, 155, 0.32)"
                            : "rgba(91, 138, 91, 0.24)"
                    }
                    accessibilityLabel={
                        isEmotionModal
                            ? "New emotion name"
                            : "New context tag name"
                    }
                />

                {isEmotionModal && (
                    <EmotionCategoryControl
                        category={category}
                        isDark={isDark}
                        onChange={onChangeCategory}
                    />
                )}

                {inputError && (
                    <Text
                        style={{
                            color: isDark
                                ? colors.negative.text.dark
                                : colors.negative.text.light,
                            fontSize: 12,
                            marginTop: 8,
                        }}
                    >
                        {inputError}
                    </Text>
                )}

                <View className="flex-row gap-3 mt-5">
                    <Pressable
                        onPress={onClose}
                        disabled={isAdding}
                        className="flex-1 rounded-2xl py-4 items-center"
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
                        accessibilityLabel="Cancel"
                    >
                        <Text
                            style={{
                                fontSize: 15,
                                fontWeight: "600",
                                color: get("textMuted"),
                            }}
                        >
                            Cancel
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => {
                            onSubmit();
                        }}
                        disabled={isAdding || !inputValue.trim()}
                        className="flex-1 rounded-2xl py-4 items-center"
                        style={{
                            backgroundColor: actionColor,
                            opacity: isAdding || !inputValue.trim() ? 0.45 : 1,
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={isEmotionModal ? "Add emotion" : "Add context tag"}
                        accessibilityState={{
                            disabled: isAdding || !inputValue.trim(),
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 15,
                                fontWeight: "700",
                                color: actionTextColor,
                            }}
                        >
                            {isAdding ? "Adding..." : "Add"}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
