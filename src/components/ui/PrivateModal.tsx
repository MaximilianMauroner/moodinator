import React, { createContext, useContext } from "react";
import { Modal, type ModalProps } from "react-native";

const NavigatorHiddenContext = createContext(false);

/** The root layout sets this while it hides the navigator, e.g. behind App Lock. */
export const NavigatorHiddenProvider = NavigatorHiddenContext.Provider;

/**
 * A React Native Modal opens its own native window above the root layout, so
 * the App Lock screen cannot cover it. This Modal closes that window while the
 * navigator is hidden and opens it again afterwards. The owner stays mounted,
 * so drafts kept in the owner survive; the modal's own content remounts.
 */
export function PrivateModal({ visible = true, ...props }: ModalProps) {
  const navigatorHidden = useContext(NavigatorHiddenContext);
  return <Modal {...props} visible={visible && !navigatorHidden} />;
}
