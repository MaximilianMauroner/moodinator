import { MOOD_MIN, MOOD_MAX, type Emotion, type Location, type MoodEntryInput } from "./types";

export type ValidationError = {
  field: string;
  message: string;
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

const ENERGY_MIN = 0;
const ENERGY_MAX = 10;
const MIN_VALID_TIMESTAMP = new Date("2000-01-01").getTime();
const MAX_FUTURE_TIMESTAMP_MS = 24 * 60 * 60 * 1000; // 1 day in the future

const VALID_CATEGORIES: Emotion["category"][] = ["positive", "negative", "neutral"];

function isValidTimestamp(timestamp: unknown): timestamp is number {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return false;
  }
  const now = Date.now();
  return timestamp >= MIN_VALID_TIMESTAMP && timestamp <= now + MAX_FUTURE_TIMESTAMP_MS;
}

function isValidMoodValue(mood: unknown): mood is number {
  return (
    typeof mood === "number" &&
    Number.isInteger(mood) &&
    mood >= MOOD_MIN &&
    mood <= MOOD_MAX
  );
}

function isValidEnergyValue(energy: unknown): energy is number | null {
  if (energy === null || energy === undefined) {
    return true;
  }
  return (
    typeof energy === "number" &&
    Number.isFinite(energy) &&
    energy >= ENERGY_MIN &&
    energy <= ENERGY_MAX
  );
}

function isValidEmotion(emotion: unknown): emotion is Emotion {
  if (typeof emotion !== "object" || emotion === null) {
    return false;
  }
  const e = emotion as Record<string, unknown>;
  return (
    typeof e.name === "string" &&
    e.name.trim().length > 0 &&
    typeof e.category === "string" &&
    VALID_CATEGORIES.includes(e.category as Emotion["category"])
  );
}

function isValidLocation(location: unknown): location is Location | null {
  if (location === null || location === undefined) {
    return true;
  }
  if (typeof location !== "object") {
    return false;
  }
  const loc = location as Record<string, unknown>;
  return (
    typeof loc.latitude === "number" &&
    typeof loc.longitude === "number" &&
    loc.latitude >= -90 &&
    loc.latitude <= 90 &&
    loc.longitude >= -180 &&
    loc.longitude <= 180
  );
}

function isStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every((item) => typeof item === "string");
}

export function validateMoodEntry(input: unknown): ValidationResult<MoodEntryInput> {
  const errors: ValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { success: false, errors: [{ field: "root", message: "Input must be an object" }] };
  }

  const entry = input as Record<string, unknown>;

  // Required: mood
  if (!isValidMoodValue(entry.mood)) {
    errors.push({
      field: "mood",
      message: `Mood must be an integer between ${MOOD_MIN} and ${MOOD_MAX}`,
    });
  }

  // Optional: timestamp
  if (entry.timestamp !== undefined && !isValidTimestamp(entry.timestamp)) {
    errors.push({
      field: "timestamp",
      message: "Timestamp must be a valid date between 2000 and now (+1 day)",
    });
  }

  // Optional: energy
  if (!isValidEnergyValue(entry.energy)) {
    errors.push({
      field: "energy",
      message: `Energy must be a number between ${ENERGY_MIN} and ${ENERGY_MAX}`,
    });
  }

  // Optional: note
  if (entry.note !== undefined && entry.note !== null && typeof entry.note !== "string") {
    errors.push({ field: "note", message: "Note must be a string" });
  }

  // Optional: emotions
  if (entry.emotions !== undefined) {
    if (!Array.isArray(entry.emotions)) {
      errors.push({ field: "emotions", message: "Emotions must be an array" });
    } else {
      entry.emotions.forEach((emotion, index) => {
        if (!isValidEmotion(emotion)) {
          errors.push({
            field: `emotions[${index}]`,
            message: "Each emotion must have a name and valid category (positive/negative/neutral)",
          });
        }
      });
    }
  }

  // Optional: contextTags
  if (entry.contextTags !== undefined && !isStringArray(entry.contextTags)) {
    errors.push({ field: "contextTags", message: "Context tags must be an array of strings" });
  }

  // Optional: photos
  if (entry.photos !== undefined && !isStringArray(entry.photos)) {
    errors.push({ field: "photos", message: "Photos must be an array of strings" });
  }

  // Optional: voiceMemos
  if (entry.voiceMemos !== undefined && !isStringArray(entry.voiceMemos)) {
    errors.push({ field: "voiceMemos", message: "Voice memos must be an array of strings" });
  }

  // Optional: location
  if (!isValidLocation(entry.location)) {
    errors.push({
      field: "location",
      message: "Location must have valid latitude (-90 to 90) and longitude (-180 to 180)",
    });
  }

  // Optional: basedOnEntryId
  if (
    entry.basedOnEntryId !== undefined &&
    entry.basedOnEntryId !== null &&
    (typeof entry.basedOnEntryId !== "number" || !Number.isInteger(entry.basedOnEntryId))
  ) {
    errors.push({ field: "basedOnEntryId", message: "basedOnEntryId must be an integer" });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Return validated data
  const validated: MoodEntryInput = {
    mood: entry.mood as number,
    note: entry.note as string | null | undefined,
    timestamp: entry.timestamp as number | undefined,
    emotions: entry.emotions as Emotion[] | undefined,
    contextTags: entry.contextTags as string[] | undefined,
    energy: entry.energy as number | null | undefined,
    photos: entry.photos as string[] | undefined,
    location: entry.location as Location | null | undefined,
    voiceMemos: entry.voiceMemos as string[] | undefined,
    basedOnEntryId: entry.basedOnEntryId as number | null | undefined,
  };

  return { success: true, data: validated };
}

export function validateMoodEntryArray(input: unknown): ValidationResult<MoodEntryInput[]> {
  if (!Array.isArray(input)) {
    return { success: false, errors: [{ field: "root", message: "Input must be an array" }] };
  }

  const allErrors: ValidationError[] = [];
  const validatedEntries: MoodEntryInput[] = [];

  input.forEach((entry, index) => {
    const result = validateMoodEntry(entry);
    if (result.success) {
      validatedEntries.push(result.data);
    } else {
      result.errors.forEach((error) => {
        allErrors.push({
          field: `[${index}].${error.field}`,
          message: error.message,
        });
      });
    }
  });

  if (allErrors.length > 0) {
    return { success: false, errors: allErrors };
  }

  return { success: true, data: validatedEntries };
}

export function sanitizeMoodValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 5; // Default to middle value
  }
  return Math.max(MOOD_MIN, Math.min(MOOD_MAX, Math.round(value)));
}

export function sanitizeEnergyValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(ENERGY_MIN, Math.min(ENERGY_MAX, Math.round(value)));
}

export function sanitizeTimestamp(value: unknown): number {
  if (isValidTimestamp(value)) {
    return value;
  }
  return Date.now();
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
}
