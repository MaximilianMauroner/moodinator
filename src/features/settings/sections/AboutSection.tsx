import React from "react";
import { Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SectionHeader } from "../components/SectionHeader";
import { SettingCard } from "../components/SettingCard";
import { SettingRow } from "../components/SettingRow";

const APP_VERSION = "1.0.0";
const SUPPORT_EMAIL = "support.moodinator@lab4code.com";
const ANDROID_PACKAGE = "com.lab4code.moodinator";

export function AboutSection() {
  const router = useRouter();

  const handlePrivacyPress = () => {
    router.push("/settings/privacy-policy");
  };

  const handleContactPress = async () => {
    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=Moodinator%20Support`;
    try {
      const supported = await Linking.canOpenURL(mailUrl);
      if (supported) {
        await Linking.openURL(mailUrl);
      } else {
        Alert.alert("Contact Support", `Email us at ${SUPPORT_EMAIL}`);
      }
    } catch {
      Alert.alert("Contact Support", `Email us at ${SUPPORT_EMAIL}`);
    }
  };

  const handleRatePress = async () => {
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
    <>
      <SectionHeader title="About" icon="book-outline" />
      <SettingCard>
        <SettingRow
          label="Version"
          subLabel={`Moodinator v${APP_VERSION}`}
          icon="information-circle-outline"
        />
        <SettingRow
          label="Privacy Policy"
          subLabel="View our privacy practices"
          icon="shield-checkmark-outline"
          onPress={handlePrivacyPress}
        />
        <SettingRow
          label="Contact Support"
          subLabel="Get help or send feedback"
          icon="mail-outline"
          onPress={handleContactPress}
        />
        <SettingRow
          label="Rate App"
          subLabel="Help us improve with your review"
          icon="star-outline"
          onPress={handleRatePress}
          isLast
        />
      </SettingCard>
    </>
  );
}
