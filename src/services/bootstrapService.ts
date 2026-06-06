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

type BootstrapNavigationPolicy = "wait-for-migrations";

type BootstrapMigrationStatus = "completed" | "retryable-failure" | "failed";

type StoredBootstrapMigration = {
  id: string;
  version: number;
  status: BootstrapMigrationStatus;
  attempts: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
};

type StoredBootstrapMigrationState = {
  schemaVersion: 1;
  migrations: Record<string, StoredBootstrapMigration>;
};

export type BootstrapMigrationOutcome = {
  id: string;
  version: number;
  status: "completed" | "skipped" | "retryable-failure" | "failed";
  attempts: number;
  migrated?: number;
  skipped?: number;
};

export type AppBootstrapResult = {
  status: Exclude<AppBootstrapStatus, "running">;
  navigationPolicy: BootstrapNavigationPolicy;
  migrations: BootstrapMigrationOutcome[];
};

const LEGACY_EMOTION_CATEGORY_MIGRATION_ID = "legacy-emotion-categories";
const LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION = 1;
const MAX_MIGRATION_ATTEMPTS = 3;

function emptyMigrationState(): StoredBootstrapMigrationState {
  return {
    schemaVersion: 1,
    migrations: {},
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadMigrationState(): Promise<StoredBootstrapMigrationState> {
  return (await getJson<StoredBootstrapMigrationState>(
    BOOTSTRAP_MIGRATIONS_STATE_KEY
  )) ?? emptyMigrationState();
}

async function saveMigrationState(
  state: StoredBootstrapMigrationState
): Promise<void> {
  await setJson(BOOTSTRAP_MIGRATIONS_STATE_KEY, state);
}

async function readLegacyEmotionMigrationState(): Promise<
  StoredBootstrapMigration | null
> {
  const completed = await getString(EMOTION_CATEGORY_MIGRATION_COMPLETED_KEY);

  if (completed === "true") {
    return {
      id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
      version: LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION,
      status: "completed",
      attempts: 1,
      updatedAt: Date.now(),
      completedAt: Date.now(),
    };
  }

  if (completed === "failed") {
    const retriesRaw = await getString(EMOTION_CATEGORY_MIGRATION_RETRIES_KEY);
    const attempts = retriesRaw ? parseInt(retriesRaw, 10) || 0 : MAX_MIGRATION_ATTEMPTS;

    return {
      id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
      version: LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION,
      status: "failed",
      attempts,
      updatedAt: Date.now(),
      error: "Legacy migration state marked failed",
    };
  }

  return null;
}

async function loadLegacyEmotionMigrationRecord(
  state: StoredBootstrapMigrationState
): Promise<StoredBootstrapMigration | null> {
  const existing = state.migrations[LEGACY_EMOTION_CATEGORY_MIGRATION_ID];
  if (existing?.version === LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION) {
    return existing;
  }

  const legacy = await readLegacyEmotionMigrationState();
  if (!legacy) {
    return null;
  }

  state.migrations[LEGACY_EMOTION_CATEGORY_MIGRATION_ID] = legacy;
  await saveMigrationState(state);
  return legacy;
}

function invalidateMoodHistory() {
  const store = useMoodsStore.getState();
  store.invalidate();
  void store.ensureFresh();
}

async function runLegacyEmotionCategoryMigration(
  state: StoredBootstrapMigrationState
): Promise<BootstrapMigrationOutcome> {
  const record = await loadLegacyEmotionMigrationRecord(state);

  if (record?.status === "completed" || record?.status === "failed") {
    return {
      id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
      version: LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION,
      status: "skipped",
      attempts: record.attempts,
    };
  }

  const attempts = (record?.attempts ?? 0) + 1;

  try {
    const result = await migrateEmotionsToCategories();
    const completed: StoredBootstrapMigration = {
      id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
      version: LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION,
      status: "completed",
      attempts,
      updatedAt: Date.now(),
      completedAt: Date.now(),
    };

    state.migrations[LEGACY_EMOTION_CATEGORY_MIGRATION_ID] = completed;
    await saveMigrationState(state);

    if (result.migrated > 0) {
      invalidateMoodHistory();
    }

    return {
      id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
      version: LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION,
      status: "completed",
      attempts,
      migrated: result.migrated,
      skipped: result.skipped,
    };
  } catch (error) {
    const status: BootstrapMigrationStatus =
      attempts >= MAX_MIGRATION_ATTEMPTS ? "failed" : "retryable-failure";

    state.migrations[LEGACY_EMOTION_CATEGORY_MIGRATION_ID] = {
      id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
      version: LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION,
      status,
      attempts,
      updatedAt: Date.now(),
      error: errorMessage(error),
    };
    await saveMigrationState(state);

    if (status === "failed") {
      toastService.error(
        "Migration issue",
        "We couldn't finish updating some past mood entries. New entries will still work."
      );
    }

    return {
      id: LEGACY_EMOTION_CATEGORY_MIGRATION_ID,
      version: LEGACY_EMOTION_CATEGORY_MIGRATION_VERSION,
      status,
      attempts,
    };
  }
}

export async function runAppBootstrap(): Promise<AppBootstrapResult> {
  const state = await loadMigrationState();
  const migrations = [await runLegacyEmotionCategoryMigration(state)];
  const hasWarning = migrations.some(
    (migration) =>
      migration.status === "retryable-failure" || migration.status === "failed"
  );

  return {
    status: hasWarning ? "ready-with-warning" : "ready",
    navigationPolicy: "wait-for-migrations",
    migrations,
  };
}
