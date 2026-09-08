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
  getRegion?: () => string | null | undefined;
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

export function getCrisisSupportActions(region?: string | null): readonly CrisisSupportAction[] {
  if (region?.toUpperCase() === "US") return CRISIS_SUPPORT_ACTIONS;
  return [CRISIS_SUPPORT_ACTIONS[2], ...CRISIS_SUPPORT_ACTIONS.slice(0, 2)];
}

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
  let region: string | null | undefined;
  try {
    region = dependencies.getRegion?.();
  } catch {
    // A missing device locale must never prevent access to support.
    region = null;
  }
  dependencies.showAlert(
    "Support is available",
    `${LOCAL_EMERGENCY_GUIDANCE} Moodinator does not monitor entries, contact emergency services, or dispatch help.`,
    [
      ...getCrisisSupportActions(region).map((action) => ({
        text: action.label,
        onPress: () => openSupportAction(action, dependencies),
      })),
      { text: "Not now", style: "cancel" },
    ]
  );
}
