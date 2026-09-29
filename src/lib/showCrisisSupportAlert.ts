import { Linking } from "react-native";
import { getLocales } from "expo-localization";

import { showSupportSheet } from "@/components/ui/AppAlert";
import { presentCrisisSupportAlert } from "@/lib/crisisSupport";

/** Presents crisis support as the support-first sheet after a severe rating. */
export function showCrisisSupportAlert(options: { onDecline?: () => void } = {}): void {
  presentCrisisSupportAlert({
    onDecline: options.onDecline,
    showAlert: (title, message, buttons) => showSupportSheet(title, message, buttons ?? []),
    openUrl: Linking.openURL,
    getRegion: () => getLocales()[0]?.regionCode,
  });
}
