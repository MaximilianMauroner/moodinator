import React from "react";
import { View, Text, ScrollView, Alert, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";
import { IconBadge } from "@/components/ui/IconBadge";
import { typography } from "@/constants/typography";

const SUPPORT_EMAIL = "support.moodinator@lab4code.com";
const ANDROID_PACKAGE = "com.lab4code.moodinator";

export default function AboutSettingsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const appVersion =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    "1.1.0";
  const buildVersion =
    Application.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    "dev";
  const appName = Application.applicationName || "Moodinator";

  const handlePrivacyPolicy = () => {
    router.push("/settings/privacy-policy");
  };

  const handleTermsOfService = () => {
    router.push("/settings/terms-of-service");
  };

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      Alert.alert("Contact Support", `Email: ${SUPPORT_EMAIL}`);
    });
  };

  const handleRateApp = async () => {
    const storeUrl = `market://details?id=${ANDROID_PACKAGE}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    try {
      const supported = await Linking.canOpenURL(storeUrl);
      await Linking.openURL(supported ? storeUrl : webUrl);
    } catch {
      Alert.alert("Rate Moodinator", webUrl);
    }
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
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* App branding card */}
        <View className="mx-4 mb-6 p-6 rounded-3xl items-center bg-dusk-100 dark:bg-dusk-800">
          <View
            pointerEvents="none"
            style={[
              styles.brandGlow,
              { backgroundColor: isDark ? "rgba(132, 117, 150, 0.18)" : "rgba(132, 117, 150, 0.12)" },
            ]}
          />
          {/* App icon */}
          <View
            className="w-20 h-20 rounded-3xl items-center justify-center mb-4 bg-dusk-200 dark:bg-dusk-700"
            style={isDark ? styles.iconShadowDark : styles.iconShadowLight}
          >
            <IconBadge icon="sparkles-outline" tone="dusk" size="lg" />
          </View>

          <Text
            className="text-paper-800 dark:text-paper-200 mb-1 tracking-tight"
            style={typography.titleMd}
          >
            {appName}
          </Text>

          <Text className="text-sand-500 dark:text-sand-400 mb-4" style={typography.bodyMd}>
            Version {appVersion}
          </Text>

          <Text className="text-center text-sand-500 dark:text-sand-400 px-4" style={typography.bodySm}>
            Track your moods, understand your patterns, and gain insights into your emotional wellbeing.
          </Text>
        </View>

        <SettingsSection title="Information">
          <SettingRow
            label="Version"
            subLabel={`${appName} v${appVersion}`}
            icon="information-circle-outline"
          />
          <SettingRow
            label="Build"
            subLabel={String(buildVersion)}
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
            onPress={handleTermsOfService}
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
            Made for your mental wellness
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -42,
  },
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
