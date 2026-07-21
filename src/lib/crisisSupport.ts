export const CRISIS_SUPPORT_THRESHOLD = 9;
export const CRISIS_SUPPORT_MAX_RATING = 10;
export const FIND_A_HELPLINE_URL = "https://findahelpline.com/";

export type CrisisSupportAction = {
  id: "call-988" | "text-988" | "find-a-helpline";
  label: string;
  url: string;
  fallbackMessage: string;
};

export type CrisisSupportAlertButton = {
  text: string;
  style?: "cancel";
  onPress?: () => void;
};

export type CrisisSupportDependencies = {
  showAlert: (
    title: string,
    message: string,
    buttons?: CrisisSupportAlertButton[]
  ) => void;
  openUrl: (url: string) => Promise<unknown>;
};

const LOCAL_EMERGENCY_GUIDANCE =
  "If you or someone else may be in immediate danger, call your local emergency number now.";

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

function openSupportAction(
  action: CrisisSupportAction,
  dependencies: CrisisSupportDependencies
): void {
  void dependencies.openUrl(action.url).catch(() => {
    const findAHelplineAction = CRISIS_SUPPORT_ACTIONS.find(
      (candidate) => candidate.id === "find-a-helpline"
    );
    const fallbackButtons: CrisisSupportAlertButton[] = [];

    if (action.id !== "find-a-helpline" && findAHelplineAction) {
      fallbackButtons.push({
        text: findAHelplineAction.label,
        onPress: () => openSupportAction(findAHelplineAction, dependencies),
      });
    }
    fallbackButtons.push({ text: "Not now", style: "cancel" });

    dependencies.showAlert(
      "Unable to open support",
      `${LOCAL_EMERGENCY_GUIDANCE} ${action.fallbackMessage}`,
      fallbackButtons
    );
  });
}

export function presentCrisisSupportAlert(
  dependencies: CrisisSupportDependencies
): void {
  dependencies.showAlert(
    "Support is available",
    `${LOCAL_EMERGENCY_GUIDANCE} Moodinator does not monitor entries, contact emergency services, or dispatch help.`,
    [
      ...CRISIS_SUPPORT_ACTIONS.map((action) => ({
        text: action.label,
        onPress: () => openSupportAction(action, dependencies),
      })),
      { text: "Not now", style: "cancel" },
    ]
  );
}
