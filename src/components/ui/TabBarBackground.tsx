import { BlurView } from "expo-blur";
import { Platform } from "react-native";

// Enhanced TabBarBackground with blur effect on iOS
export default Platform.select({
  ios: () => <BlurView intensity={80} style={{ flex: 1 }} />,
  default: undefined,
});

export function useBottomTabOverflow() {
  return 16;
}
