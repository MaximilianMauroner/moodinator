import React, { createContext, useContext } from "react";
import { Modal, type ModalProps } from "react-native";

const NavigatorHiddenContext = createContext(false);

/** The root layout sets this while it hides the navigator, e.g. behind App Lock. */
export const NavigatorHiddenProvider = NavigatorHiddenContext.Provider;

export function useNavigatorHidden() {
  return useContext(NavigatorHiddenContext);
}

/**
 * A React Native Modal opens its own native window above the root layout, so
 * the App Lock screen cannot cover it. This Modal closes that window while the
 * navigator is hidden and opens it again afterwards. The owner stays mounted,
 * so drafts kept in the owner survive; the modal's own content remounts.
 */
export function PrivateModal({ visible = true, animationType, ...props }: ModalProps) {
  const navigatorHidden = useNavigatorHidden();
  return (
    <Modal
      {...props}
      // iOS animates the dismissal with this setting; close at once instead of sliding out above the lock.
      animationType={navigatorHidden ? "none" : animationType}
      visible={visible && !navigatorHidden}
    />
  );
}
