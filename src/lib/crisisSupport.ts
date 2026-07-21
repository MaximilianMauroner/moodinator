export const CRISIS_SUPPORT_THRESHOLD = 9;
export const CRISIS_SUPPORT_MAX_RATING = 10;
export const FIND_A_HELPLINE_URL = "https://findahelpline.com/";

export type CrisisSupportAction = {
  id: "call-988" | "text-988" | "find-a-helpline";
  label: string;
  url: string;
  fallbackMessage: string;
};

export const CRISIS_SUPPORT_ACTIONS: readonly CrisisSupportAction[] = [
  {
    id: "call-988",
    label: "Call 988 (U.S.)",
    url: "tel:988",
    fallbackMessage: "Call 988 for crisis support in the United States.",
  },
  {
    id: "text-988",
    label: "Text 988 (U.S.)",
    url: "sms:988",
    fallbackMessage: "Text 988 for crisis support in the United States.",
  },
  {
    id: "find-a-helpline",
    label: "Find A Helpline",
    url: FIND_A_HELPLINE_URL,
    fallbackMessage: `Visit ${FIND_A_HELPLINE_URL} to look for support in your country.`,
  },
];

export function shouldOfferCrisisSupport(mood: number): boolean {
  return (
    Number.isInteger(mood) &&
    mood >= CRISIS_SUPPORT_THRESHOLD &&
    mood <= CRISIS_SUPPORT_MAX_RATING
  );
}
