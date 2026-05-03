import type { Emotion } from "@db/types";

export function normalizePresetKey(value: string): string {
  return value.trim().toLowerCase();
}

export function hasPresetValue(values: string[], candidate: string): boolean {
  const candidateKey = normalizePresetKey(candidate);
  return values.some((value) => normalizePresetKey(value) === candidateKey);
}

export function hasEmotionPreset(emotions: Emotion[], candidate: string): boolean {
  const candidateKey = normalizePresetKey(candidate);
  return emotions.some((emotion) => normalizePresetKey(emotion.name) === candidateKey);
}

export function toggleContextPreset(
  contexts: string[],
  defaultContext: string
): string[] {
  const contextKey = normalizePresetKey(defaultContext);

  if (hasPresetValue(contexts, defaultContext)) {
    return contexts.filter((context) => normalizePresetKey(context) !== contextKey);
  }

  return [...contexts, defaultContext];
}

export function toggleEmotionPreset(
  emotions: Emotion[],
  defaultEmotion: Emotion
): Emotion[] {
  const emotionKey = normalizePresetKey(defaultEmotion.name);

  if (hasEmotionPreset(emotions, defaultEmotion.name)) {
    return emotions.filter((emotion) => normalizePresetKey(emotion.name) !== emotionKey);
  }

  return [...emotions, defaultEmotion];
}
