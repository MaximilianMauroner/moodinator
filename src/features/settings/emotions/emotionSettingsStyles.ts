import { Platform, StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  // Hero Section
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    overflow: "hidden",
  },
  heroCornerAccent: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  heroBadgeText: {
    fontSize: 15,
    fontWeight: "800",
  },
  heroProgressContainer: {
    marginBottom: 16,
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: "row",
    overflow: "hidden",
  },
  heroProgressSegment: {
    height: 8,
  },
  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  statPillCount: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Category Section
  categoryContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  categoryCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  categoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  categoryDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  actionSep: {
    marginHorizontal: 6,
    fontSize: 14,
  },
  categoryProgressTrack: {
    height: 3,
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 14,
  },
  categoryProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Chips
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  chipIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    letterSpacing: -0.2,
    maxWidth: 100,
  },
  chipEditBtn: {
    marginLeft: 6,
    padding: 2,
  },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginRight: 8,
    marginBottom: 8,
  },
  addChipText: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 4,
  },

  // Tips Section
  tipsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tipsCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  tipsIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    lineHeight: 18,
  },

  // FAB
  fabContainer: {
    position: "absolute",
    bottom: 28,
    right: 20,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  // Modal
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
  modalCancelBtn: {},
  modalBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveBtn: {},
  modalSaveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 6,
  },

  // Confirm dialog
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
  confirmCancelButton: {},
  confirmRemoveButton: {
    borderColor: "transparent",
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
});
