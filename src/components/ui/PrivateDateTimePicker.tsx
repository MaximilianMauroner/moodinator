import React, { type ComponentProps } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigatorHidden } from "./PrivateModal";

/**
 * Android shows this picker in its own dialog window, so the App Lock screen
 * cannot cover it. The picker unmounts while the navigator is hidden. The
 * library then closes the dialog and reports the original value, so the owner
 * closes its picker without a change.
 */
export function PrivateDateTimePicker(props: ComponentProps<typeof DateTimePicker>) {
  return useNavigatorHidden() ? null : <DateTimePicker {...props} />;
}
