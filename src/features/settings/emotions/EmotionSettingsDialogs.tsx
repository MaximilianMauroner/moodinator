import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp, FadeOut, SlideOutDown } from "react-native-reanimated";
import type { Emotion } from "@db/types";
import { haptics } from "@/lib/haptics";
import { CATEGORIES, CATEGORY_CONFIG } from "./emotionSettingsConfig";
import { styles } from "./emotionSettingsStyles";

// ─── EmotionModal Component ──────────────────────────────────────────────────

interface EmotionModalProps {
  visible: boolean;
  editingEmotion: {
    name: string;
    category: Emotion["category"];
    isNew: boolean;
  } | null;
  isDark: boolean;
  onClose: () => void;
  onSave: (name: string, category: Emotion["category"], originalName?: string) => void;
}

interface RemoveEmotionDialogProps {
  visible: boolean;
  emotionName: string | null;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

interface MoveEmotionDialogProps {
  visible: boolean;
  emotionName: string | null;
  currentCategory: Emotion["category"] | null;
  isDark: boolean;
  onCancel: () => void;
  onSelectCategory: (category: Emotion["category"]) => void;
}

function EmotionModal({
  visible,
  editingEmotion,
  isDark,
  onClose,
  onSave,
}: EmotionModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Emotion["category"]>("positive");
  const inputRef = useRef<TextInput>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (visible && editingEmotion) {
      setName(editingEmotion.name);
      setCategory(editingEmotion.category);
    } else if (!visible) {
      setName("");
    }
  }, [visible, editingEmotion]);

  React.useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  const handleModalShow = React.useCallback(() => {
    if (!visible) return;

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    // Let the sheet settle before focusing so the keyboard doesn't fight
    // the entrance transition on iOS.
    focusTimeoutRef.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 220);
  }, [visible]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(
      name,
      category,
      editingEmotion?.isNew ? undefined : editingEmotion?.name
    );
    setName("");
  };

  const cardBg = isDark ? "rgba(46,64,56,0.95)" : "#FFFFFF";
  const inputBg = isDark ? "rgba(0,0,0,0.25)" : "#F5F1E8";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={handleModalShow}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom + 12 : 0}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={StyleSheet.absoluteFillObject}
          />
        </Pressable>

        <Animated.View
          entering={FadeInUp.duration(180)}
          exiting={SlideOutDown.duration(180)}
          style={[styles.modalCard, { backgroundColor: cardBg }]}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalCardContent}
          >
            {/* Modal Handle */}
            <View style={styles.modalHandle}>
              <View
                style={[
                  styles.handleBar,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.20)"
                      : "rgba(0,0,0,0.12)",
                  },
                ]}
              />
            </View>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? "#F0EDE6" : "#3D352A" },
                ]}
              >
                {editingEmotion?.isNew ? "Add Emotion" : "Edit Emotion"}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.40)"}
                />
              </Pressable>
            </View>

            {/* Category Selector */}
            <View style={styles.modalCategoryRow}>
              {CATEGORIES.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const isSelected = cat === category;
                const color = isDark ? config.darkPrimary : config.lightPrimary;

                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      haptics.light();
                      setCategory(cat);
                    }}
                    style={[
                      styles.modalCategoryPill,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? config.darkAccentBg
                            : config.lightAccentBg
                          : "transparent",
                        borderColor: isSelected
                          ? color
                          : isDark
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(0,0,0,0.08)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.modalCategoryDot,
                        {
                          backgroundColor: color,
                          opacity: isSelected ? 1 : 0,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.modalCategoryText,
                        {
                          color: isSelected
                            ? color
                            : isDark
                              ? "rgba(255,255,255,0.50)"
                              : "rgba(0,0,0,0.45)",
                          fontWeight: isSelected ? "600" : "400",
                        },
                      ]}
                    >
                      {config.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Input */}
            <View style={styles.modalInputRow}>
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                placeholder="Emotion name..."
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)"
                }
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: inputBg,
                    color: isDark ? "#F0EDE6" : "#3D352A",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(0,0,0,0.06)",
                  },
                ]}
                blurOnSubmit={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                style={[
                  styles.modalBtn,
                  styles.modalCancelBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    {
                      color: isDark
                        ? "rgba(255,255,255,0.60)"
                        : "rgba(0,0,0,0.50)",
                    },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!name.trim()}
                style={[
                  styles.modalBtn,
                  styles.modalSaveBtn,
                  {
                    backgroundColor: name.trim()
                      ? "#5B8A5B"
                      : isDark
                        ? "rgba(91,138,91,0.30)"
                        : "rgba(91,138,91,0.25)",
                  },
                ]}
              >
                <Ionicons
                  name={editingEmotion?.isNew ? "add" : "checkmark"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.modalSaveBtnText}>
                  {editingEmotion?.isNew ? "Add" : "Save"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RemoveEmotionDialog({
  visible,
  emotionName,
  isDark,
  onCancel,
  onConfirm,
}: RemoveEmotionDialogProps) {
  if (!emotionName) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.confirmOverlay}>
        <Pressable style={styles.confirmBackdrop} onPress={onCancel}>
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(140)}
            style={StyleSheet.absoluteFillObject}
          />
        </Pressable>

        <Animated.View
          entering={FadeInUp.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.confirmCard,
            {
              backgroundColor: isDark ? "rgba(42, 38, 34, 0.98)" : "#FFFDFC",
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(199,84,65,0.12)",
            },
          ]}
        >
          <View
            style={[
              styles.confirmIconWrap,
              {
                backgroundColor: isDark
                  ? "rgba(199,84,65,0.16)"
                  : "rgba(199,84,65,0.10)",
              },
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={isDark ? "#F5A899" : "#C75441"}
            />
          </View>

          <Text
            style={[
              styles.confirmTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            Remove Emotion?
          </Text>

          <Text
            style={[
              styles.confirmBody,
              {
                color: isDark
                  ? "rgba(240,237,230,0.72)"
                  : "rgba(61,53,42,0.72)",
              },
            ]}
          >
            {`Remove "${emotionName}" from your future emotion list? Past entries will keep their snapshots.`}
          </Text>

          <View style={styles.confirmActions}>
            <Pressable
              onPress={onCancel}
              style={[
                styles.confirmButton,
                styles.confirmCancelButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(0,0,0,0.045)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmCancelText,
                  {
                    color: isDark
                      ? "rgba(255,255,255,0.68)"
                      : "rgba(61,53,42,0.65)",
                  },
                ]}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={[
                styles.confirmButton,
                styles.confirmRemoveButton,
                {
                  backgroundColor: isDark ? "#B95747" : "#C75441",
                },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              <Text style={styles.confirmRemoveText}>Remove</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MoveEmotionDialog({
  visible,
  emotionName,
  currentCategory,
  isDark,
  onCancel,
  onSelectCategory,
}: MoveEmotionDialogProps) {
  if (!emotionName || !currentCategory) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.confirmOverlay}>
        <Pressable style={styles.confirmBackdrop} onPress={onCancel}>
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(140)}
            style={StyleSheet.absoluteFillObject}
          />
        </Pressable>

        <Animated.View
          entering={FadeInUp.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.confirmCard,
            styles.moveCard,
            {
              backgroundColor: isDark ? "rgba(36, 34, 40, 0.98)" : "#FFFCFA",
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(105,92,120,0.12)",
            },
          ]}
        >
          <View
            style={[
              styles.confirmIconWrap,
              {
                backgroundColor: isDark
                  ? "rgba(105,92,120,0.18)"
                  : "rgba(105,92,120,0.10)",
              },
            ]}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={18}
              color={isDark ? "#C4BBCF" : "#695C78"}
            />
          </View>

          <Text
            style={[
              styles.confirmTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            Move {emotionName}
          </Text>

          <Text
            style={[
              styles.confirmBody,
              styles.moveBody,
              {
                color: isDark
                  ? "rgba(240,237,230,0.72)"
                  : "rgba(61,53,42,0.72)",
              },
            ]}
          >
            Choose a new category for this custom emotion.
          </Text>

          <View style={styles.moveOptions}>
            {CATEGORIES.map((category) => {
              const config = CATEGORY_CONFIG[category];
              const isCurrent = category === currentCategory;
              const color = isDark ? config.darkPrimary : config.lightPrimary;

              return (
                <Pressable
                  key={category}
                  onPress={() => {
                    haptics.light();
                    onSelectCategory(category);
                  }}
                  style={[
                    styles.moveOption,
                    {
                      backgroundColor: isCurrent
                        ? isDark
                          ? config.darkAccentBg
                          : config.lightAccentBg
                        : isDark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.025)",
                      borderColor: color,
                      opacity: isCurrent ? 0.72 : 1,
                    },
                  ]}
                  disabled={isCurrent}
                >
                  <View
                    style={[
                      styles.moveOptionDot,
                      { backgroundColor: color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.moveOptionLabel,
                      { color },
                    ]}
                  >
                    {config.label}
                  </Text>
                  <Text
                    style={[
                      styles.moveOptionHint,
                      {
                        color: isDark
                          ? "rgba(255,255,255,0.46)"
                          : "rgba(61,53,42,0.52)",
                      },
                    ]}
                  >
                    {isCurrent ? "Current" : "Move here"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onCancel}
            style={[
              styles.moveCancelButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.07)"
                  : "rgba(0,0,0,0.045)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Text
              style={[
                styles.confirmCancelText,
                {
                  color: isDark
                    ? "rgba(255,255,255,0.68)"
                    : "rgba(61,53,42,0.65)",
                },
              ]}
            >
              Cancel
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}


export { EmotionModal, RemoveEmotionDialog, MoveEmotionDialog };
