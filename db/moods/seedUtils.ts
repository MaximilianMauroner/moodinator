import { getDb } from "../client";

export async function clearMoods() {
  if (!__DEV__) {
    return;
  }
  const db = await getDb();
  await db.runAsync("DELETE FROM moods;");
}

