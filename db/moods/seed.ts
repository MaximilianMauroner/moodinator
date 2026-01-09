import type { Emotion } from "../types";
import { getDb } from "../client";
import { DEFAULT_CONTEXTS, DEFAULT_EMOTIONS } from "../../src/lib/entrySettings";
import {
  serializeArray,
  serializeEmotions,
  parseTimestamp,
  sanitizeEnergy,
  sanitizeImportedArray,
  sanitizeImportedEmotions,
} from "./serialization";
import { clearMoods } from "./seedUtils";
import { linkEmotionsToMood } from "./emotions";

export { clearMoods } from "./seedUtils";

export async function seedMoods() {
  const db = await getDb();
  const days = 1095;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  let totalEntries = 0;

  const sampleNotes = [
    "Feeling good today",
    "Had a nice walk",
    "Busy day at work",
    "Feeling a bit tired",
    "Great conversation with a friend",
    "Struggling with motivation",
    "Feeling overwhelmed",
    "Had a good meal",
    "Need to take a break",
    "Feeling anxious about tomorrow",
    "Enjoyed some quiet time",
    "Feeling stressed",
    "Had a productive morning",
    "Feeling down",
    "Good workout today",
    "Woke up feeling refreshed",
    "Had a difficult conversation",
    "Feeling grateful",
    "Not sleeping well lately",
    "Made progress on a project",
    "Feeling lonely",
    "Had fun with family",
    "Work is getting to me",
    "Feeling hopeful",
    "Need more rest",
    "Had a good therapy session",
    "Feeling disconnected",
    "Enjoyed the weather today",
    "Struggling with anxiety",
    "Feeling proud of myself",
    "Had a rough day",
    "Feeling more balanced",
    "Worried about the future",
    "Appreciating the small things",
    "Feeling stuck",
    "Had a breakthrough moment",
    "Feeling drained",
    "Grateful for support",
    "Feeling uncertain",
    "Had a peaceful moment",
    "Struggling to focus",
    "Feeling accomplished",
    "Need to slow down",
    "Feeling inspired",
    "Having a hard time",
    "Feeling content",
    "Dealing with stress",
    "Feeling optimistic",
    "Need some self-care",
    "Feeling supported",
    "Having mixed feelings",
  ];

  const entries: Array<{
    mood: number;
    note: string | null;
    timestamp: number;
    emotions: Emotion[];
    contextTags: string[];
    energy: number;
  }> = [];

  for (let i = 0; i < days; i++) {
    let entriesCount: number;
    const freqRand = Math.random();
    if (freqRand < 0.03) entriesCount = 0;
    else if (freqRand < 0.6) entriesCount = 1;
    else if (freqRand < 0.9) entriesCount = 2;
    else if (freqRand < 0.98) entriesCount = 3;
    else entriesCount = 4;

    for (let j = 0; j < entriesCount; j++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const hourRand = Math.random();
      let hour: number;
      if (hourRand < 0.25) hour = Math.floor(Math.random() * 3) + 7;
      else if (hourRand < 0.5) hour = Math.floor(Math.random() * 4) + 11;
      else if (hourRand < 0.75) hour = Math.floor(Math.random() * 5) + 17;
      else {
        const otherHours = [
          ...Array.from({ length: 3 }, (_, i) => i + 9),
          ...Array.from({ length: 4 }, (_, i) => i + 14),
          ...Array.from({ length: 3 }, (_, i) => i + 21),
        ];
        hour = otherHours[Math.floor(Math.random() * otherHours.length)];
      }
      currentDate.setHours(hour);
      currentDate.setMinutes(Math.floor(Math.random() * 60));

      let mood: number;
      const moodRand = Math.random();
      if (moodRand < 0.15) mood = Math.floor(Math.random() * 3);
      else if (moodRand < 0.35) mood = Math.floor(Math.random() * 2) + 3;
      else if (moodRand < 0.5) mood = 5;
      else if (moodRand < 0.85) mood = Math.floor(Math.random() * 2) + 6;
      else if (moodRand < 0.97) mood = 8;
      else mood = Math.floor(Math.random() * 2) + 9;

      let energy: number;
      if (mood <= 2) energy = Math.floor(Math.random() * 4) + 7;
      else if (mood <= 4) energy = Math.floor(Math.random() * 4) + 5;
      else if (mood === 5) energy = Math.floor(Math.random() * 4) + 4;
      else if (mood <= 7) energy = Math.floor(Math.random() * 4) + 3;
      else if (mood === 8) energy = Math.floor(Math.random() * 4) + 2;
      else energy = Math.floor(Math.random() * 4);

      let emotions: Emotion[] = [];
      if (Math.random() < 0.75) {
        const emotionRand = Math.random();
        let numEmotions: number;
        if (emotionRand < 0.3) numEmotions = 1;
        else if (emotionRand < 0.65) numEmotions = 2;
        else if (emotionRand < 0.9) numEmotions = 3;
        else numEmotions = 4;
        const shuffled = [...DEFAULT_EMOTIONS].sort(() => Math.random() - 0.5);
        emotions = shuffled.slice(0, Math.min(numEmotions, DEFAULT_EMOTIONS.length));
      }

      let contextTags: string[] = [];
      if (Math.random() < 0.75) {
        const contextRand = Math.random();
        let numContexts: number;
        if (contextRand < 0.4) numContexts = 1;
        else if (contextRand < 0.8) numContexts = 2;
        else numContexts = 3;
        const shuffled = [...DEFAULT_CONTEXTS].sort(() => Math.random() - 0.5);
        contextTags = shuffled.slice(
          0,
          Math.min(numContexts, DEFAULT_CONTEXTS.length)
        );
      }

      const note =
        Math.random() < 0.6
          ? sampleNotes[Math.floor(Math.random() * sampleNotes.length)]
          : null;

      entries.push({
        mood,
        note,
        timestamp: currentDate.getTime(),
        emotions,
        contextTags,
        energy,
      });
      totalEntries++;
    }
  }

  const BATCH_SIZE = 1000;
  let insertedCount = 0;

  try {
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await db.withTransactionAsync(async () => {
        for (const entry of batch) {
          const result = await db.runAsync(
            "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
            entry.mood,
            entry.note,
            entry.timestamp,
            serializeEmotions(entry.emotions),
            serializeArray(entry.contextTags),
            entry.energy
          );

          if (entry.emotions.length > 0) {
            await linkEmotionsToMood(db, result.lastInsertRowId, entry.emotions);
          }

          insertedCount++;
        }
      });
    }
  } catch (error) {
    console.error("Error seeding moods:", error);
    console.error(
      `Inserted ${insertedCount} out of ${totalEntries} entries before error`
    );
    throw error;
  }

  return insertedCount;
}

