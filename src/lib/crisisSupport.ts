export const CRISIS_SUPPORT_THRESHOLD = 9;
export const CRISIS_SUPPORT_MAX_RATING = 10;

export type CrisisSupportAction = {
  id: "call-988" | "text-988";
  label: string;
  url: string;
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
const CRISIS_HELPLINE_GUIDANCE =
  "In the United States, call or text 988. Elsewhere, contact a local crisis helpline.";

export const CRISIS_SUPPORT_ACTIONS: readonly CrisisSupportAction[] = [
  {
    id: "call-988",
    label: "Call 988 (U.S.)",
    url: "tel:988",
  },
  {
    id: "text-988",
    label: "Text 988 (U.S.)",
    url: "sms:988",
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
    const appName = action.id === "call-988" ? "phone" : "messaging";

    dependencies.showAlert(
      "Unable to open this action",
      `This device could not open the ${appName} app. ${LOCAL_EMERGENCY_GUIDANCE} ${CRISIS_HELPLINE_GUIDANCE}`,
      [{ text: "OK", style: "cancel" }]
    );
  });
}

export function presentCrisisSupportAlert(
  dependencies: CrisisSupportDependencies
): void {
  dependencies.showAlert(
    "Support is available",
    `${LOCAL_EMERGENCY_GUIDANCE} ${CRISIS_HELPLINE_GUIDANCE} Moodinator does not monitor entries, contact emergency services, or dispatch help.`,
    [
      ...CRISIS_SUPPORT_ACTIONS.map((action) => ({
        text: action.label,
        onPress: () => openSupportAction(action, dependencies),
      })),
      { text: "Not now", style: "cancel" },
    ]
  );
}
