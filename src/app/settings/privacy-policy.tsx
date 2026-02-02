import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Privacy Policy"
        subtitle="Your data, your control"
        icon="shield-checkmark-outline"
        accentColor="sage"
      />

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs text-sand-500 dark:text-sand-400 mb-4">
          Last Updated: February 2, 2026
        </Text>

        <Section title="Introduction">
          <Paragraph>
            Moodinator is committed to protecting your privacy. This Privacy Policy explains how we handle your information when you use our mood tracking application.
          </Paragraph>
        </Section>

        <Section title="Data Collection and Storage">
          <Subtitle>What We Collect</Subtitle>
          <Paragraph>
            Moodinator collects and stores the following information that you voluntarily provide:
          </Paragraph>
          <BulletList items={[
            "Mood Entries: Your mood ratings, timestamps, and notes",
            "Emotions: Emotion tags you select for each entry",
            "Contexts: Context tags describing your situation",
            "Photos: Images you attach to mood entries",
            "Voice Notes: Audio recordings you attach to entries",
            "Location Data: Optional location information if enabled",
          ]} />

          <Subtitle>Local-Only Storage</Subtitle>
          <Paragraph>
            All your data is stored locally on your device. We do not upload, transmit, or store your personal data on any external servers. Your mood entries, photos, voice notes, and all other information remain exclusively on your device.
          </Paragraph>

          <Subtitle>No Account Required</Subtitle>
          <Paragraph>
            Moodinator does not require you to create an account. There is no registration, no email collection, and no cloud synchronization.
          </Paragraph>
        </Section>

        <Section title="Data Sharing">
          <Paragraph>
            We do not share your data with anyone. Since all data is stored locally on your device:
          </Paragraph>
          <BulletList items={[
            "No data is sent to our servers",
            "No data is shared with third parties",
            "No data is used for advertising or analytics",
            "No data is sold to anyone",
          ]} />
        </Section>

        <Section title="Your Control Over Your Data">
          <Paragraph>
            You have complete control over your data:
          </Paragraph>
          <BulletList items={[
            "Export: Export your data anytime from Settings > Data",
            "Delete: Delete individual entries or all data",
            "Backup: Create local backups stored on your device",
          ]} />
        </Section>

        <Section title="Third-Party Services">
          <Paragraph>
            Moodinator does not integrate with any third-party analytics, advertising, or tracking services. The app functions entirely offline.
          </Paragraph>
        </Section>

        <Section title="Data Security">
          <Paragraph>
            Your data is protected by your device's security features. We recommend using a device passcode or biometric lock, keeping your device updated, and not sharing your unlocked device with others.
          </Paragraph>
        </Section>

        <Section title="Children's Privacy">
          <Paragraph>
            Moodinator is not directed at children under 13. We do not knowingly collect personal information from children under 13.
          </Paragraph>
        </Section>

        <Section title="Changes to This Policy">
          <Paragraph>
            We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date at the top of this policy.
          </Paragraph>
        </Section>

        <Section title="Contact Us">
          <Paragraph>
            If you have any questions about this Privacy Policy, please contact us at support.moodinator@lab4code.com
          </Paragraph>
        </Section>

        <View className="mt-6 p-4 rounded-2xl bg-sage-100 dark:bg-sage-900">
          <Text className="text-sm font-semibold text-sage-700 dark:text-sage-300 mb-2">
            Summary
          </Text>
          <BulletList
            items={[
              "All data stays on your device",
              "No accounts, no cloud, no tracking",
              "You own and control your data completely",
              "Export or delete your data anytime",
            ]}
            color="sage"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-lg font-semibold text-paper-800 dark:text-paper-200 mb-2">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Subtitle({ children }: { children: string }) {
  return (
    <Text className="text-base font-medium text-paper-700 dark:text-paper-300 mt-3 mb-1">
      {children}
    </Text>
  );
}

function Paragraph({ children }: { children: string }) {
  return (
    <Text className="text-sm text-paper-600 dark:text-paper-400 leading-5 mb-2">
      {children}
    </Text>
  );
}

function BulletList({ items, color = "paper" }: { items: string[]; color?: "paper" | "sage" }) {
  const textColor = color === "sage"
    ? "text-sage-700 dark:text-sage-300"
    : "text-paper-600 dark:text-paper-400";

  return (
    <View className="ml-2">
      {items.map((item, index) => (
        <View key={index} className="flex-row mb-1">
          <Text className={`text-sm ${textColor} mr-2`}>•</Text>
          <Text className={`text-sm ${textColor} flex-1 leading-5`}>{item}</Text>
        </View>
      ))}
    </View>
  );
}