export async function seedMoodsFromFile(): Promise<{
  source: "file" | "random";
  count: number;
}> {
  await clearMoods();

  if (__DEV__) {
    try {
      const jsonData = require("../export.json");

      if (Array.isArray(jsonData) && jsonData.length > 0) {
        const db = await getDb();

        for (const mood of jsonData) {
          const note = (mood as any)?.notes ?? (mood as any)?.note ?? null;
          const emotions = sanitizeImportedEmotions((mood as any)?.emotions);
          const contextSource =
            (mood as any)?.contextTags ?? (mood as any)?.context ?? [];
          const contextTags = sanitizeImportedArray(contextSource);
          const energy = sanitizeEnergy((mood as any)?.energy);
          const timestamp = parseTimestamp((mood as any)?.timestamp);
          const result = await db.runAsync(
            "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
            mood.mood,
            note,
            timestamp,
            serializeEmotions(emotions),
            serializeArray(contextTags),
            energy
          );

          if (emotions.length > 0) {
            await linkEmotionsToMood(db, result.lastInsertRowId, emotions);
          }
        }

        return { source: "file", count: jsonData.length };
      }
    } catch {
      console.log(
        "JSON file not found or invalid in dev mode, falling back to random seed"
      );
    }
  }

  const totalEntries = await seedMoods();
  return { source: "random", count: totalEntries };
}
