import AsyncStorage from "@react-native-async-storage/async-storage";

const EMOTIONS_KEY = "customEmotionsList";

export const DEFAULT_EMOTIONS: string[] = [
  "happy",
  "sad",
  "angry",
  "afraid",
  "surprised",
  "disgusted",
  "confused",
  "excited",
  "bored",
  "calm",
  "lonely",
  "nervous",
  "hopeful",
  "jealous",
  "embarrassed",
  "grateful",
  "content",
  "frustrated",
  "proud",
  "ashamed",
];

export async function getEmotions(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(EMOTIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((e) => typeof e === "string")) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_EMOTIONS;
}

export async function saveEmotions(emotions: string[]): Promise<void> {
  const normalized = Array.from(
    new Set(emotions.map((e) => e.trim()).filter((e) => e.length > 0))
  );
  await AsyncStorage.setItem(EMOTIONS_KEY, JSON.stringify(normalized));
}

export { EMOTIONS_KEY };


