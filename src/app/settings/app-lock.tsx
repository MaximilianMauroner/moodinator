import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";

import { useSettingsStore } from "@/shared/state/settingsStore";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { ToggleRow } from "@/features/settings/components/ToggleRow";
import { haptics } from "@/lib/haptics";

export default function AppLockSettingsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const hydrate = useSettingsStore((state) => state.hydrate);
  const appLockEnabled = useSettingsStore((state) => state.appLockEnabled);
  const setAppLockEnabled = useSettingsStore((state) => state.setAppLockEnabled);

  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      // Check if hardware supports biometrics
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsSupported(compatible);

      if (!compatible) {
        return;
      }

      // Check if user has enrolled biometrics
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsEnrolled(enrolled);

      // Get available authentication types
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType(Platform.OS === "ios" ? "Face ID" : "Face Recognition");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType(Platform.OS === "ios" ? "Touch ID" : "Fingerprint");
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricType("Iris");
      } else {
        setBiometricType("Device Passcode");
      }
    } catch (error) {
      console.error("Error checking biometric support:", error);
      setIsSupported(false);
    }
  };

  const handleToggleAppLock = useCallback(async (enabled: boolean) => {
    if (enabled) {
      // Verify biometrics before enabling
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Verify your identity to enable App Lock",
          fallbackLabel: "Use Passcode",
          disableDeviceFallback: false,
        });

        if (result.success) {
          haptics.success();
          await setAppLockEnabled(true);
          Alert.alert(
            "App Lock Enabled",
            "You will need to authenticate each time you open the app."
          );
        } else {
          haptics.error();
          if (result.error === "user_cancel") {
            // User cancelled, don't show error
          } else {
            Alert.alert("Authentication Failed", "Please try again.");
          }
        }
      } catch (error) {
        console.error("Authentication error:", error);
        haptics.error();
        Alert.alert("Error", "Failed to enable app lock. Please try again.");
      }
    } else {
      // Verify biometrics before disabling
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Verify your identity to disable App Lock",
          fallbackLabel: "Use Passcode",
          disableDeviceFallback: false,
        });

        if (result.success) {
          haptics.light();
          await setAppLockEnabled(false);
          Alert.alert("App Lock Disabled", "You can now open the app without authentication.");
        } else {
          haptics.error();
          if (result.error !== "user_cancel") {
            Alert.alert("Authentication Failed", "Please try again.");
          }
        }
      } catch (error) {
        console.error("Authentication error:", error);
        haptics.error();
        Alert.alert("Error", "Failed to disable app lock. Please try again.");
      }
    }
  }, [setAppLockEnabled]);

  const biometricIcon = biometricType?.includes("Face")
    ? "scan-outline"
    : biometricType?.includes("Fingerprint") || biometricType?.includes("Touch")
    ? "finger-print-outline"
    : "lock-closed-outline";

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="App Lock"
        subtitle="Privacy"
        icon="lock-closed-outline"
        accentColor="dusk"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <View
          className={`mx-4 mb-4 p-4 rounded-2xl ${
            appLockEnabled
              ? "bg-sage-100 dark:bg-sage-600/20"
              : "bg-sand-100 dark:bg-sand-600/20"
          }`}
        >
          <View className="flex-row items-center mb-2">
            <View
              className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                appLockEnabled
                  ? "bg-sage-500/20 dark:bg-sage-500/30"
                  : "bg-sand-500/20 dark:bg-sand-500/30"
              }`}
            >
              <Ionicons
                name={appLockEnabled ? "shield-checkmark-outline" : "shield-outline"}
                size={22}
                color={
                  appLockEnabled
                    ? isDark ? "#A8C5A8" : "#5B8A5B"
                    : isDark ? "#D4C4A0" : "#7A6545"
                }
              />
            </View>
            <View className="flex-1">
              <Text
                className={`text-base font-bold ${
                  appLockEnabled
                    ? "text-sage-600 dark:text-sage-300"
                    : "text-sand-600 dark:text-sand-300"
                }`}
              >
                {appLockEnabled ? "App Lock is Enabled" : "App Lock is Disabled"}
              </Text>
              <Text
                className={`text-sm ${
                  appLockEnabled
                    ? "text-sage-500 dark:text-sage-400"
                    : "text-sand-500 dark:text-sand-400"
                }`}
              >
                {appLockEnabled
                  ? `Using ${biometricType || "device authentication"}`
                  : "Your data is accessible without authentication"}
              </Text>
            </View>
          </View>
        </View>

        {/* Biometric Support Info */}
        {!isSupported && (
          <View className="mx-4 mb-4 p-4 rounded-2xl bg-coral-100 dark:bg-coral-600/20">
            <View className="flex-row items-center">
              <Ionicons
                name="warning-outline"
                size={20}
                color={isDark ? "#F5A899" : "#C75441"}
              />
              <Text className="text-sm ml-2 text-coral-600 dark:text-coral-300">
                Biometric authentication is not available on this device.
              </Text>
            </View>
          </View>
        )}

        {isSupported && !isEnrolled && (
          <View className="mx-4 mb-4 p-4 rounded-2xl bg-sand-100 dark:bg-sand-600/20">
            <View className="flex-row items-center">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={isDark ? "#D4C4A0" : "#7A6545"}
              />
              <Text className="text-sm ml-2 flex-1 text-sand-600 dark:text-sand-300">
                No biometrics enrolled. Please set up {biometricType} in your device settings to use App Lock.
              </Text>
            </View>
          </View>
        )}

        {/* App Lock Toggle */}
        <SettingsSection title="Security">
          <ToggleRow
            title="Require Authentication"
            description={
              isSupported && isEnrolled
                ? `Use ${biometricType} to unlock the app`
                : isSupported
                ? `Set up ${biometricType} in device settings first`
                : "Not available on this device"
            }
            value={appLockEnabled}
            onChange={handleToggleAppLock}
            icon={biometricIcon}
            disabled={!isSupported || !isEnrolled}
            isLast
          />
        </SettingsSection>

        {/* Information */}
        <View className="mx-4 mt-4 p-4 rounded-2xl bg-dusk-100 dark:bg-dusk-600/20">
          <View className="flex-row items-center mb-3">
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={isDark ? "#C4BBCF" : "#695C78"}
            />
            <Text className="text-sm font-medium ml-2 text-dusk-600 dark:text-dusk-300">
              How App Lock Works
            </Text>
          </View>
          <View className="gap-2">
            <View className="flex-row">
              <Text className="text-dusk-500 dark:text-dusk-400 mr-2">1.</Text>
              <Text className="text-sm flex-1 text-dusk-500 dark:text-dusk-400">
                When enabled, you'll need to authenticate each time you open the app.
              </Text>
            </View>
            <View className="flex-row">
              <Text className="text-dusk-500 dark:text-dusk-400 mr-2">2.</Text>
              <Text className="text-sm flex-1 text-dusk-500 dark:text-dusk-400">
                If you switch to another app and come back, you'll need to authenticate again.
              </Text>
            </View>
            <View className="flex-row">
              <Text className="text-dusk-500 dark:text-dusk-400 mr-2">3.</Text>
              <Text className="text-sm flex-1 text-dusk-500 dark:text-dusk-400">
                Your device passcode can be used as a fallback if biometrics fail.
              </Text>
            </View>
          </View>
        </View>

        {/* Privacy Note */}
        <View className="mx-4 mt-4 p-4 rounded-2xl bg-paper-50 dark:bg-paper-850">
          <View className="flex-row items-center mb-2">
            <Ionicons
              name="shield-outline"
              size={18}
              color={isDark ? "#A8C5A8" : "#5B8A5B"}
            />
            <Text className="text-sm font-medium ml-2 text-sage-600 dark:text-sage-300">
              Privacy Note
            </Text>
          </View>
          <Text className="text-sm text-sand-500 dark:text-sand-400 leading-5">
            App Lock protects your mood data from unauthorized access. All your data remains
            stored locally on your device - enabling App Lock adds an extra layer of security
            without sending any data externally.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
