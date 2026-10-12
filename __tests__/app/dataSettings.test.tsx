import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  getBackupInfo: vi.fn(),
  getBackupFolder: vi.fn(),
  setBackupFolder: vi.fn(),
  requestDirectoryPermissionsAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  ScrollView: "ScrollView",
  TouchableOpacity: "TouchableOpacity",
  ActivityIndicator: "ActivityIndicator",
  Platform: { OS: "android" },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("nativewind", () => ({ useColorScheme: () => ({ colorScheme: "dark" }) }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: vi.fn() }));
vi.mock("expo-file-system/legacy", () => ({
  StorageAccessFramework: { requestDirectoryPermissionsAsync: mocks.requestDirectoryPermissionsAsync },
}));
vi.mock("@/features/settings/components/SettingsPageHeader", () => ({ SettingsPageHeader: "SettingsPageHeader" }));
vi.mock("@/features/settings/components/SettingsSection", () => ({ SettingsSection: "SettingsSection" }));
vi.mock("@/features/settings/components/SettingRow", () => ({ SettingRow: "SettingRow" }));
vi.mock("@/features/settings/components/ExportModal", () => ({ ExportModal: "ExportModal" }));
vi.mock("@/constants/colors", () => ({ getThemedColor: () => "#000" }));
vi.mock("@/components/ui/AppAlert", () => ({ Alert: { alert: mocks.alert } }));
vi.mock("@/services/dataPortabilityService", () => ({
  dataPortabilityService: {
    getBackupInfo: mocks.getBackupInfo,
    getBackupFolder: mocks.getBackupFolder,
    setBackupFolder: mocks.setBackupFolder,
  },
}));

import DataSettingsScreen from "@/app/settings/data";

let renderer: ReactTestRenderer;
const backupFolderRow = () => renderer.root.findByProps({ label: "Backup Folder" });

async function selectNewFolder() {
  await act(async () => {
    renderer = create(<DataSettingsScreen />);
  });
  mocks.requestDirectoryPermissionsAsync.mockResolvedValue({
    granted: true,
    directoryUri: "content://provider/tree/NewFolder",
  });
  await act(async () => backupFolderRow().props.onPress());
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.values(mocks).forEach((mock) => mock.mockReset());
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.setBackupFolder.mockResolvedValue(undefined);
  mocks.getBackupInfo.mockResolvedValueOnce({ count: 2, latestBackup: null });
  mocks.getBackupFolder.mockResolvedValueOnce("content://provider/tree/OldFolder");
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.restoreAllMocks();
});

describe("backup folder selection", () => {
  it("keeps the saved folder on cold mount when backups cannot be read", async () => {
    mocks.getBackupInfo.mockReset();
    mocks.getBackupInfo.mockRejectedValueOnce(new Error("Provider I/O error"));

    await act(async () => {
      renderer = create(<DataSettingsScreen />);
    });

    expect(backupFolderRow().props.subLabel).toBe("Location: OldFolder");
    expect(
      renderer.root.findAllByType("Text").some((node) => node.props.children === "Could not read backups")
    ).toBe(true);
    expect(renderer.root.findByProps({ label: "Backup Status" }).props.subLabel)
      .toBe("Check folder access, then retry");
    expect(mocks.setBackupFolder).not.toHaveBeenCalled();
    expect(mocks.requestDirectoryPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("reports success after the new folder is read", async () => {
    mocks.getBackupInfo.mockResolvedValueOnce({ count: 0, latestBackup: null });
    mocks.getBackupFolder.mockResolvedValueOnce("content://provider/tree/NewFolder");

    await selectNewFolder();

    expect(mocks.alert).toHaveBeenCalledExactlyOnceWith("Backup Folder Selected", expect.any(String));
  });

  it("shows the new folder without a success message when the folder cannot be read", async () => {
    mocks.getBackupInfo.mockRejectedValueOnce(new Error("Provider I/O error"));
    mocks.getBackupFolder.mockResolvedValueOnce("content://provider/tree/NewFolder");

    await selectNewFolder();

    expect(mocks.setBackupFolder).toHaveBeenCalledExactlyOnceWith("content://provider/tree/NewFolder");
    expect(mocks.alert).toHaveBeenCalledExactlyOnceWith("Could Not Read Backups", expect.any(String));
    expect(backupFolderRow().props.subLabel).toBe("Location: NewFolder");
  });
});
