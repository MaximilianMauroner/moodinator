export const REMINDER_PRESETS = [
  { id: "morning", label: "Morning", hour: 9, minute: 0, weekdays: [1, 2, 3, 4, 5, 6, 7] },
  { id: "evening", label: "Evening", hour: 20, minute: 0, weekdays: [1, 2, 3, 4, 5, 6, 7] },
  { id: "weekdays", label: "Weekdays", hour: 20, minute: 0, weekdays: [2, 3, 4, 5, 6] },
] as const;

export const DEFAULT_REMINDER_COPY = {
  title: "How are you feeling?",
  body: "Take a moment to check in with yourself.",
};
