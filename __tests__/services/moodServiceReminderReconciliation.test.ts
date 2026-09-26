import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertMoodEntry: vi.fn(),
  updateMoodEntry: vi.fn(),
  updateMoodNote: vi.fn(),
  updateMoodTimestamp: vi.fn(),
  deleteMood: vi.fn(),
  clearMoodData: vi.fn(),
  seedMoods: vi.fn(),
  updateEmotionCategoryInMoods: vi.fn(),
  reconcileNoEntryReminder: vi.fn(),
}));

vi.mock("@db/db", () => mocks);
vi.mock("@db/moods/repository", () => ({ getMoodHistorySummary: vi.fn(), getLatestMood: vi.fn() }));
vi.mock("../../src/services/notificationService", () => ({ reconcileNoEntryReminder: mocks.reconcileNoEntryReminder }));

import { moodService } from "../../src/services/moodService";
import { NO_ENTRY_REMINDER_SETTINGS_KEY } from "../../src/services/noEntryReminderScheduler";

const entry = { id: 1, mood: 5, timestamp: 1790416800000 };
const mutations = [
  ["create", mocks.insertMoodEntry, () => moodService.create({ mood: 5 })],
  ["update", mocks.updateMoodEntry, () => moodService.update(1, { mood: 4 })],
  ["updateNote", mocks.updateMoodNote, () => moodService.updateNote(1, "QA")],
  ["updateTimestamp", mocks.updateMoodTimestamp, () => moodService.updateTimestamp(1, entry.timestamp)],
  ["delete", mocks.deleteMood, () => moodService.delete(1)],
  ["clearAll", mocks.clearMoodData, () => moodService.clearAll()],
  ["seedSampleData", mocks.seedMoods, () => moodService.seedSampleData()],
  ["updateEmotionCategory", mocks.updateEmotionCategoryInMoods, () => moodService.updateEmotionCategory("Calm", "positive")],
] as const;

describe("mood changes and conditional reminders", () => {
  beforeEach(async () => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    await AsyncStorage.clear();
    await AsyncStorage.setItem(NO_ENTRY_REMINDER_SETTINGS_KEY, JSON.stringify({ enabled: true }));
    mocks.insertMoodEntry.mockResolvedValue(entry);
    mocks.updateMoodEntry.mockResolvedValue(entry);
    mocks.updateMoodNote.mockResolvedValue(entry);
    mocks.updateMoodTimestamp.mockResolvedValue(entry);
    mocks.seedMoods.mockResolvedValue(20);
    mocks.updateEmotionCategoryInMoods.mockResolvedValue({ updated: 1 });
    mocks.reconcileNoEntryReminder.mockResolvedValue({ status: "scheduled" });
  });

  it.each(mutations)("reconciles %s only after its database operation commits", async (_name, write, mutate) => {
    const events: string[] = [];
    write.mockImplementation(async () => {
      events.push("commit");
      return { ...entry, updated: 1 };
    });
    mocks.reconcileNoEntryReminder.mockImplementation(async () => { events.push("reconcile"); });
    await mutate();
    expect(events).toEqual(["commit", "reconcile"]);
  });

  it.each(mutations.filter(([name]) => name !== "seedSampleData"))(
    "does not reconcile when %s rejects before commit",
    async (_name, write, mutate) => {
      write.mockRejectedValueOnce(new Error("write failed"));
      await expect(mutate()).rejects.toThrow("write failed");
      expect(mocks.reconcileNoEntryReminder).not.toHaveBeenCalled();
    },
  );

  it("reconciles when a later seed batch rejects because earlier batches may have committed", async () => {
    mocks.seedMoods.mockRejectedValueOnce(new Error("later batch failed"));
    await expect(moodService.seedSampleData()).rejects.toThrow("later batch failed");
    expect(mocks.reconcileNoEntryReminder).toHaveBeenCalledTimes(1);
  });

  it.each(mutations)("preserves the %s result when notification reconciliation rejects", async (_name, _write, mutate) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.reconcileNoEntryReminder.mockRejectedValueOnce(new Error("native cancellation failed"));
    try {
      await mutate();
      expect(warning).toHaveBeenCalledTimes(1);
    } finally {
      warning.mockRestore();
    }
  });

  it("does not invoke notification code when conditional reminders were never configured", async () => {
    await AsyncStorage.removeItem(NO_ENTRY_REMINDER_SETTINGS_KEY);
    await expect(moodService.create({ mood: 5 })).resolves.toBe(entry);
    expect(mocks.reconcileNoEntryReminder).not.toHaveBeenCalled();
  });

  it("still reconciles disabled settings to retry retained request cancellation", async () => {
    await AsyncStorage.setItem(NO_ENTRY_REMINDER_SETTINGS_KEY, JSON.stringify({ enabled: false }));
    await moodService.create({ mood: 5 });
    expect(mocks.reconcileNoEntryReminder).toHaveBeenCalledTimes(1);
  });

  it("preserves a committed result when reminder settings cannot be read", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("settings unavailable"));
    try {
      await expect(moodService.create({ mood: 5 })).resolves.toBe(entry);
      expect(mocks.reconcileNoEntryReminder).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  it("does not reconcile an update that found no matching entry", async () => {
    mocks.updateMoodEntry.mockResolvedValueOnce(undefined);
    mocks.updateMoodNote.mockResolvedValueOnce(undefined);
    mocks.updateMoodTimestamp.mockResolvedValueOnce(undefined);
    await moodService.update(1, { mood: 4 });
    await moodService.updateNote(1, "QA");
    await moodService.updateTimestamp(1, entry.timestamp);
    expect(mocks.reconcileNoEntryReminder).not.toHaveBeenCalled();
  });
});
