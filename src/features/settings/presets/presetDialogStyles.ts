import { Platform, StyleSheet } from "react-native";

/**
 * Modal and confirmation layout shared by the emotions and contexts dialogs.
 *
 * Both features carried their own copy of these blocks with identical values,
 * so a change to the sheet, the handle bar or the confirm card had to be made
 * twice. Screen-specific blocks stay in each feature.
 */
export const presetDialogStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.50)",
  },
  modalCard: {
    marginTop: 80,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    maxHeight: "86%",
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalCardContent: {
    paddingBottom: 4,
  },
  modalHandle: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  modalInputRow: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 6,
  },
  confirmOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12, 10, 8, 0.46)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 16,
  },
  confirmIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  confirmBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmRemoveText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 8,
  },
});
