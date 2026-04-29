import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";
import { ExportModal } from "@/features/settings/components/ExportModal";
import { formatBackupDate, formatBackupFolderPath } from "@/features/settings/utils/backupFormat";
import { dataPortabilityService } from "@/services/dataPortabilityService";

export default function DataSettingsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [loading, setLoading] = useState<"import" | "backup" | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{
    count: number;
    latestBackup: number | null;
  } | null>(null);
  const [backupFolderUri, setBackupFolderUri] = useState<string | null>(null);

  const loadBackupInfo = useCallback(async () => {
    const info = await dataPortabilityService.getBackupInfo();
    setBackupInfo({ count: info.count, latestBackup: info.latestBackup });
    const folderUri = await dataPortabilityService.getBackupFolder();
    setBackupFolderUri(folderUri);
  }, []);

  useEffect(() => {
    loadBackupInfo();
  }, [loadBackupInfo]);

  const handleManualBackup = useCallback(async () => {
    try {
      setLoading("backup");
      const backupResult = await dataPortabilityService.createBackup();
      if (backupResult.success) {
        await loadBackupInfo();
        Alert.alert("Backup Created", "Weekly backup created successfully.");
      } else {
        Alert.alert("Backup Failed", backupResult.error);
      }
    } catch (error) {
      Alert.alert("Backup Error", "Failed to create backup.");
      console.error(error);
    } finally {
      setLoading(null);
    }
  }, [loadBackupInfo]);

  const handleSelectBackupFolder = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const folderUri = permissions.directoryUri;
          await dataPortabilityService.setBackupFolder(folderUri);
          await loadBackupInfo();
          Alert.alert("Backup Folder Selected", "Backups will now be saved to the selected folder.");
        } else {
          Alert.alert("Permission Denied", "Please grant folder access to enable backup functionality.");
        }
      } else {
        Alert.alert("Backup Location", "On iOS, backups are saved to the app's Documents folder.");
      }
    } catch (error) {
      console.error("Error selecting backup folder:", error);
      Alert.alert("Error", "Failed to select backup folder.");
    }
  }, [loadBackupInfo]);

  const handleImport = useCallback(async () => {
    try {
      setLoading("import");
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json" });
      if (result.canceled) {
        setLoading(null);
        return;
      }
      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
      Alert.alert(
        "Replace Current Data?",
        "Data Import replaces your current local Moodinator data with the selected file. This cannot be undone unless you have a separate Data Export or Backup.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setLoading(null),
          },
          {
            text: "Replace Data",
            style: "destructive",
            onPress: async () => {
              try {
                const importResult = await dataPortabilityService.importData(fileContent);
                const summary = [
                  `Imported ${importResult.imported} entr${importResult.imported === 1 ? "y" : "ies"}.`,
                  importResult.skipped > 0
                    ? `Skipped ${importResult.skipped} invalid entr${importResult.skipped === 1 ? "y" : "ies"}.`
                    : null,
                  importResult.errors.length > 0
                    ? importResult.errors.slice(0, 2).join("\n")
                    : null,
                ]
                  .filter(Boolean)
                  .join("\n\n");
                Alert.alert("Import Successful", summary);
              } catch (error) {
                Alert.alert("Import Error", "Failed to import mood data.");
                console.error(error);
              } finally {
                setLoading(null);
              }
            },
          },
        ]
      );
      return;
    } catch (error) {
      Alert.alert("Import Error", "Failed to import mood data.");
      console.error(error);
    }
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      <SettingsPageHeader
        title="Data & Backups"
        subtitle="Data"
        icon="cloud-outline"
        accentColor="sage"
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Backup status banner */}
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-sage-100 dark:bg-sage-600/20">
          <View className="flex-row items-center mb-2">
            <Ionicons
              name={backupInfo && backupInfo.count > 0 ? "cloud-done-outline" : "cube-outline"}
              size={20}
              color={isDark ? "#A8C5A8" : "#5B8A5B"}
              style={{ marginRight: 8 }}
            />
            <Text className="text-base font-bold text-sage-500 dark:text-sage-300">
              {backupInfo
                ? backupInfo.count > 0
                  ? `${backupInfo.count} backup${backupInfo.count === 1 ? "" : "s"} saved`
                  : "No backups yet"
                : "Checking..."}
            </Text>
          </View>
          {backupInfo?.latestBackup && (
            <Text className="text-xs text-sand-500 dark:text-sand-400">
              Last backup: {formatBackupDate(backupInfo.latestBackup)}
            </Text>
          )}
        </View>

        <SettingsSection title="Data Export">
          <SettingRow
            label="Export Data"
            subLabel="Save your history as JSON file"
            icon="download-outline"
            onPress={() => setExportModalVisible(true)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Data Import">
          <SettingRow
            label="Import Data"
            subLabel="Replace current data from a JSON export or backup"
            icon="cloud-upload-outline"
            onPress={handleImport}
            isLast
            action={
              loading === "import" ? (
                <ActivityIndicator size="small" color={isDark ? "#A8C5A8" : "#5B8A5B"} />
              ) : undefined
            }
          />
        </SettingsSection>

        <SettingsSection title="Automatic Backups">
          {Platform.OS === "android" && (
            <SettingRow
              label="Backup Folder"
              subLabel={
                backupFolderUri
                  ? `Location: ${formatBackupFolderPath(backupFolderUri)}`
                  : "Select a folder for automatic backups"
              }
              icon="folder-outline"
              onPress={handleSelectBackupFolder}
            />
          )}
          <SettingRow
            label="Backup Status"
            subLabel={
              backupInfo
                ? `${backupInfo.count} backup(s), last: ${formatBackupDate(backupInfo.latestBackup)}`
                : "Checking backup status..."
            }
            icon="cloud-done-outline"
            isLast
            action={
              <TouchableOpacity onPress={handleManualBackup} disabled={loading === "backup"}>
                <View className="px-3 py-1.5 rounded-full bg-sage-100 dark:bg-sage-600/20">
                  {loading === "backup" ? (
                    <ActivityIndicator size="small" color={isDark ? "#A8C5A8" : "#5B8A5B"} />
                  ) : (
                    <Text className="font-semibold text-xs text-sage-500 dark:text-sage-300">
                      Run Backup
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            }
          />
        </SettingsSection>
      </ScrollView>

      <ExportModal visible={exportModalVisible} onClose={() => setExportModalVisible(false)} />
    </SafeAreaView>
  );
}
