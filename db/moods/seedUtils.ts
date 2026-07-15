import { getDb } from "../client";

export async function clearMoodData() {
  const db = await getDb();

  await db.execAsync("BEGIN TRANSACTION;");
  try {
    await db.runAsync("DELETE FROM mood_emotions;");
    await db.runAsync("DELETE FROM moods;");
    await db.runAsync("DELETE FROM emotions;");
    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function clearMoods() {
  if (!__DEV__) {
    return;
  }

  await clearMoodData();
}
