import React, { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Alert } from "@/components/ui/AppAlert";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { PinDots } from "../components/PinDots";
import { PinPad } from "../components/PinPad";
import { useAppLockStore } from "../store/appLockStore";

type SetupStep = "verify" | "create" | "confirm";
type SetupAction = "change" | "enable" | "disable" | "remove" | "biometrics";

function formatLockout(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SetupPinScreen() {
  const { isDark, get } = useThemeColors();
  const params = useLocalSearchParams<{ action?: string; value?: string }>();
  const {
    pinLength,
    lockoutUntil,
    hasPinSet,
    setPin: savePin,
    setEnabled,
    setBiometricsEnabled,
    clearPin,
    attemptPin,
  } = useAppLockStore();
  const action: SetupAction =
    params.action === "enable" ||
    params.action === "disable" ||
    params.action === "remove" ||
    params.action === "biometrics"
      ? params.action
      : "change";
  const [step, setStep] = useState<SetupStep>(hasPinSet ? "verify" : "create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lockoutNow, setLockoutNow] = useState(() => Date.now());
  const lockoutRemainingMs = lockoutUntil ? Math.max(0, lockoutUntil - lockoutNow) : 0;
  const isLockedOut = step === "verify" && lockoutRemainingMs > 0;

  useEffect(() => {
    if (!isLockedOut) {
      setLockoutNow(Date.now());
      return;
    }
    const timer = setInterval(() => setLockoutNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLockedOut]);

  const stepTitle =
    step === "verify" ? "Enter current PIN" : step === "create" ? "Create PIN" : "Confirm PIN";
  const stepDescription =
    step === "verify"
      ? "Verify your identity to change security settings"
      : step === "create"
        ? `Enter a ${pinLength}-digit PIN`
        : "Enter your PIN again to confirm";

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${stepTitle}. ${stepDescription}`);
  }, [stepDescription, stepTitle]);

  const finishAction = useCallback(
    async (verified: boolean) => {
      if (hasPinSet && !verified) return;
      if (action === "change") {
        setPin("");
        setFeedback(null);
        setStep("create");
        return;
      }

      setIsBusy(true);
      try {
        if (action === "enable") await setEnabled(true);
        if (action === "disable") await setEnabled(false);
        if (action === "remove") await clearPin();
        if (action === "biometrics") await setBiometricsEnabled(params.value === "true");
        haptics.success();
        router.back();
      } catch (error: unknown) {
        console.error("Failed to update app lock setting:", error);
        const message = "That setting could not be updated. Please try again.";
        setFeedback(message);
        AccessibilityInfo.announceForAccessibility(message);
      } finally {
        setIsBusy(false);
      }
    },
    [action, clearPin, hasPinSet, params.value, setBiometricsEnabled, setEnabled]
  );

  const verifyCurrentPin = useCallback(
    async (candidate: string) => {
      setIsBusy(true);
      setFeedback(null);
      try {
        const result = await attemptPin(candidate);
        if (result.status === "success") {
          haptics.success();
          await finishAction(true);
          return;
        }
        haptics.pinError();
        setPin("");
        if (result.status === "invalid") {
          const message = "Incorrect PIN. Try again.";
          setFeedback(message);
          AccessibilityInfo.announceForAccessibility(message);
        } else if (result.status === "error") {
          const message = "PIN verification failed. Please try again.";
          setFeedback(message);
          AccessibilityInfo.announceForAccessibility(message);
        } else if (result.status === "locked") {
          setPin("");
          setFeedback(null);
        } else if (result.status === "busy") {
          setPin("");
          const message = "PIN verification is already in progress.";
          setFeedback(message);
          AccessibilityInfo.announceForAccessibility(message);
        }
      } finally {
        setIsBusy(false);
      }
    },
    [attemptPin, finishAction]
  );

  const saveNewPin = useCallback(
    async (newPin: string) => {
      setIsBusy(true);
      setFeedback(null);
      try {
        await savePin(newPin);
        if (!hasPinSet) await setEnabled(true);
        haptics.success();
        Alert.alert(
          hasPinSet ? "PIN changed" : "PIN set",
          hasPinSet
            ? "Your app lock PIN has been changed."
            : "Moodinator is now protected with a PIN.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } catch (error: unknown) {
        console.error("Failed to save app lock PIN:", error);
        const message = "Your PIN could not be saved. Please try again.";
        setFeedback(message);
        AccessibilityInfo.announceForAccessibility(message);
      } finally {
        setIsBusy(false);
      }
    },
    [hasPinSet, savePin, setEnabled]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (isBusy || isLockedOut) return;
      setFeedback(null);
      if (step === "verify") {
        if (pin.length >= pinLength) return;
        const candidate = pin + digit;
        setPin(candidate);
        if (candidate.length === pinLength) void verifyCurrentPin(candidate);
        return;
      }
      if (step === "create") {
        if (pin.length >= pinLength) return;
        const candidate = pin + digit;
        setPin(candidate);
        if (candidate.length === pinLength) {
          setConfirmPin("");
          setStep("confirm");
        }
        return;
      }
      if (confirmPin.length >= pinLength) return;
      const candidate = confirmPin + digit;
      setConfirmPin(candidate);
      if (candidate.length !== pinLength) return;
      if (candidate === pin) {
        void saveNewPin(pin);
      } else {
        haptics.pinError();
        setConfirmPin("");
        const message = "PINs do not match. Try again.";
        setFeedback(message);
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [confirmPin, isBusy, isLockedOut, pin, pinLength, saveNewPin, step, verifyCurrentPin]
  );

  const handleDeletePress = useCallback(() => {
    if (isBusy) return;
    setFeedback(null);
    if (step === "confirm") setConfirmPin((current) => current.slice(0, -1));
    else setPin((current) => current.slice(0, -1));
  }, [isBusy, step]);

  const handleBack = useCallback(() => {
    if (isBusy) return;
    setFeedback(null);
    if (step === "confirm") {
      setStep("create");
      setPin("");
      setConfirmPin("");
    } else if (step === "create" && hasPinSet) {
      setStep("verify");
      setPin("");
    } else {
      router.back();
    }
  }, [hasPinSet, isBusy, step]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]);

  const currentPin = step === "confirm" ? confirmPin : pin;
  const message = isLockedOut
    ? `Too many attempts. Try again in ${formatLockout(lockoutRemainingMs)}.`
    : feedback;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: get("background") }} edges={["top", "bottom"]}>
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={handleBack}
          disabled={isBusy}
          className="w-11 h-11 rounded-xl items-center justify-center"
          style={{ backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)" }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityState={{ disabled: isBusy }}
        >
          <Ionicons name="arrow-back" size={24} color={get("text")} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[420px] self-center">
          <View className="items-center">
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: isDark ? "rgba(91, 138, 91, 0.15)" : "rgba(91, 138, 91, 0.1)" }}
              importantForAccessibility="no"
            >
              <Ionicons
                name={step === "confirm" ? "checkmark-circle-outline" : "key-outline"}
                size={30}
                color={get("primary")}
              />
            </View>
            <Text accessibilityRole="header" className="text-xl font-bold mb-2" style={{ color: get("text") }}>
              {stepTitle}
            </Text>
            <Text className="text-sm text-center" style={{ color: get("textMuted") }}>
              {stepDescription}
            </Text>
            {message ? (
              <Text
                selectable
                accessibilityLiveRegion="assertive"
                className="text-sm mt-2 text-center"
                style={{ color: isDark ? "#F2B4A6" : "#A53F30", fontVariant: ["tabular-nums"] }}
              >
                {message}
              </Text>
            ) : null}
          </View>

          <PinDots pinLength={pinLength} enteredLength={currentPin.length} error={Boolean(feedback)} />
          <PinPad
            onDigitPress={handleDigitPress}
            onDeletePress={handleDeletePress}
            disabled={isBusy || isLockedOut}
          />

          {step !== "verify" ? (
            <View
              accessible
              accessibilityLabel={`Step ${step === "create" ? 1 : 2} of 2`}
              className="flex-row justify-center mt-5 gap-2"
            >
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: get("primary") }} />
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: step === "confirm" ? get("primary") : get("border") }}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
