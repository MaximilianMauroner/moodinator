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

import { colors, effectColors, useThemeColors } from "@/constants/colors";
import { fontFamilies, typography } from "@/constants/typography";

import { useReducedMotion } from "@/hooks/useReducedMotion";

type AlertRequest = {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
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

function buttonColor(button: AlertButton, isDark: boolean) {
  if (button.style === "destructive") {
    return isDark ? colors.negative.text.dark : colors.negative.text.light;
  }
  if (button.style === "cancel") {
    return isDark ? colors.textMuted.dark : colors.textMuted.light;
  }
  return isDark ? colors.primaryMuted.dark : colors.positive.text.light;
}

export function AppAlertProvider() {
  const { isDark, get } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const titleRef = useRef<Text>(null);
  const scrollRef = useRef<ScrollView>(null);
  const modalShown = useRef(false);
  const [requests, setRequests] = useState<AlertRequest[]>([]);
  const request = requests[0] ?? null;
  const handledRequest = useRef<AlertRequest | null>(null);

  const show = useCallback((next: AlertRequest) => {
    setRequests((current) => [...current, next]);
  }, []);

  useEffect(() => {
    alertController = show;
    if (pendingRequests.length) {
      const requests = pendingRequests.splice(0, pendingRequests.length);
      requests.forEach(show);
    }
    return () => {
      if (alertController === show) {
        alertController = null;
      }
    };
  }, [show]);

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
    if (modalShown.current) {
      const frame = requestAnimationFrame(focusTitle);
      return () => cancelAnimationFrame(frame);
    }
  }, [request, focusTitle]);

  if (!request) return null;

  const cancelable = request.options?.cancelable === true;

  const horizontalActions = request.buttons.length === 2
    && width >= 360 && fontScale <= 1.2
    && request.buttons.every((button) => (button.text ?? "OK").length <= 14);

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
      <View style={styles.overlay}>
        {cancelable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss dialog"
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
          />
        ) : null}
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
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
                {request.buttons.map((button, index) => (
                  <Pressable
                    key={`${button.text ?? "button"}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={button.text ?? "Button"}
                    onPress={() => pressButton(button)}
                    className="active:opacity-70"
                    style={[
                      styles.button,
                      horizontalActions && styles.rowButton,
                      {
                        backgroundColor: button.style === "destructive"
                          ? colors.negative.bg[isDark ? "dark" : "light"]
                          : get("surfaceAlt"),
                        borderColor: button.style === "destructive"
                          ? colors.negative.border[isDark ? "dark" : "light"]
                          : get("border"),
                      },
                    ]}
                  >
                    <Text style={[styles.buttonText, { color: buttonColor(button, isDark) }]}>
                      {button.text ?? "OK"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
