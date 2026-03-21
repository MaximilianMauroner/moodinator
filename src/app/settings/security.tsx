import React, { useEffect, useCallback } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppLockStore, useBiometrics } from "@/features/appLock";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";
import { ToggleRow } from "@/features/settings/components/ToggleRow";

export default function SecuritySettingsScreen() {
  const {
    hydrated,
    hydrate,
    isEnabled,
    biometricsEnabled,
    hasPinSet,
    pinLength,
    setEnabled,
    setBiometricsEnabled,
    clearPin,
  } = useAppLockStore();

  const {
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
    async (enabled: boolean) => {
      if (enabled && !hasPinSet) {
        // Need to set up PIN first
        router.push("./setup-pin");
      } else {
        await setEnabled(enabled);
      }
    },
    [hasPinSet, setEnabled]
  );

  const handleChangePin = useCallback(() => {
    router.push("./setup-pin");
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
          onPress: async () => {
            await clearPin();
            Alert.alert("PIN Removed", "App lock has been disabled.");
          },
        },
      ]
    );
  }, [clearPin]);

  if (!hydrated) {
    return (
      <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
        <SettingsPageHeader
          title="Security"
          subtitle="Privacy"
          icon="shield-checkmark-outline"
          accentColor="sage"
        />
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
            <Text className="text-2xl mr-2">🔒</Text>
            <Text className="text-base font-bold text-sage-600 dark:text-sage-400">
              Protect Your Data
            </Text>
          </View>
          <Text className="text-xs text-sage-500 dark:text-sage-400">
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
              onChange={setBiometricsEnabled}
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

        {!canUseBiometrics && (
          <View className="mx-4 mt-4 p-4 rounded-2xl bg-sand-100 dark:bg-sand-800/30">
            <View className="flex-row items-center mb-2">
              <Text className="text-xl mr-2">ℹ️</Text>
              <Text className="text-sm font-semibold text-sand-600 dark:text-sand-400">
                Biometrics Not Available
              </Text>
            </View>
            <Text className="text-xs text-sand-500 dark:text-sand-400">
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
