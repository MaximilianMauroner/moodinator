import React from "react";
import { Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SectionHeader } from "../components/SectionHeader";
import { SettingCard } from "../components/SettingCard";
import { SettingRow } from "../components/SettingRow";

const APP_VERSION = "1.0.0";
const SUPPORT_EMAIL = "support.moodinator@lab4code.com";

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
    // TODO: Replace with actual app store URLs when published
    Alert.alert(
      "Rate Moodinator",
      "Thank you for wanting to rate the app! This feature will be available once the app is published to the app stores."
    );
  };

  return (
    <>
      <SectionHeader title="About" icon="📖" />
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
