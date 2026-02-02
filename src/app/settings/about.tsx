import React from "react";
import { View, Text, ScrollView, Alert, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";

export default function AboutSettingsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const handlePrivacyPolicy = () => {
    Alert.alert("Privacy Policy", "Privacy policy link coming soon.");
  };

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@moodinator.app").catch(() => {
      Alert.alert("Contact Support", "Email: support@moodinator.app");
    });
  };

  const handleRateApp = () => {
    Alert.alert("Rate App", "Rating feature coming soon! Thank you for your interest.");
  };

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="About"
        subtitle="Information"
        icon="information-circle-outline"
        accentColor="dusk"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* App branding card */}
        <View className="mx-4 mb-6 p-6 rounded-3xl items-center bg-dusk-100 dark:bg-dusk-800">
          {/* App icon */}
          <View
            className="w-20 h-20 rounded-3xl items-center justify-center mb-4 bg-dusk-200 dark:bg-dusk-700"
            style={isDark ? styles.iconShadowDark : styles.iconShadowLight}
          >
            <Text className="text-4xl">🎭</Text>
          </View>

          <Text className="text-2xl font-bold text-paper-800 dark:text-paper-200 mb-1 tracking-tight">
            Moodinator
          </Text>

          <Text className="text-sm text-sand-500 dark:text-sand-400 mb-4">
            Version 1.0.0
          </Text>

          <Text className="text-xs text-center text-sand-500 dark:text-sand-400 px-4">
            Track your moods, understand your patterns, and gain insights into your emotional wellbeing.
          </Text>
        </View>

        <SettingsSection title="Information">
          <SettingRow
            label="Version"
            subLabel="Moodinator v1.0.0"
            icon="information-circle-outline"
          />
          <SettingRow
            label="Build"
            subLabel="2024.1"
            icon="hammer-outline"
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Legal">
          <SettingRow
            label="Privacy Policy"
            subLabel="View our privacy practices"
            icon="shield-checkmark-outline"
            onPress={handlePrivacyPolicy}
          />
          <SettingRow
            label="Terms of Service"
            subLabel="View terms and conditions"
            icon="document-text-outline"
            onPress={() => Alert.alert("Terms of Service", "Coming soon.")}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Support">
          <SettingRow
            label="Contact Support"
            subLabel="Get help or send feedback"
            icon="mail-outline"
            onPress={handleContactSupport}
          />
          <SettingRow
            label="Rate App"
            subLabel="Help us improve with your review"
            icon="star-outline"
            onPress={handleRateApp}
            isLast
          />
        </SettingsSection>

        {/* Footer */}
        <View className="items-center mt-6 px-4">
          <Text className="text-xs text-sand-400 dark:text-sand-600 text-center">
            Made with 💜 for your mental wellness
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  iconShadowLight: {
    shadowColor: "#847596",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  iconShadowDark: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
