import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";

export type ReportKind = "bug" | "feature";
export type ReportDraft = { kind: ReportKind; message: string; details: string; contactEmail: string };
/** Why the reports inbox refused a report. The app shows its own text for each reason, never the server's words. */
export type ReportRejection =
  | "unknown_app"
  | "invalid_kind"
  | "empty_message"
  | "message_too_long"
  | "details_too_long"
  | "invalid_email"
  | "unknown";
export type ReportOutcome =
  | { kind: "sent" }
  | { kind: "offline" }
  | { kind: "timeout" }
  | { kind: "rate-limited" }
  | { kind: "rejected"; reason: ReportRejection }
  | { kind: "failed" };

export const REPORT_PAGE = "/settings/report";
export const REPORT_LIMIT = 4000;
export const EMAIL_LIMIT = 254;
const TIMEOUT_MS = 15_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REJECTIONS: readonly string[] = [
  "unknown_app",
  "invalid_kind",
  "empty_message",
  "message_too_long",
  "details_too_long",
  "invalid_email",
];

/** The same checks the inbox makes, so the person sees the reason before anything leaves the phone. */
export function checkReport(draft: ReportDraft): ReportRejection | null {
  if (!draft.message.trim()) return "empty_message";
  if (draft.message.trim().length > REPORT_LIMIT) return "message_too_long";
  if (draft.details.trim().length > REPORT_LIMIT) return "details_too_long";
  const email = draft.contactEmail.trim();
  if (email && (email.length > EMAIL_LIMIT || !EMAIL.test(email))) return "invalid_email";
  return null;
}

function context(): string {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "unknown";
  const build = Application.nativeBuildVersion;
  const os = Platform.OS === "android" ? Platform.constants.Release : Platform.OS === "ios" ? Platform.Version : undefined;
  return `Moodinator ${version}${build ? ` (${build})` : ""} · ${[Platform.OS, os].filter(Boolean).join(" ")}`;
}

async function post(origin: string, draft: ReportDraft): Promise<ReportOutcome> {
  const refused = checkReport(draft);
  if (refused) return { kind: "rejected", reason: refused };
  const body = {
    app: "moodinator",
    kind: draft.kind,
    message: draft.message.trim(),
    details: draft.details.trim() || undefined,
    page: REPORT_PAGE,
    context: context(),
    contactEmail: draft.contactEmail.trim() || undefined,
  };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${origin}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  } catch {
    return { kind: abort.signal.aborted ? "timeout" : "offline" };
  } finally {
    clearTimeout(timer);
  }
  if (response.ok) return { kind: "sent" };
  if (response.status === 429) return { kind: "rate-limited" };
  if (response.status === 400) {
    const reason: unknown = await response.json().then((json) => json?.reason, () => undefined);
    return {
      kind: "rejected",
      reason: typeof reason === "string" && REJECTIONS.includes(reason) ? (reason as ReportRejection) : "unknown",
    };
  }
  return { kind: "failed" };
}

const origin = process.env.EXPO_PUBLIC_REPORTS_ORIGIN;

/** Null when this build has no reports inbox, so development and QA builds never write into production. */
export const sendReport = origin ? (draft: ReportDraft) => post(origin, draft) : null;
