import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";

export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Terms of Service"
        subtitle="Usage agreement"
        icon="document-text-outline"
        accentColor="dusk"
      />

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs text-sand-500 dark:text-sand-400 mb-4">
          Last Updated: February 2, 2026
        </Text>

        <Section title="Agreement to Terms">
          <Paragraph>
            By downloading, installing, or using Moodinator, you agree to be bound by these Terms of Service. If you do not agree to these Terms, do not use the app.
          </Paragraph>
        </Section>

        <Section title="Description of Service">
          <Paragraph>
            Moodinator is a personal mood tracking application that allows you to:
          </Paragraph>
          <BulletList items={[
            "Record daily mood entries on a 0-10 scale",
            "Tag entries with emotions and contexts",
            "Attach photos, voice notes, and location data",
            "View analytics and insights about your mood patterns",
            "Export your data for personal use",
          ]} />
        </Section>

        <Section title="Use of the App">
          <Subtitle>Permitted Use</Subtitle>
          <Paragraph>
            You may use Moodinator for personal, non-commercial purposes to track and understand your emotional wellbeing.
          </Paragraph>

          <Subtitle>Prohibited Use</Subtitle>
          <Paragraph>
            You agree not to use the app for any unlawful purpose, attempt to reverse engineer the app, remove proprietary notices, or use the app in any way that could damage its functionality.
          </Paragraph>
        </Section>

        <Section title="Your Data">
          <Subtitle>Ownership</Subtitle>
          <Paragraph>
            You retain full ownership of all data you create within the app, including mood entries, notes, photos, and voice recordings.
          </Paragraph>

          <Subtitle>Local Storage</Subtitle>
          <Paragraph>
            All data is stored locally on your device. You are responsible for backing up your data regularly, maintaining device security, and any data loss due to device failure or accidental deletion.
          </Paragraph>

          <Subtitle>No Recovery</Subtitle>
          <Paragraph>
            Since we do not store your data on any servers, we cannot recover lost data. We strongly recommend using the app's export and backup features regularly.
          </Paragraph>
        </Section>

        <View className="my-4 p-4 rounded-2xl bg-coral-100 dark:bg-coral-900">
          <Text className="text-sm font-semibold text-coral-700 dark:text-coral-300 mb-2">
            Medical Disclaimer
          </Text>
          <Text className="text-sm text-coral-600 dark:text-coral-400 leading-5 mb-2">
            Moodinator is not a medical device or healthcare service. The app is intended for personal wellness tracking only and does not provide medical advice, diagnosis, or treatment.
          </Text>
          <Text className="text-sm text-coral-600 dark:text-coral-400 leading-5 font-medium">
            If you are experiencing a mental health crisis, please contact a healthcare professional or crisis helpline immediately.
          </Text>
        </View>

        <Section title="Intellectual Property">
          <Paragraph>
            Moodinator and its original content, features, and functionality are protected by international copyright, trademark, and other intellectual property laws. You retain all rights to the personal data and content you create within the app.
          </Paragraph>
        </Section>

        <Section title="Disclaimers">
          <Paragraph>
            The app is provided "as is" and "as available" without warranties of any kind. We do not guarantee that the app will meet your specific requirements, be uninterrupted or error-free, or that any errors will be corrected.
          </Paragraph>
        </Section>

        <Section title="Limitation of Liability">
          <Paragraph>
            To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, loss of profits, or personal injury arising from your use of the app.
          </Paragraph>
        </Section>

        <Section title="Changes to Terms">
          <Paragraph>
            We reserve the right to modify these Terms at any time. Your continued use of the app after any changes constitutes acceptance of the new Terms.
          </Paragraph>
        </Section>

        <Section title="Termination">
          <Paragraph>
            You may stop using the app at any time by uninstalling it from your device. Upon uninstallation, all locally stored data will be deleted unless you have created external backups.
          </Paragraph>
        </Section>

        <Section title="Contact Us">
          <Paragraph>
            If you have any questions about these Terms, please contact us at support.moodinator@lab4code.com
          </Paragraph>
        </Section>

        <View className="mt-4 p-4 rounded-2xl bg-dusk-100 dark:bg-dusk-800">
          <Text className="text-sm text-dusk-600 dark:text-dusk-300 text-center">
            By using Moodinator, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </Text>
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

function BulletList({ items }: { items: string[] }) {
  return (
    <View className="ml-2">
      {items.map((item, index) => (
        <View key={index} className="flex-row mb-1">
          <Text className="text-sm text-paper-600 dark:text-paper-400 mr-2">•</Text>
          <Text className="text-sm text-paper-600 dark:text-paper-400 flex-1 leading-5">{item}</Text>
        </View>
      ))}
    </View>
  );
}
