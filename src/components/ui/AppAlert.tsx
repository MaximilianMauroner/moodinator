import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
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
import { typography } from "@/constants/typography";

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
  return isDark ? colors.primaryMuted.dark : colors.primary.light;
}

export function AppAlertProvider() {
  const { isDark, get } = useThemeColors();
  const [request, setRequest] = useState<AlertRequest | null>(null);
  const queueRef = useRef<AlertRequest[]>([]);

  const show = useCallback((next: AlertRequest) => {
    setRequest((current) => {
      if (current) {
        queueRef.current.push(next);
        return current;
      }
      return next;
    });
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

  useEffect(() => {
    if (!request && queueRef.current.length) {
      setRequest(queueRef.current.shift() ?? null);
    }
  }, [request]);

  const dismiss = useCallback(() => {
    if (!request) return;
    setRequest(null);
    request.options?.onDismiss?.();
  }, [request]);

  const pressButton = useCallback(
    (button: AlertButton) => {
      setRequest(null);
      button.onPress?.();
    },
    []
  );

  if (!request) return null;

  const cancelable = request.options?.cancelable === true;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
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
        <SafeAreaView edges={["left", "right"]} style={styles.safeArea}>
          <View
            accessibilityRole="alert"
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
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: isDark ? colors.primaryBg.dark : colors.primaryBg.light },
              ]}
            >
              <Ionicons
                name="leaf-outline"
                size={21}
                color={isDark ? colors.primaryMuted.dark : colors.primary.light}
              />
            </View>
            <Text style={[typography.titleMd, { color: get("text") }]}>{request.title}</Text>
            {request.message ? (
              <Text style={[styles.message, { color: get("textMuted") }]}>{request.message}</Text>
            ) : null}
            <View style={styles.buttons}>
              {request.buttons.map((button, index) => (
                <Pressable
                  key={`${button.text ?? "button"}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={button.text ?? "Button"}
                  onPress={() => pressButton(button)}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor:
                        button.style === "cancel"
                          ? isDark
                            ? colors.surfaceAlt.dark
                            : colors.surfaceAlt.light
                          : button.style === "destructive"
                            ? isDark
                              ? colors.negative.bg.dark
                              : colors.negative.bg.light
                            : isDark
                              ? colors.primaryBg.dark
                              : colors.primaryBg.light,
                      borderColor:
                        button.style === "cancel"
                          ? get("border")
                          : button.style === "destructive"
                            ? isDark
                              ? colors.negative.border.dark
                              : colors.negative.border.light
                            : isDark
                              ? colors.primaryBgHover.dark
                              : colors.primaryBgHover.light,
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: buttonColor(button, isDark) },
                    ]}
                  >
                    {button.text ?? "OK"}
                  </Text>
                </Pressable>
              ))}
            </View>
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
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  safeArea: {
    width: "100%",
    alignItems: "center",
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  message: {
    ...typography.bodyMd,
    marginTop: 8,
    lineHeight: 21,
  },
  buttons: {
    gap: 8,
    marginTop: 20,
  },
  button: {
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  buttonText: {
    ...typography.bodyMd,
    fontWeight: "700",
  },
});
