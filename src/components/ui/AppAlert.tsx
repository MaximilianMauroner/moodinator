import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  ScrollView,
  useWindowDimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AlertButton,
  type AlertStatic,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, effectColors, useThemeColors } from "@/constants/colors";
import { fontFamilies, typography } from "@/constants/typography";

import { useReducedMotion } from "@/hooks/useReducedMotion";

type AlertRequest = {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
  /** "support" renders a bottom sheet whose first action is emphasized. */
  variant?: "dialog" | "support";
};

type AlertOptions = {
  cancelable?: boolean;
  userInterfaceStyle?: "unspecified" | "light" | "dark";
  onDismiss?: () => void;
};

type AlertController = (request: AlertRequest) => void;

const pendingRequests: AlertRequest[] = [];
let alertController: AlertController | null = null;

function enqueueAlert(request: AlertRequest) {
  if (alertController) {
    alertController(request);
  } else {
    pendingRequests.push(request);
  }
}

/**
 * App-styled replacement for React Native's static Alert API.
 *
 * Keeping the same `Alert.alert` signature lets screens use a consistent
 * dialog without coupling them to the provider implementation.
 */
export const Alert: Pick<AlertStatic, "alert"> = {
  alert(title, message, buttons, options) {
    enqueueAlert({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: "OK" }],
      options,
    });
  },
};

/**
 * Support-first sheet for severe ratings. Same button contract as
 * `Alert.alert`; the first non-cancel button is the primary support action.
 */
export function showSupportSheet(title: string, message: string, buttons: AlertButton[]): void {
  enqueueAlert({
    title,
    message,
    buttons: buttons.length ? buttons : [{ text: "OK" }],
    variant: "support",
  });
}

function buttonColor(button: AlertButton, isDark: boolean) {
  if (button.style === "destructive") {
    return isDark ? colors.negative.text.dark : colors.negative.text.light;
  }
  if (button.style === "cancel") {
    return isDark ? colors.textMuted.dark : colors.textMuted.light;
  }
  return isDark ? colors.primaryMuted.dark : colors.positive.text.light;
}

function useAlertQueue() {
  const [requests, setRequests] = useState<AlertRequest[]>([]);
  const request = requests[0] ?? null;
  const handledRequest = useRef<AlertRequest | null>(null);
  const show = useCallback((next: AlertRequest) => {
    setRequests((current) => [...current, next]);
  }, []);
  const clear = useCallback(() => setRequests([]), []);
  const dismiss = useCallback(() => {
    if (!request || handledRequest.current === request) return;
    handledRequest.current = request;
    setRequests((current) => current.slice(1));
    request.options?.onDismiss?.();
  }, [request]);
  const pressButton = useCallback((button: AlertButton) => {
    if (!request || handledRequest.current === request) return;
    handledRequest.current = request;
    setRequests((current) => current.slice(1));
    button.onPress?.();
  }, [request]);
  return { request, show, clear, dismiss, pressButton };
}

export function AppAlertProvider() {
  const { request, show, dismiss, pressButton } = useAlertQueue();
  useEffect(() => {
    alertController = show;
    pendingRequests.splice(0).forEach(show);
    return () => {
      if (alertController === show) alertController = null;
    };
  }, [show]);
  return <AppAlertDialog request={request} dismiss={dismiss} pressButton={pressButton} />;
}

/** Render alerts inside an existing native Modal, without presenting another one. */
export function useModalAlert(visible: boolean) {
  const { request, show, clear, dismiss, pressButton } = useAlertQueue();
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    if (!visible) clear();
  }, [visible, clear]);
  const alert = useCallback<AlertStatic["alert"]>((title, message, buttons, options) => {
    if (!visibleRef.current) return;
    show({ title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }], options });
  }, [show]);
  return {
    alert,
    hasAlert: visible && request !== null,
    onRequestClose: request ? () => {
      if (request.options?.cancelable === true) dismiss();
    } : undefined,
    alertView: visible ? (
      <AppAlertDialog request={request} dismiss={dismiss} pressButton={pressButton} inline />
    ) : null,
  };
}

