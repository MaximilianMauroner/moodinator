import { Linking } from "react-native";

import { Alert } from "@/components/ui/AppAlert";
import { presentCrisisSupportAlert } from "@/lib/crisisSupport";

export function showCrisisSupportAlert(): void {
  presentCrisisSupportAlert({
    showAlert: Alert.alert,
    openUrl: Linking.openURL,
  });
}
