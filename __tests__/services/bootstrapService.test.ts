import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BOOTSTRAP_MIGRATIONS_STATE_KEY } from "../../src/shared/storage/keys";

const mocks = vi.hoisted(() => ({
  migrateEmotionsToCategories: vi.fn(),
  toastError: vi.fn(),
  invalidate: vi.fn(),
  ensureFresh: vi.fn(() => Promise.resolve()),
}));

vi.mock("@db/moods/migrations", () => ({
  migrateEmotionsToCategories: mocks.migrateEmotionsToCategories,
}));

vi.mock("@/services/toastService", () => ({
  toastService: {
    error: mocks.toastError,
  },
}));

vi.mock("@/shared/state/moodsStore", () => ({
  useMoodsStore: {
    getState: () => ({
      invalidate: mocks.invalidate,
      ensureFresh: mocks.ensureFresh,
    }),
  },
}));

import { runAppBootstrap } from "../../src/services/bootstrapService";

const LEGACY_EMOTION_CATEGORY_MIGRATION_ID = "legacy-emotion-categories";

async function readMigrationState() {
  const raw = await AsyncStorage.getItem(BOOTSTRAP_MIGRATIONS_STATE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function writeMigrationRecord(record: Record<string, unknown>) {
  await AsyncStorage.setItem(
    BOOTSTRAP_MIGRATIONS_STATE_KEY,
    JSON.stringify({
      schemaVersion: 1,
      migrations: {
        [LEGACY_EMOTION_CATEGORY_MIGRATION_ID]: {
          id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
          version: 1,
          updatedAt: Date.now(),
          ...record,
        },
      },
    })
  );
}

describe("runAppBootstrap", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mocks.migrateEmotionsToCategories.mockReset();
    mocks.toastError.mockReset();
    mocks.invalidate.mockReset();
    mocks.ensureFresh.mockReset();
    mocks.ensureFresh.mockResolvedValue(undefined);
  });

  it("runs the legacy emotion-category migration on first run", async () => {
    mocks.migrateEmotionsToCategories.mockResolvedValue({
      migrated: 2,
      skipped: 1,
    });

    const result = await runAppBootstrap();
    const state = await readMigrationState();

    expect(result).toMatchObject({
      status: "ready",
      navigationPolicy: "wait-for-migrations",
      migrations: [
        {
          id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
          version: 1,
          status: "completed",
          attempts: 1,
          migrated: 2,
          skipped: 1,
        },
      ],
    });
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
    expect(mocks.ensureFresh).toHaveBeenCalledTimes(1);
    expect(state.migrations[LEGACY_EMOTION_CATEGORY_MIGRATION_ID]).toMatchObject({
      version: 1,
      status: "completed",
      attempts: 1,
    });
  });

  it("skips a completed versioned migration", async () => {
    await writeMigrationRecord({
      status: "completed",
      attempts: 1,
      completedAt: Date.now(),
    });

    const result = await runAppBootstrap();

    expect(mocks.migrateEmotionsToCategories).not.toHaveBeenCalled();
    expect(result.migrations[0]).toMatchObject({
      status: "skipped",
      attempts: 1,
    });
  });

  it("records a retryable failure before the terminal attempt", async () => {
    mocks.migrateEmotionsToCategories.mockRejectedValue(new Error("temporary"));

    const result = await runAppBootstrap();
    const state = await readMigrationState();

    expect(result.status).toBe("ready-with-warning");
    expect(result.migrations[0]).toMatchObject({
      status: "retryable-failure",
      attempts: 1,
    });
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(state.migrations[LEGACY_EMOTION_CATEGORY_MIGRATION_ID]).toMatchObject({
      status: "retryable-failure",
      attempts: 1,
      error: "temporary",
    });
  });

  it("records and surfaces a terminal failure on the final retry", async () => {
    await writeMigrationRecord({
      status: "retryable-failure",
      attempts: 2,
      error: "temporary",
    });
    mocks.migrateEmotionsToCategories.mockRejectedValue(new Error("still broken"));

    const result = await runAppBootstrap();
    const state = await readMigrationState();

    expect(result.status).toBe("ready-with-warning");
    expect(result.migrations[0]).toMatchObject({
      status: "failed",
      attempts: 3,
    });
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Migration issue",
      "We couldn't finish updating some past mood entries. New entries will still work."
    );
    expect(state.migrations[LEGACY_EMOTION_CATEGORY_MIGRATION_ID]).toMatchObject({
      status: "failed",
      attempts: 3,
      error: "still broken",
    });
  });

  it("is idempotent after a successful run", async () => {
    mocks.migrateEmotionsToCategories.mockResolvedValue({
      migrated: 0,
      skipped: 4,
    });

    await runAppBootstrap();
    mocks.migrateEmotionsToCategories.mockClear();

    const result = await runAppBootstrap();

    expect(mocks.migrateEmotionsToCategories).not.toHaveBeenCalled();
    expect(result.migrations[0]).toMatchObject({
      status: "skipped",
      attempts: 1,
    });
  });
});
