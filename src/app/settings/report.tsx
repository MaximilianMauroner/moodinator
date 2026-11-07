import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Redirect } from "expo-router";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { getThemedColor } from "@/constants/colors";
import {
  EMAIL_LIMIT,
  REPORT_LIMIT,
  sendReport,
  type ReportDraft,
  type ReportKind,
  type ReportOutcome,
  type ReportRejection,
} from "@/services/reportService";

const KINDS = [
  { kind: "bug", label: "Problem", detail: "Something does not work as it should" },
  { kind: "feature", label: "Idea", detail: "Something Moodinator could do for you" },
] as const satisfies readonly { kind: ReportKind; label: string; detail: string }[];

const FIELDS = {
  bug: {
    message: { label: "What happened?", hint: "What went wrong? What did you expect?" },
    details: { label: "How to repeat it", hint: "How can the developer make it happen again? (optional)" },
  },
  feature: {
    message: { label: "Your idea", hint: "What should Moodinator do that it does not do now?" },
    details: { label: "Why it helps", hint: "Why would it help you? (optional)" },
  },
} as const satisfies Record<ReportKind, unknown>;

const REJECTED = {
  unknown_app: "This version cannot send reports. Update the app.",
  invalid_kind: "Choose Problem or Idea.",
  empty_message: "Write what happened or what you would like.",
  message_too_long: "Make the message shorter.",
  details_too_long: "Make the details shorter.",
  invalid_email: "Enter a valid email address, or leave it empty.",
  unknown: "The report was not accepted. Check the text and try again.",
} as const satisfies Record<ReportRejection, string>;

const FAILED = {
  offline: "No connection. Check your network and try again.",
  timeout: "No answer from the server. Try again in a moment.",
  "rate-limited": "Too many reports. Try again in a few minutes.",
  failed: "The report was not sent. Try again later.",
} as const satisfies Record<Exclude<ReportOutcome["kind"], "sent" | "rejected">, string>;

const empty = (kind: ReportKind): ReportDraft => ({ kind, message: "", details: "", contactEmail: "" });

export default function ReportScreen() {
  const [draft, setDraft] = useState<ReportDraft>(() => empty("bug"));
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);
  if (!sendReport) return <Redirect href="/settings/about" />;
  const send = sendReport;

  const edit = (change: Partial<ReportDraft>) => {
    setDraft({ ...draft, ...change });
    setOutcome(null);
  };
  const submit = async () => {
    setSending(true);
    setOutcome(null);
    const result = await send(draft);
    setSending(false);
    setOutcome(result);
    if (result.kind === "sent") setDraft(empty(draft.kind));
  };
  const fields = FIELDS[draft.kind];
  const canSend = !sending && draft.message.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Report a problem or idea"
        subtitle="Support"
        icon="chatbubble-ellipses-outline"
        accentColor="dusk"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SettingsSection title="What is it about?">
            <View accessibilityRole="radiogroup" className="p-4 gap-3">
              {KINDS.map(({ kind, label, detail }) => {
                const selected = draft.kind === kind;
                return (
                  <Pressable
                    key={kind}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: sending }}
                    disabled={sending}
                    onPress={() => edit({ kind })}
                    className={`rounded-2xl border px-4 py-3 ${
                      selected
                        ? "border-sage-500 bg-sage-100 dark:bg-sage-600/20"
                        : "border-paper-200 dark:border-paper-700"
                    }`}
                  >
                    <Text
                      className={`font-semibold ${
                        selected ? "text-sage-600 dark:text-sage-300" : "text-paper-800 dark:text-paper-200"
                      }`}
                    >
                      {label}
                    </Text>
                    <Text className="text-xs text-paper-700 dark:text-sand-400 mt-1">{detail}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SettingsSection>

          <SettingsSection title="Your report">
            <View className="p-4">
              <Field label={fields.message.label} hint={fields.message.hint} value={draft.message} onChange={(message) => edit({ message })} disabled={sending} />
              <Field label={fields.details.label} hint={fields.details.hint} value={draft.details} onChange={(details) => edit({ details })} disabled={sending} />
              <Field label="Email for a reply" hint="Optional" value={draft.contactEmail} onChange={(contactEmail) => edit({ contactEmail })} disabled={sending} email />
              <Text className="text-xs text-paper-700 dark:text-sand-400 leading-5">
                Sends only what you type, the app version, and the system version. Never your moods or entries.
              </Text>
            </View>
          </SettingsSection>

          <View className="mx-4 mt-2">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend, busy: sending }}
              disabled={!canSend}
              onPress={submit}
              className={`rounded-2xl py-4 items-center flex-row justify-center bg-sage-600 ${canSend ? "" : "opacity-50"}`}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold text-base">Send</Text>}
            </Pressable>
            {outcome && (
              <Text
                accessibilityLiveRegion="polite"
                className={`text-sm mt-3 text-center ${
                  outcome.kind === "sent" ? "text-sage-700 dark:text-sage-300" : "text-coral-700 dark:text-coral-300"
                }`}
              >
                {outcome.kind === "sent"
                  ? "Thank you. Your report was sent."
                  : outcome.kind === "rejected"
                    ? REJECTED[outcome.reason]
                    : FAILED[outcome.kind]}
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const PROSE = { multiline: true, textAlignVertical: "top", maxLength: REPORT_LIMIT } as const;
const EMAIL = {
  keyboardType: "email-address",
  autoCapitalize: "none",
  autoCorrect: false,
  autoComplete: "email",
  textContentType: "emailAddress",
  maxLength: EMAIL_LIMIT,
} as const;

function Field({ label, hint, value, onChange, disabled, email = false }: {
  label: string;
  hint: string;
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
  email?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-paper-800 dark:text-paper-200 mb-2">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        placeholder={hint}
        placeholderTextColor={getThemedColor("textSubtle", isDark)}
        editable={!disabled}
        value={value}
        onChangeText={onChange}
        {...(email ? EMAIL : PROSE)}
        className="rounded-xl border border-paper-200 dark:border-paper-700 bg-paper-100 dark:bg-paper-900 px-3.5 py-3 text-base"
        style={{ minHeight: email ? 48 : 112, color: getThemedColor("textOnSurface", isDark) }}
      />
    </View>
  );
}
