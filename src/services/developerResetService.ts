import AsyncStorage from "@react-native-async-storage/async-storage";
import { moodService } from "./moodService";
import { notificationService } from "./notificationService";

/** Full development reset; deleting mood history alone must keep reminder choices. */
export async function resetDeveloperAppData(clearPin: () => Promise<void>): Promise<void> {
  // Keep explicit scheduling excluded while asynchronous PIN/data cleanup runs.
  // The guard does not hold the mutation queue: clearAll can still reconcile.
  await notificationService.withNotificationReset(async () => {
    const conditional = await notificationService.getNoEntryReminderSettings();
    const disabledConditional = await notificationService.saveNoEntryReminderSettings({
      enabled: false,
      hour: conditional.hour,
      minute: conditional.minute,
    });
    if (disabledConditional.status !== "disabled" || disabledConditional.retainedIds.length > 0) {
      throw new Error(disabledConditional.message ?? "Conditional reminder cleanup failed. Retry the reset.");
    }

    const ordinary = await notificationService.cancelMoodReminder();
    if (ordinary.status !== "disabled") {
      throw new Error(ordinary.message ?? "Reminder cleanup failed. Retry the reset.");
    }
    // Also remove test notifications. This must confirm native cleanup before
    // erasing the persisted settings/identifiers needed to retry cancellation.
    await notificationService.cancelAllScheduledNotifications();

    await clearPin();
    // Both reminder features are now disabled, so the post-commit reconciliation
    // performed by clearAll cannot replace the requests we just canceled.
    await moodService.clearAll();
    await AsyncStorage.clear();
  });
}
