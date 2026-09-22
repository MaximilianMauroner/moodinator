const HOME_JUMP_BUTTON_EDGE_GAP = 12;

interface HomeJumpButtonOffsetOptions {
  platform: string;
  safeAreaBottom: number;
  tabBarHeight: number;
}

export function getHomeJumpButtonBottomOffset({
  platform,
  safeAreaBottom,
  tabBarHeight,
}: HomeJumpButtonOffsetOptions) {
  if (platform !== "ios") {
    return HOME_JUMP_BUTTON_EDGE_GAP;
  }

  // iOS renders the tab bar over the scene. SafeAreaView already contributes
  // the device inset, so add only the navigator-measured bar content height.
  return Math.max(0, tabBarHeight - safeAreaBottom) + HOME_JUMP_BUTTON_EDGE_GAP;
}
