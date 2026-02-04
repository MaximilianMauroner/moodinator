import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { useAppLockStore } from "../store/appLockStore";
import { useBiometrics } from "../hooks/useBiometrics";
import { PinDots } from "../components/PinDots";
import { PinPad } from "../components/PinPad";
import { BiometricButton } from "../components/BiometricButton";

export function LockScreen() {
  const { isDark, get } = useThemeColors();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);

  const {
    pinLength,
    biometricsEnabled,
    unlock,
    verifyPin,
    incrementFailedAttempts,
    resetFailedAttempts,
    failedAttempts,
  } = useAppLockStore();

  const {
    isAvailable: biometricsAvailable,
    isEnrolled: biometricsEnrolled,
    authenticate,
    getBiometricLabel,
    getBiometricIcon,
  } = useBiometrics();

  const canUseBiometrics = biometricsEnabled && biometricsAvailable && biometricsEnrolled;

  // App icon pulse animation
  const iconScale = useSharedValue(1);

  useEffect(() => {
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
  }, [iconScale]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const handleBiometricAuth = useCallback(async () => {
    const success = await authenticate();
    if (success) {
      haptics.unlockSuccess();
      resetFailedAttempts();
      unlock();
    }
  }, [authenticate, unlock, resetFailedAttempts]);

  // Auto-trigger biometric on mount
  useEffect(() => {
    if (canUseBiometrics && !showPinPad) {
      handleBiometricAuth();
    }
  }, [canUseBiometrics, showPinPad, handleBiometricAuth]);

  const handlePinComplete = useCallback(
    async (enteredPin: string) => {
      const isValid = await verifyPin(enteredPin);
      if (isValid) {
        haptics.unlockSuccess();
        resetFailedAttempts();
        unlock();
      } else {
        haptics.pinError();
        setError(true);
        incrementFailedAttempts();
        setPin("");
        setTimeout(() => setError(false), 500);
      }
    },
    [verifyPin, unlock, incrementFailedAttempts, resetFailedAttempts]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (pin.length < pinLength) {
        const newPin = pin + digit;
        setPin(newPin);
        if (newPin.length === pinLength) {
          handlePinComplete(newPin);
        }
      }
    },
    [pin, pinLength, handlePinComplete]
  );

  const handleDeletePress = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  return (
    <BlurView
      intensity={isDark ? 80 : 60}
      tint={isDark ? "dark" : "light"}
      className="flex-1"
    >
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-1 justify-center items-center px-8">
          {!showPinPad ? (
            // Biometric view
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
                  <Text className="text-5xl">🌿</Text>
                </View>
              </Animated.View>

              <Text
                className="text-2xl font-bold mb-2"
                style={{ color: get("text") }}
              >
                Moodinator
              </Text>
              <Text
                className="text-sm mb-12 text-center"
                style={{ color: get("textMuted") }}
              >
                Your personal mood companion
              </Text>

              {canUseBiometrics && (
                <BiometricButton
                  onPress={handleBiometricAuth}
                  label={getBiometricLabel()}
                  icon={getBiometricIcon()}
                />
              )}

              <Pressable
                onPress={() => {
                  haptics.light();
                  setShowPinPad(true);
                }}
                className="mt-8"
                accessibilityRole="button"
                accessibilityLabel="Use PIN instead"
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: get("textMuted") }}
                >
                  Use PIN
                </Text>
              </Pressable>
            </View>
          ) : (
            // PIN pad view
            <View className="flex-1 justify-center">
              <View className="items-center mb-8">
                <Text
                  className="text-xl font-bold mb-2"
                  style={{ color: get("text") }}
                >
                  Enter PIN
                </Text>
                {failedAttempts > 0 && (
                  <Text
                    className="text-sm"
                    style={{ color: isDark ? "#ED8370" : "#E06B55" }}
                  >
                    {failedAttempts} failed {failedAttempts === 1 ? "attempt" : "attempts"}
                  </Text>
                )}
              </View>

              <PinDots pinLength={pinLength} enteredLength={pin.length} error={error} />

              <PinPad
                onDigitPress={handleDigitPress}
                onDeletePress={handleDeletePress}
                disabled={error}
              />

              {canUseBiometrics && (
                <Pressable
                  onPress={() => {
                    haptics.light();
                    setShowPinPad(false);
                    setPin("");
                    handleBiometricAuth();
                  }}
                  className="mt-8 self-center"
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${getBiometricLabel()} instead`}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: get("primary") }}
                  >
                    Use {getBiometricLabel()}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </BlurView>
  );
}
