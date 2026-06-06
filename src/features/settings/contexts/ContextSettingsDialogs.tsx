import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp, FadeOut, SlideOutDown } from "react-native-reanimated";
import { CONTEXT_THEME } from "./contextSettingsConfig";
import { styles } from "./contextSettingsStyles";

function AddContextModal({
  visible,
  isDark,
  onClose,
  onSave,
}: {
  visible: boolean;
  isDark: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<TextInput>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (!visible) {
      setName("");
    }
  }, [visible]);

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

    focusTimeoutRef.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 220);
  }, [visible]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name);
  };

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
          style={[
            styles.modalCard,
            { backgroundColor: isDark ? "rgba(44,40,56,0.95)" : "#FFFFFF" },
          ]}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalCardContent}
          >
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

            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? "#F0EDE6" : "#3D352A" },
                ]}
              >
                Add Context Tag
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.40)"}
                />
              </Pressable>
            </View>

            <View style={styles.modalTaglineRow}>
              <View
                style={[
                  styles.modalTaglineIcon,
                  {
                    backgroundColor: isDark
                      ? "rgba(105,92,120,0.20)"
                      : "rgba(105,92,120,0.12)",
                  },
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={16}
                  color={isDark ? CONTEXT_THEME.darkPrimary : CONTEXT_THEME.lightPrimary}
                />
              </View>
              <Text
                style={[
                  styles.modalTagline,
                  {
                    color: isDark
                      ? "rgba(240,237,230,0.70)"
                      : "rgba(61,53,42,0.70)",
                  },
                ]}
              >
                Add a custom label for places, people, or situations you log often.
              </Text>
            </View>

            <View style={styles.modalInputRow}>
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                placeholder="Context name..."
                placeholderTextColor={
                  isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)"
                }
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "#F5F1E8",
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

            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                style={[
                  styles.modalBtn,
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
                  {
                    backgroundColor: name.trim()
                      ? CONTEXT_THEME.lightPrimary
                      : isDark
                        ? "rgba(105,92,120,0.30)"
                        : "rgba(105,92,120,0.25)",
                  },
                ]}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.modalSaveBtnText}>Add</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RemoveContextDialog({
  visible,
  contextName,
  isDark,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  contextName: string | null;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!contextName) return null;

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
                : "rgba(157,134,96,0.14)",
            },
          ]}
        >
          <View
            style={[
              styles.confirmIconWrap,
              {
                backgroundColor: isDark
                  ? "rgba(157,134,96,0.16)"
                  : "rgba(189,167,125,0.10)",
              },
            ]}
          >
            <Ionicons
              name="close-outline"
              size={18}
              color={isDark ? "#D9CCB0" : "#9D8660"}
            />
          </View>

          <Text
            style={[
              styles.confirmTitle,
              { color: isDark ? "#F0EDE6" : "#3D352A" },
            ]}
          >
            Remove Context?
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
            {`Remove "${contextName}" from your context list?`}
          </Text>

          <View style={styles.confirmActions}>
            <Pressable
              onPress={onCancel}
              style={[
                styles.confirmButton,
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
                {
                  backgroundColor: isDark ? "#9D8660" : "#BDA77D",
                  borderColor: "transparent",
                },
              ]}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
              <Text style={styles.confirmRemoveText}>Remove</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export { AddContextModal, RemoveContextDialog };
