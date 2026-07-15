import React, { useEffect, useCallback } from "react";
import { ActivityIndicator, Pressable, View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import { useAppLockStore, useBiometrics } from "@/features/appLock";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";
import { ToggleRow } from "@/features/settings/components/ToggleRow";
import { Alert } from "@/components/ui/AppAlert";

export default function SecuritySettingsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const {
    hydrated,
    hydrationError,
    hydrate,
    isEnabled,
    biometricsEnabled,
    hasPinSet,
    pinLength,
  } = useAppLockStore();

  const {
    isChecking: biometricsChecking,
    isAvailable: biometricsAvailable,
    isEnrolled: biometricsEnrolled,
    getBiometricLabel,
  } = useBiometrics();

  const canUseBiometrics = biometricsAvailable && biometricsEnrolled;

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrate, hydrated]);

  const handleToggleAppLock = useCallback(
    (enabled: boolean) => {
      if (enabled && !hasPinSet) {
        router.push("./setup-pin");
      } else {
        router.push({
          pathname: "./setup-pin",
          params: { action: enabled ? "enable" : "disable" },
        });
      }
    },
    [hasPinSet]
  );

  const handleChangePin = useCallback(() => {
    router.push({ pathname: "./setup-pin", params: { action: "change" } });
  }, []);

  const handleClearPin = useCallback(() => {
    Alert.alert(
      "Remove PIN",
      "This will disable app lock and remove your PIN. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            router.push({ pathname: "./setup-pin", params: { action: "remove" } });
          },
        },
      ]
    );
  }, []);

  const handleToggleBiometrics = useCallback((enabled: boolean) => {
    router.push({
      pathname: "./setup-pin",
      params: { action: "biometrics", value: String(enabled) },
    });
  }, []);

  if (!hydrated || hydrationError) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
        <SettingsPageHeader
          title="Security"
          subtitle="Privacy"
          icon="shield-checkmark-outline"
          accentColor="sage"
        />
        <View className="flex-1 items-center justify-center">
          {hydrationError ? (
            <>
              <Ionicons name="warning-outline" size={30} color={isDark ? "#F2B4A6" : "#A53F30"} />
              <Text accessibilityRole="header" className="mt-3 text-lg font-semibold text-paper-800 dark:text-paper-100">
                Security settings unavailable
              </Text>
              <Text className="mt-2 px-8 text-sm text-center text-paper-700 dark:text-paper-300">
                Moodinator could not safely read your app lock settings.
              </Text>
              <Pressable
                onPress={() => void hydrate()}
                className="mt-5 min-h-11 px-6 rounded-xl items-center justify-center bg-sage-600 dark:bg-sage-400"
                accessibilityRole="button"
                accessibilityLabel="Retry loading security settings"
              >
                <Text className="font-semibold text-white dark:text-paper-900">Try again</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color={isDark ? "#A8C5A8" : "#5B8A5B"} />
              <Text className="mt-3 text-sm text-paper-700 dark:text-sand-400">Loading security settings…</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Security"
        subtitle="Privacy"
        icon="shield-checkmark-outline"
        accentColor="sage"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-sage-100 dark:bg-sage-800/30">
          <View className="flex-row items-center mb-2">
            <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#A8C5A8" : "#5B8A5B"} style={{ marginRight: 8 }} />
            <Text className="text-base font-bold text-sage-600 dark:text-sage-400">
              Protect Your Data
            </Text>
          </View>
          <Text className="text-xs text-sage-600 dark:text-sage-400">
            Enable app lock to require authentication when opening Moodinator. Your mood data stays private.
          </Text>
        </View>

        <SettingsSection title="App Lock">
          <ToggleRow
            title="Enable App Lock"
            description={hasPinSet ? "Require PIN or biometrics to open" : "Set up a PIN to enable"}
            value={isEnabled}
            onChange={handleToggleAppLock}
            icon="lock-closed-outline"
          />

          {canUseBiometrics && hasPinSet && (
            <ToggleRow
              title={`Use ${getBiometricLabel()}`}
              description="Unlock with biometrics instead of PIN"
              value={biometricsEnabled}
              onChange={handleToggleBiometrics}
              icon="finger-print"
              isLast={!hasPinSet}
            />
          )}

          {hasPinSet && (
            <>
              <SettingRow
                label="Change PIN"
                subLabel={`Current PIN: ${pinLength} digits`}
                icon="key-outline"
                onPress={handleChangePin}
              />
              <SettingRow
                label="Remove PIN"
                subLabel="Disable app lock completely"
                icon="trash-outline"
                onPress={handleClearPin}
                destructive
                isLast
              />
            </>
          )}
        </SettingsSection>

        {!biometricsChecking && !canUseBiometrics && (
          <View className="mx-4 mt-4 p-4 rounded-2xl bg-sand-100 dark:bg-sand-800/30">
            <View className="flex-row items-center mb-2">
              <Ionicons name="information-circle-outline" size={20} color="#9D8660" style={{ marginRight: 8 }} />
              <Text className="text-sm font-semibold text-paper-700 dark:text-sand-400">
                Biometrics Not Available
              </Text>
            </View>
            <Text className="text-xs text-paper-700 dark:text-sand-400">
              {!biometricsAvailable
                ? "Your device doesn't support biometric authentication."
                : "No biometrics enrolled. Set up biometrics in your device settings to use biometric unlock."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
