import type { Emotion } from "../types";
import { DEFAULT_EMOTIONS } from "../../src/lib/entrySettings";

export function parseEmotionItem(item: unknown): Emotion | null {
  if (typeof item === "string" && item.trim().length > 0) {
    const name = item.trim();
    const defaultEmotion = DEFAULT_EMOTIONS.find((e) => e.name === name);
    return {
      name,
      category: defaultEmotion ? defaultEmotion.category : "neutral",
    };
  }
  if (typeof item === "object" && item !== null && (item as any).name) {
    return {
      name: String((item as any).name).trim(),
      category: (item as any).category || "neutral",
    };
  }
  return null;
}
