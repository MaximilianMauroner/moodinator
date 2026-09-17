import { StyleSheet } from "react-native";

import { presetDialogStyles } from "@/features/settings/presets/presetDialogStyles";

/**
 * Emotion dialog layout: category pills, the energy band row, and the move dialog.
 *
 * Shared modal and confirm layout comes from presetDialogStyles.
 */
export const styles = {
  ...presetDialogStyles,
  ...StyleSheet.create({
  modalCancelBtn: {},
  modalSaveBtn: {},
  modalCategoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  modalCategoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  modalCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  modalCategoryText: {
    fontSize: 14,
  },
  modalEnergySection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalEnergyTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalEnergyHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  modalEnergyRow: {
    flexDirection: "row",
    gap: 8,
  },
  modalEnergyPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  modalEnergyText: {
    fontSize: 12,
    textAlign: "center",
  },
  confirmCancelButton: {},
  confirmRemoveButton: {
    borderColor: "transparent",
  },
  moveCard: {
    maxWidth: 380,
  },
  moveBody: {
    marginBottom: 18,
  },
  moveOptions: {
    gap: 10,
    marginBottom: 14,
  },
  moveOption: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  moveOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  moveOptionLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },
  moveOptionHint: {
    fontSize: 13,
    fontWeight: "500",
  },
  moveCancelButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  }),
};
