import { Linking } from "react-native";

import { Alert } from "@/components/ui/AppAlert";
import { CRISIS_SUPPORT_ACTIONS, type CrisisSupportAction } from "@/lib/crisisSupport";

function openSupportAction(action: CrisisSupportAction): void {
  Linking.openURL(action.url).catch(() => {
    Alert.alert("Unable to open support", action.fallbackMessage);
  });
}

export function showCrisisSupportAlert(): void {
  Alert.alert(
    "Support is available",
    "If you or someone else may be in immediate danger, call your local emergency number now. Moodinator does not monitor entries, contact emergency services, or dispatch help.",
    [
      ...CRISIS_SUPPORT_ACTIONS.map((action) => ({
        text: action.label,
        onPress: () => openSupportAction(action),
      })),
      { text: "Not now", style: "cancel" as const },
    ]
  );
}
