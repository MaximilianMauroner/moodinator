import { StyleSheet } from "react-native";

import { presetDialogStyles } from "@/features/settings/presets/presetDialogStyles";

/**
 * Context dialog layout: the tagline shown in the add-context modal.
 *
 * Shared modal and confirm layout comes from presetDialogStyles.
 */
export const styles = {
  ...presetDialogStyles,
  ...StyleSheet.create({
  modalTaglineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  modalTaglineIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  modalTagline: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    paddingTop: 5,
  },
  }),
};
