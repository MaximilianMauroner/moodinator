import AsyncStorage from "@react-native-async-storage/async-storage";
import { NO_ENTRY_REMINDER_SETTINGS_KEY } from "./noEntryReminderScheduler";

/** A committed mood write remains successful even if the native queue fails. */
export async function reconcileRemindersAfterMoodChange(): Promise<void> {
  try {
    // Avoid loading native notification code for users who never set this up.
    // Disabled settings still reconcile, to retry any pending cancellation.
    if (await AsyncStorage.getItem(NO_ENTRY_REMINDER_SETTINGS_KEY) === null) return;
    const { reconcileNoEntryReminder } = await import("./notificationService");
    await reconcileNoEntryReminder();
  } catch {
    console.warn("Could not refresh conditional reminders after saving mood data. Reconciliation will retry when the app reopens.");
  }
}
