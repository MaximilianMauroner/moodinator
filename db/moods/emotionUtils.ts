import type { Emotion } from "../types";
import {
  DEFAULT_EMOTIONS,
  isEmotionEnergyBand,
} from "../../domain/entrySettings";

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
    const raw = item as Record<string, unknown>;
    const emotion: Emotion = {
      name: String((item as any).name).trim(),
      category: (item as any).category || "neutral",
    };
    if (isEmotionEnergyBand(raw.energy)) emotion.energy = raw.energy;
    return emotion;
  }
  return null;
}
