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
        <Text className="text-xs text-paper-700 dark:text-sand-400 mb-4">
          Last Updated: July 21, 2026
        </Text>

        <Section title="Introduction">
          <Paragraph>
            Moodinator is a local-first mood tracking app. This policy explains what information the app handles, where it is stored, when it can leave your device, and what you can delete.
          </Paragraph>
        </Section>

        <Section title="Information Stored on Your Device">
          <Paragraph>
            Moodinator stores information you choose to enter or configure:
          </Paragraph>
          <BulletList items={[
            "Mood data: ratings, timestamps, notes, emotions, context tags, energy values, and history",
            "Settings: entry and display preferences, onboarding state, and other app configuration",
            "Reminders: local notification titles, messages, schedules, permission state, and identifiers",
            "App lock: enabled settings, PIN length, failed-attempt state, and a salted hash of your PIN",
            "Backup metadata: the selected folder and latest-backup time",
          ]} />

          <Subtitle>Local-First, No Account</Subtitle>
          <Paragraph>
            Moodinator processes and stores this information locally. It has no developer-operated server, account system, cloud synchronization, advertising, or analytics. We do not receive your mood data or app settings.
          </Paragraph>
        </Section>

        <Section title="Storage and Security">
          <Paragraph>
            Mood data is stored in a local SQLite database inside the operating system app sandbox. On Android, Moodinator does not apply database-level encryption to that database. App lock is not database encryption.
          </Paragraph>
          <Paragraph>
            If you set an app-lock PIN, Moodinator stores a salted hash—not the plaintext PIN—in the operating system secure storage. Biometric enrollment and matching stay with the operating system; Moodinator does not receive or store your biometric template.
          </Paragraph>
        </Section>

        <Section title="Local Notifications">
          <Paragraph>
            Moodinator schedules reminders locally after you enable them and grant permission. Reminder titles and messages may be visible on your lock screen or in notification history, depending on device settings. Moodinator does not use remote push notifications.
          </Paragraph>
        </Section>

        <Section title="Exports and Backups">
          <Paragraph>
            Mood-history exports and backups are plaintext JSON; therapy exports are plaintext CSV. Moodinator does not encrypt them. Android JSON exports are written to a selected folder. Other export flows use a temporary app-cache file and the operating-system share sheet, or can offer to copy the full content to the clipboard when sharing is unavailable.
          </Paragraph>
          <Paragraph>
            Moodinator attempts to delete temporary exports after the flow, but an interrupted or failed share can leave a file until the operating system clears the cache. Selected destinations can include cloud-backed providers. Anyone with access to a file or clipboard copy may be able to read it.
          </Paragraph>
          <Paragraph>
            Periodic backups are scheduled by the operating system, which decides whether and when they run. They may run automatically after backup storage is available, with successful backups limited to at most once per week. Android requires a selected folder first. Moodinator keeps the eight newest app-managed backup files it can identify and removes older identified managed backups. It cannot delete arbitrary exports, renamed copies, clipboard content, or copies held by another app or provider.
          </Paragraph>
        </Section>

        <Section title="External Support Actions">
          <Paragraph>
            For ratings 9 and 10, Moodinator offers actions to call or text U.S. 988 or open findahelpline.com. These actions are user-initiated. Moodinator does not monitor entries, contact emergency services, or send your mood entry to a support provider.
          </Paragraph>
        </Section>

        <Section title="Sharing and Sale">
          <Paragraph>
            We do not operate servers that receive your Moodinator data, sell it, or use advertising or analytics SDKs. Data can leave through a deliberate export, share, copy, import, or support action; when an OS-scheduled periodic backup runs after storage is available; or through platform backup or transfer behavior outside our control.
          </Paragraph>
        </Section>

        <Section title="Your Control and Deletion">
          <BulletList items={[
            "Delete an individual mood entry.",
            "Delete Mood Data removes mood history, including mood rows, mood–emotion link records, and database emotion records used by that history.",
            "Delete Mood Data retains the user-visible Emotion List presets, context-tag presets, other settings, reminders, app-lock data, and files saved outside the app.",
          ]} />
          <Paragraph>
            Uninstalling normally removes app-sandbox data, but external files remain, secure storage and platform backups can behave differently by operating system, and device backup or transfer features may retain or restore data.
          </Paragraph>
          <Paragraph>
            Because Moodinator has no account and we hold no server-side copy, there is no developer-side account or data-deletion request for us to perform. Delete data in the app, uninstall it, and remove external copies from their destinations.
          </Paragraph>
        </Section>

        <Section title="Children's Privacy">
          <Paragraph>
            {"Moodinator is not directed at children under 13. Because we do not receive app data, we do not knowingly collect children's information through developer-operated servers."}
          </Paragraph>
        </Section>

        <Section title="Changes to This Policy">
          <Paragraph>
            {'We may update this policy from time to time. We identify changes by updating the "Last Updated" date.'}
          </Paragraph>
        </Section>

        <Section title="Contact Us">
          <Paragraph>
            Questions: support.moodinator@lab4code.com. Source: https://github.com/MaximilianMauroner/moodinator
          </Paragraph>
        </Section>

        <View className="mt-6 p-4 rounded-2xl bg-sage-100 dark:bg-sage-900">
          <Text className="text-sm font-semibold text-sage-700 dark:text-sage-300 mb-2">
            Summary
          </Text>
          <BulletList
            items={[
              "No developer-operated account, data server, analytics, or ads",
              "Android mood database is sandboxed but not encrypted by Moodinator",
              "JSON and CSV exports and JSON backups are readable plaintext",
              "Delete Mood Data has a limited, documented scope",
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
