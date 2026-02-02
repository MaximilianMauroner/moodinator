import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { importMoods } from "@db/db";
import { createBackup, getBackupFolder, getBackupInfo, setBackupFolder } from "@db/backup";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";
import { ExportModal } from "@/features/settings/components/ExportModal";
import { formatBackupDate, formatBackupFolderPath } from "@/features/settings/utils/backupFormat";

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
    const info = await getBackupInfo();
    setBackupInfo({ count: info.count, latestBackup: info.latestBackup });
    const folderUri = await getBackupFolder();
    setBackupFolderUri(folderUri);
  }, []);

  useEffect(() => {
    loadBackupInfo();
  }, [loadBackupInfo]);

  const handleManualBackup = useCallback(async () => {
    try {
      setLoading("backup");
      const backupUri = await createBackup();
      if (backupUri) {
        await loadBackupInfo();
        Alert.alert("Backup Created", "Weekly backup created successfully.");
      } else {
        Alert.alert("Backup Failed", "Could not create backup.");
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
          await setBackupFolder(folderUri);
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
      if (result.canceled) return;
      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const importedCount = await importMoods(fileContent);
      Alert.alert("Import Successful", `Successfully imported ${importedCount} mood entries.`);
    } catch (error) {
      Alert.alert("Import Error", "Failed to import mood data.");
      console.error(error);
    } finally {
      setLoading(null);
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
            <Text className="text-2xl mr-2">
              {backupInfo && backupInfo.count > 0 ? "☁️" : "📦"}
            </Text>
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

        <SettingsSection title="Export">
          <SettingRow
            label="Export Data"
            subLabel="Save your history as JSON file"
            icon="download-outline"
            onPress={() => setExportModalVisible(true)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Import">
          <SettingRow
            label="Import Data"
            subLabel="Restore from a JSON backup file"
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
                      Backup Now
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
