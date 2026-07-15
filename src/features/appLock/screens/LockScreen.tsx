import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { BiometricButton } from "../components/BiometricButton";
import { PinDots } from "../components/PinDots";
import { PinPad } from "../components/PinPad";
import { useBiometrics } from "../hooks/useBiometrics";
import { useAppLockStore } from "../store/appLockStore";

function formatLockout(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LockScreen() {
  const { isDark, get } = useThemeColors();
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showPinPad, setShowPinPad] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [lockoutNow, setLockoutNow] = useState(() => Date.now());
  const isAuthenticatingRef = useRef(false);
  const hasAutoPromptedRef = useRef(false);

  const {
    pinLength,
    biometricsEnabled,
    unlock,
    attemptPin,
    resetFailedAttempts,
    failedAttempts,
    lockoutUntil,
  } = useAppLockStore();
  const {
    isAvailable: biometricsAvailable,
    isEnrolled: biometricsEnrolled,
    isChecking: biometricsChecking,
    authenticate,
    getBiometricLabel,
    getBiometricIcon,
  } = useBiometrics();

  const canUseBiometrics = biometricsEnabled && biometricsAvailable && biometricsEnrolled;
  const biometricLabel = getBiometricLabel();
  const lockoutRemainingMs = lockoutUntil ? Math.max(0, lockoutUntil - lockoutNow) : 0;
  const isPinLockedOut = lockoutRemainingMs > 0;
  const isBusy = isSubmittingPin || isAuthenticating;

  useEffect(() => {
    if (biometricsChecking) return;
    if (!canUseBiometrics) setShowPinPad(true);
  }, [biometricsChecking, canUseBiometrics]);

  useEffect(() => {
    if (!isPinLockedOut) {
      setLockoutNow(Date.now());
      return;
    }
    const interval = setInterval(() => setLockoutNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isPinLockedOut]);

  const iconScale = useSharedValue(1);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    iconScale.value = reduceMotion
      ? 1
      : withRepeat(
          withSequence(withTiming(1.02, { duration: 2000 }), withTiming(1, { duration: 2000 })),
          -1,
          true
        );
  }, [iconScale, reduceMotion]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const finalizeSuccessfulAuth = useCallback(() => {
    unlock();
    void resetFailedAttempts().catch((error: unknown) => {
      console.warn("Failed to reset PIN attempt state after successful auth:", error);
    });
  }, [resetFailedAttempts, unlock]);

  const handleBiometricAuth = useCallback(async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    try {
      if (await authenticate()) {
        haptics.unlockSuccess();
        finalizeSuccessfulAuth();
      }
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  }, [authenticate, finalizeSuccessfulAuth]);

  useEffect(() => {
    if (!biometricsChecking && canUseBiometrics && !showPinPad && !hasAutoPromptedRef.current) {
      hasAutoPromptedRef.current = true;
      void handleBiometricAuth();
    }
  }, [biometricsChecking, canUseBiometrics, handleBiometricAuth, showPinPad]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showPinPad && canUseBiometrics && !isBusy) {
        haptics.light();
        setShowPinPad(false);
        setPin("");
        setFeedback(null);
      }
      return true;
    });
    return () => subscription.remove();
  }, [canUseBiometrics, isBusy, showPinPad]);

  const handlePinComplete = useCallback(
    async (enteredPin: string) => {
      if (isPinLockedOut || isSubmittingPin) return;
      setIsSubmittingPin(true);
      setFeedback(null);
      try {
        const result = await attemptPin(enteredPin);
        if (result.status === "success") {
          haptics.unlockSuccess();
          unlock();
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
        setIsSubmittingPin(false);
      }
    },
    [attemptPin, isPinLockedOut, isSubmittingPin, unlock]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (isBusy || isPinLockedOut) return;
      setFeedback(null);
      if (pin.length >= pinLength) return;
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === pinLength) void handlePinComplete(nextPin);
    },
    [handlePinComplete, isBusy, isPinLockedOut, pin, pinLength]
  );

  const handleDeletePress = useCallback(() => {
    if (isBusy) return;
    setFeedback(null);
    setPin((current) => current.slice(0, -1));
  }, [isBusy]);

  if (biometricsChecking) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: get("background") }}>
        <ActivityIndicator color={get("primary")} accessibilityLabel="Checking unlock options" />
      </View>
    );
  }

  const lockoutMessage = isPinLockedOut
    ? `Too many attempts. Try again in ${formatLockout(lockoutRemainingMs)}${
        canUseBiometrics ? ` or use ${biometricLabel}` : ""
      }.`
    : null;

  return (
    <View className="flex-1" style={{ backgroundColor: get("background") }}>
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {!showPinPad ? (
            <View className="items-center">
              <Animated.View style={iconAnimatedStyle}>
                <View
                  className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
                  style={{
                    backgroundColor: isDark ? "rgba(91, 138, 91, 0.15)" : "rgba(91, 138, 91, 0.1)",
                    shadowColor: isDark ? "#000" : "#5B8A5B",
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: isDark ? 0.4 : 0.2,
                    shadowRadius: 24,
                    elevation: 6,
                  }}
                >
                  <Ionicons name="leaf-outline" size={48} color={isDark ? "#A8C5A8" : "#5B8A5B"} />
                </View>
              </Animated.View>
              <Text accessibilityRole="header" className="text-2xl font-bold mb-2" style={{ color: get("text") }}>
                Moodinator is locked
              </Text>
              <Text className="text-sm mb-8 text-center" style={{ color: get("textMuted") }}>
                Unlock with {biometricLabel} to continue
              </Text>
              <BiometricButton
                onPress={handleBiometricAuth}
                label={biometricLabel}
                icon={getBiometricIcon()}
                disabled={isAuthenticating}
              />
              <Pressable
                onPress={() => {
                  haptics.light();
                  setShowPinPad(true);
                }}
                disabled={isAuthenticating}
                className="mt-5 px-5 min-h-11 justify-center"
                accessibilityRole="button"
                accessibilityLabel="Use PIN instead"
                accessibilityState={{ disabled: isAuthenticating }}
              >
                <Text className="text-sm font-semibold" style={{ color: get("textMuted") }}>
                  Use PIN instead
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="w-full max-w-[420px] self-center">
              <View className="items-center">
                <Text accessibilityRole="header" className="text-xl font-bold mb-2" style={{ color: get("text") }}>
                  Enter PIN
                </Text>
                {lockoutMessage ? (
                  <Text
                    selectable
                    accessibilityLiveRegion="assertive"
                    className="text-sm text-center"
                    style={{ color: isDark ? "#F2B4A6" : "#A53F30", fontVariant: ["tabular-nums"] }}
                  >
                    {lockoutMessage}
                  </Text>
                ) : feedback ? (
                  <Text
                    selectable
                    accessibilityLiveRegion="assertive"
                    className="text-sm text-center"
                    style={{ color: isDark ? "#F2B4A6" : "#A53F30" }}
                  >
                    {feedback}
                  </Text>
                ) : failedAttempts > 0 ? (
                  <Text className="text-sm text-center" style={{ color: get("textMuted") }}>
                    {failedAttempts} failed {failedAttempts === 1 ? "attempt" : "attempts"}
                  </Text>
                ) : null}
              </View>

              <PinDots pinLength={pinLength} enteredLength={pin.length} error={Boolean(feedback)} />
              <PinPad
                onDigitPress={handleDigitPress}
                onDeletePress={handleDeletePress}
                disabled={isBusy || isPinLockedOut}
              />

              {canUseBiometrics ? (
                <Pressable
                  onPress={() => {
                    haptics.light();
                    setPin("");
                    setFeedback(null);
                    void handleBiometricAuth();
                  }}
                  disabled={isBusy}
                  className="mt-4 px-5 min-h-11 self-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${biometricLabel} instead`}
                  accessibilityState={{ disabled: isBusy }}
                >
                  <Text className="text-sm font-semibold" style={{ color: isDark ? get("primary") : "#476D47" }}>
                    Use {biometricLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
