export const CRISIS_SUPPORT_THRESHOLD = 9;
export const CRISIS_SUPPORT_MAX_RATING = 10;
export const CRISIS_SUPPORT_TITLE = "If you need support";
export const CRISIS_SUPPORT_MESSAGE =
  "If you or someone else may be in immediate danger, call your local emergency number. You may also want to contact a local crisis helpline.";

export function shouldShowCrisisSupportHint(mood: number): boolean {
  return (
    Number.isInteger(mood) &&
    mood >= CRISIS_SUPPORT_THRESHOLD &&
    mood <= CRISIS_SUPPORT_MAX_RATING
  );
}
