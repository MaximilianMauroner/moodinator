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
        <Text className="text-xs text-paper-700 dark:text-sand-400 mb-4">
          Last Updated: July 21, 2026
        </Text>

        <Section title="Agreement to Terms">
          <Paragraph>
            By downloading, installing, or using Moodinator, you agree to be bound by these Terms of Service. If you do not agree to these Terms, do not use the app.
          </Paragraph>
        </Section>

        <Section title="Description of Service">
          <Paragraph>
            Moodinator is a personal wellness tool that allows you to:
          </Paragraph>
          <BulletList items={[
            "Record moods on a 0–10 scale, where lower is better and 9–10 require the most support",
            "Add notes, emotions, contexts, and energy values",
            "Configure local reminders and view on-device patterns",
            "Create plaintext JSON exports and backups",
          ]} />
        </Section>

        <Section title="Use of the App">
          <Paragraph>
            You may use Moodinator for lawful personal purposes. Do not use it to violate applicable law, interfere with the app, or misrepresent it or its source. Open-source code rights are governed by the MIT License described below.
          </Paragraph>
        </Section>

        <Section title="Your Data">
          <Paragraph>
            You retain your rights in mood entries, notes, tags, settings, exports, and backups you create. Moodinator has no developer-operated account or server copy. You are responsible for device security and protecting plaintext JSON exports and backups.
          </Paragraph>
          <Paragraph>
            Delete Mood Data removes mood entries, mood–emotion links, and the saved emotion list. It retains settings, reminders, app-lock data, context-tag presets, and external exports or backups. Uninstalling normally removes app-sandbox data, but external files remain and platform secure-storage, backup, and transfer behavior can vary. We cannot recover lost data or delete external copies.
          </Paragraph>
        </Section>

        <View className="my-4 p-4 rounded-2xl bg-coral-100 dark:bg-coral-900">
          <Text className="text-sm font-semibold text-coral-700 dark:text-coral-300 mb-2">
            Medical Disclaimer
          </Text>
          <Text className="text-sm text-coral-700 dark:text-coral-400 leading-5 mb-2">
            Moodinator is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. It does not provide medical advice, diagnosis, or treatment. Its ratings, patterns, and insights are informational and may be incomplete or inaccurate. Consult a qualified healthcare professional for medical advice, diagnosis, or treatment.
          </Text>
          <Text className="text-sm text-coral-700 dark:text-coral-400 leading-5 font-medium">
            Moodinator does not monitor entries, provide live crisis support, contact emergency services, or dispatch help. If someone may be in immediate danger, call the local emergency number. In the U.S., call or text 988; elsewhere, findahelpline.com can help locate support.
          </Text>
        </View>

        <Section title="Open-Source Software">
          <Paragraph>
            Moodinator source code is available at https://github.com/MaximilianMauroner/moodinator under the MIT License. That license governs use, copying, modification, merging, publication, distribution, sublicensing, and sale of the open-source code and includes its own notices and warranty disclaimer. These Terms do not remove rights granted by that license. Third-party packages retain their own licenses.
          </Paragraph>
        </Section>

        <Section title="Disclaimers">
          <Paragraph>
            {'The app is provided "as is" and "as available" without warranties of any kind. We do not guarantee uninterrupted or error-free operation, preservation of local data, accuracy of insights, or availability of external support resources.'}
          </Paragraph>
        </Section>

        <Section title="Limitation of Liability">
          <Paragraph>
            To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from app use, including loss of data, loss of profits, personal injury, or emotional distress. Nothing excludes liability that cannot legally be excluded.
          </Paragraph>
        </Section>

        <Section title="Changes to Terms">
          <Paragraph>
            We may update these Terms by changing the Last Updated date and making the revised Terms available.
          </Paragraph>
        </Section>

        <Section title="Termination">
          <Paragraph>
            You may stop using Moodinator at any time and may uninstall it, subject to the data-retention caveats above.
          </Paragraph>
        </Section>

        <Section title="Governing Law">
          <Paragraph>
            These Terms are governed by the laws of the jurisdiction in which the app developer resides, without regard to conflict-of-law provisions.
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
