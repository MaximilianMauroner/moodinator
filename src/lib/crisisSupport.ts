export const CRISIS_SUPPORT_THRESHOLD = 9;
export const CRISIS_SUPPORT_MAX_RATING = 10;
export const BLOCKED_SWIPE_THRESHOLD = 40;
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

export function requiresCrisisSupportAcknowledgement(
  mood: number,
  hasDismissedHint: boolean
): boolean {
  return shouldShowCrisisSupportHint(mood) && !hasDismissedHint;
}

type TouchPoint = {
  x: number;
  y: number;
};

export function isHorizontalSwipeAttempt(
  start: TouchPoint,
  end: TouchPoint
): boolean {
  const horizontalDistance = Math.abs(end.x - start.x);
  const verticalDistance = Math.abs(end.y - start.y);

  return (
    horizontalDistance >= BLOCKED_SWIPE_THRESHOLD &&
    horizontalDistance > verticalDistance
  );
}
