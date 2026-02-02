import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Platform, AppState } from "react-native";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";

import { haptics } from "@/lib/haptics";

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [biometricType, setBiometricType] = useState<string>("Biometrics");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    checkBiometricType();
    // Attempt authentication on mount
    attemptAuthentication();
  }, []);

  const checkBiometricType = async () => {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType(Platform.OS === "ios" ? "Face ID" : "Face Recognition");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType(Platform.OS === "ios" ? "Touch ID" : "Fingerprint");
      } else {
        setBiometricType("Passcode");
      }
    } catch (error) {
      console.error("Error checking biometric type:", error);
    }
  };

  const attemptAuthentication = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Moodinator",
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
        cancelLabel: "Cancel",
      });

      if (result.success) {
        haptics.success();
        onUnlock();
      } else {
        haptics.error();
        if (result.error === "user_cancel") {
          setAuthError("Authentication cancelled");
        } else if (result.error === "lockout") {
          setAuthError("Too many attempts. Please try again later.");
        } else if (result.error === "not_enrolled") {
          setAuthError("No biometrics enrolled. Please set up in device settings.");
        } else {
          setAuthError("Authentication failed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);
      haptics.error();
      setAuthError("An error occurred. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const biometricIcon = biometricType.includes("Face")
    ? "scan-outline"
    : biometricType.includes("Fingerprint") || biometricType.includes("Touch")
    ? "finger-print-outline"
    : "lock-closed-outline";

  return (
    <View
      className="flex-1 items-center justify-center px-8"
      style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
    >
      {/* App Icon / Lock Icon */}
      <View
        className="w-24 h-24 rounded-3xl items-center justify-center mb-8"
        style={{
          backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8",
          shadowColor: isDark ? "#000" : "#9D8660",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.3 : 0.15,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <Ionicons
          name="lock-closed"
          size={48}
          color={isDark ? "#A8C5A8" : "#5B8A5B"}
        />
      </View>

      {/* Title */}
      <Text
        className="text-2xl font-bold mb-2"
        style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
      >
        Moodinator Locked
      </Text>

      <Text
        className="text-center mb-8"
        style={{ color: isDark ? "#BDA77D" : "#6B5C4A" }}
      >
        Use {biometricType} to access your mood journal
      </Text>

      {/* Error Message */}
      {authError && (
        <View className="mb-6 p-3 rounded-xl bg-coral-100 dark:bg-coral-600/20">
          <Text className="text-center text-coral-600 dark:text-coral-300">
            {authError}
          </Text>
        </View>
      )}

      {/* Unlock Button */}
      <TouchableOpacity
        onPress={attemptAuthentication}
        disabled={isAuthenticating}
        className={`flex-row items-center px-8 py-4 rounded-2xl ${
          isAuthenticating ? "opacity-60" : ""
        }`}
        style={{
          backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8",
          shadowColor: isDark ? "#000" : "#9D8660",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}
        activeOpacity={0.8}
      >
        <Ionicons
          name={biometricIcon}
          size={24}
          color={isDark ? "#A8C5A8" : "#5B8A5B"}
        />
        <Text
          className="text-lg font-semibold ml-3"
          style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
        >
          {isAuthenticating ? "Authenticating..." : `Unlock with ${biometricType}`}
        </Text>
      </TouchableOpacity>

      {/* Bottom Text */}
      <Text
        className="mt-8 text-center text-sm"
        style={{ color: isDark ? "#6B5C4A" : "#BDA77D" }}
      >
        Tap the button above to authenticate
      </Text>
    </View>
  );
}
