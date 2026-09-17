import { runInTransaction } from "../writeQueue";

export async function clearMoodData() {
  await runInTransaction(async (db) => {
    await db.runAsync("DELETE FROM mood_emotions;");
    await db.runAsync("DELETE FROM moods;");
    await db.runAsync("DELETE FROM emotions;");
  });
}

export async function clearMoods() {
  if (!__DEV__) {
    return;
  }

  await clearMoodData();
}