function AppAlertDialog({ request, dismiss, pressButton, inline = false }: {
  request: AlertRequest | null;
  dismiss: () => void;
  pressButton: (button: AlertButton) => void;
  inline?: boolean;
}) {
  const { isDark, get } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const titleRef = useRef<Text>(null);
  const scrollRef = useRef<ScrollView>(null);
  const modalShown = useRef(false);

  const focusTitle = useCallback(() => {
    const titleTag = findNodeHandle(titleRef.current);
    if (titleTag !== null) AccessibilityInfo.setAccessibilityFocus(titleTag);
  }, []);

  useEffect(() => {
    if (!request) {
      modalShown.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // Queued alerts reuse the native Modal, so onShow does not run again.
    if (inline || modalShown.current) {
      const frame = requestAnimationFrame(focusTitle);
      return () => cancelAnimationFrame(frame);
    }
  }, [request, focusTitle, inline]);

  if (!request) return null;

  const cancelable = request.options?.cancelable === true;
  const isSupport = request.variant === "support";
  const mode = isDark ? "dark" : "light";
  const primarySupportIndex = isSupport
    ? request.buttons.findIndex((button) => button.style !== "cancel")
    : -1;

  const horizontalActions = !isSupport && request.buttons.length === 2
    && width >= 360 && fontScale <= 1.2
    && request.buttons.every((button) => (button.text ?? "OK").length <= 14);

  const content = (
      <View style={[styles.overlay, inline && styles.inlineOverlay]}>
        {cancelable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss dialog"
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
          />
        ) : null}
        <SafeAreaView
          style={[styles.safeArea, isSupport && styles.sheetArea]}
          edges={isSupport ? ["bottom"] : undefined}
          pointerEvents="box-none"
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
              isSupport && styles.sheet,
              {
                backgroundColor: get("surface"),
                borderColor: get("border"),
                shadowColor: isDark ? effectColors.shadow.dark : effectColors.shadow.light,
              },
            ]}
          >
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.content}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              {isSupport ? (
                <Ionicons
                  name="thunderstorm-outline"
                  size={32}
                  color={colors.supportAction[mode]}
                  style={styles.sheetIcon}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ) : null}
              <Text
                ref={titleRef}
                accessibilityRole="header"
                style={[styles.title, { color: get("text") }]}
              >
                {request.title}
              </Text>
              {request.message ? (
                <Text style={[styles.message, { color: get("textMuted") }]}>{request.message}</Text>
              ) : null}
              <View style={[styles.buttons, horizontalActions && styles.buttonRow]}>
                {request.buttons.map((button, index) => {
                  const isPrimarySupport = index === primarySupportIndex;
                  const isQuietCancel = isSupport && button.style === "cancel";
                  return (
                    <Pressable
                      key={`${button.text ?? "button"}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={button.text ?? "Button"}
                      onPress={() => pressButton(button)}
                      className="active:opacity-70"
                      style={[
                        styles.button,
                        isSupport && styles.sheetButton,
                        horizontalActions && styles.rowButton,
                        {
                          backgroundColor: isPrimarySupport
                            ? colors.supportAction[mode]
                            : isQuietCancel
                              ? "transparent"
                              : button.style === "destructive"
                                ? colors.negative.bg[mode]
                                : get("surfaceAlt"),
                          borderColor: isPrimarySupport
                            ? colors.supportAction[mode]
                            : isQuietCancel
                              ? "transparent"
                              : button.style === "destructive"
                                ? colors.negative.border[mode]
                                : get("border"),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          {
                            color: isPrimarySupport
                              ? colors.onSupportAction[mode]
                              : isSupport && !isQuietCancel
                                ? get("text")
                                : buttonColor(button, isDark),
                          },
                        ]}
                      >
                        {button.text ?? "OK"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
  );
  if (inline) return content;
  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => {
        modalShown.current = true;
        focusTitle();
      }}
      onRequestClose={() => {
        if (cancelable) dismiss();
      }}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  safeArea: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetArea: {
    padding: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    maxWidth: undefined,
    borderRadius: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomWidth: 0,
  },
  sheetIcon: {
    marginBottom: 8,
  },
  sheetButton: {
    borderRadius: 999,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    borderRadius: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  scroll: {
    flexGrow: 0,
    borderRadius: 18,
  },
  content: {
    padding: 20,
  },
  title: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
  },
  message: {
    ...typography.bodyMd,
    marginTop: 10,
    lineHeight: 22,
  },
  buttons: {
    gap: 8,
    marginTop: 20,
  },
  buttonRow: {
    flexDirection: "row",
  },
  rowButton: {
    flex: 1,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  buttonText: {
    ...typography.bodyMd,
    fontFamily: fontFamilies.bodyMedium,
    fontWeight: "600",
    textAlign: "center",
  },
});
