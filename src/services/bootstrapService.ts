import { migrateEmotionsToCategories } from "@db/moods/migrations";

import { getJson, getString, setJson } from "@/shared/storage/asyncStorage";
import {
  BOOTSTRAP_MIGRATIONS_STATE_KEY,
  EMOTION_CATEGORY_MIGRATION_COMPLETED_KEY,
  EMOTION_CATEGORY_MIGRATION_RETRIES_KEY,
} from "@/shared/storage/keys";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { toastService } from "@/services/toastService";

export type AppBootstrapStatus = "running" | "ready" | "ready-with-warning";

export type AppBootstrapResult = {
  status: Exclude<AppBootstrapStatus, "running">;
};

/**
 * Persisted shape. Installed devices already hold this exact record, and a
 * completed migration must stay completed, so the shape is kept as-is rather
 * than simplified. Rewriting it would make every existing user rescan the
 * moods table once for no gain.
 */
type MigrationStatus = "completed" | "retryable-failure" | "failed";

type StoredMigration = {
  id: string;
  version: number;
  status: MigrationStatus;
  attempts: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
};

type StoredMigrationState = {
  schemaVersion: 1;
  migrations: Record<string, StoredMigration>;
};

const MIGRATION_ID = "legacy-emotion-categories";
const MIGRATION_VERSION = 1;
const MAX_ATTEMPTS = 3;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadState(): Promise<StoredMigrationState> {
  return (
    (await getJson<StoredMigrationState>(BOOTSTRAP_MIGRATIONS_STATE_KEY)) ?? {
      schemaVersion: 1,
      migrations: {},
    }
  );
}

/** The key used before the state record existed. */
async function readPreStateRecord(): Promise<StoredMigration | null> {
  const completed = await getString(EMOTION_CATEGORY_MIGRATION_COMPLETED_KEY);
  if (completed !== "true" && completed !== "failed") {
    return null;
  }

  const base = {
    id: MIGRATION_ID,
    version: MIGRATION_VERSION,
    attempts: 1,
    updatedAt: Date.now(),
  };

  if (completed === "true") {
    return { ...base, status: "completed", completedAt: Date.now() };
  }

  const retries = await getString(EMOTION_CATEGORY_MIGRATION_RETRIES_KEY);
  return {
    ...base,
    status: "failed",
    attempts: retries ? parseInt(retries, 10) || 0 : MAX_ATTEMPTS,
    error: "Legacy migration state marked failed",
  };
}

async function loadRecord(
  state: StoredMigrationState
): Promise<StoredMigration | null> {
  const existing = state.migrations[MIGRATION_ID];
  if (existing?.version === MIGRATION_VERSION) {
    return existing;
  }

  const older = await readPreStateRecord();
  if (!older) {
    return null;
  }

  state.migrations[MIGRATION_ID] = older;
  await setJson(BOOTSTRAP_MIGRATIONS_STATE_KEY, state);
  return older;
}

async function record(
  state: StoredMigrationState,
  migration: StoredMigration
): Promise<void> {
  state.migrations[MIGRATION_ID] = migration;
  await setJson(BOOTSTRAP_MIGRATIONS_STATE_KEY, state);
}

/**
 * Runs the one migration the app still needs, at most MAX_ATTEMPTS times
 * across launches. Returns true when the app should warn the user.
 */
async function runLegacyEmotionCategoryMigration(
  state: StoredMigrationState
): Promise<boolean> {
  const existing = await loadRecord(state);
  if (existing?.status === "completed" || existing?.status === "failed") {
    return false;
  }

  const attempts = (existing?.attempts ?? 0) + 1;
  const updatedAt = Date.now();

  try {
    const result = await migrateEmotionsToCategories();
    await record(state, {
      id: MIGRATION_ID,
      version: MIGRATION_VERSION,
      status: "completed",
      attempts,
      updatedAt,
      completedAt: updatedAt,
    });

    if (result.migrated > 0) {
      const store = useMoodsStore.getState();
      store.invalidate();
      void store.ensureFresh();
    }
    return false;
  } catch (error) {
    const status: MigrationStatus =
      attempts >= MAX_ATTEMPTS ? "failed" : "retryable-failure";
    await record(state, {
      id: MIGRATION_ID,
      version: MIGRATION_VERSION,
      status,
      attempts,
      updatedAt,
      error: errorMessage(error),
    });

    if (status === "failed") {
      toastService.error(
        "Migration issue",
        "We couldn't finish updating some past mood entries. New entries will still work."
      );
    }
    return true;
  }
}

export async function runAppBootstrap(): Promise<AppBootstrapResult> {
  const state = await loadState();
  const warned = await runLegacyEmotionCategoryMigration(state);
  return { status: warned ? "ready-with-warning" : "ready" };
}
