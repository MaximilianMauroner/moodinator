import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { importMoods } from "@db/db";
import { createBackup, getBackupFolder, getBackupInfo, setBackupFolder } from "@db/backup";
import { SettingsPageHeader } from "@/features/settings/components/SettingsPageHeader";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { SettingRow } from "@/features/settings/components/SettingRow";
import { ExportModal } from "@/features/settings/components/ExportModal";
import { formatBackupDate, formatBackupFolderPath } from "@/features/settings/utils/backupFormat";
import { isEncryptedString, decryptString } from "@/lib/encryption";
import { haptics } from "@/lib/haptics";

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

  // Encrypted import state
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [encryptedContent, setEncryptedContent] = useState<string | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

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
        haptics.success();
        Alert.alert("Backup Created", "Weekly backup created successfully.");
      } else {
        haptics.error();
        Alert.alert("Backup Failed", "Could not create backup.");
      }
    } catch (error) {
      haptics.error();
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
          haptics.success();
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

  const performImport = useCallback(async (jsonContent: string) => {
    try {
      const importedCount = await importMoods(jsonContent);
      haptics.patterns.successCelebration();
      Alert.alert("Import Successful", `Successfully imported ${importedCount} mood entries.`);
    } catch (error) {
      haptics.error();
      Alert.alert("Import Error", "Failed to import mood data. The file may be corrupted.");
      console.error(error);
    }
  }, []);

  const handleImport = useCallback(async () => {
    try {
      setLoading("import");
      // Accept both JSON and .enc files
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "application/octet-stream", "*/*"],
      });

      if (result.canceled) {
        setLoading(null);
        return;
      }

      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const fileName = result.assets[0].name || "";

      // Check if the file is encrypted
      if (fileName.endsWith(".enc") || isEncryptedString(fileContent)) {
        // Show password modal
        setEncryptedContent(fileContent);
        setImportPassword("");
        setDecryptError(null);
        setPasswordModalVisible(true);
        setLoading(null);
        return;
      }

      // Regular JSON import
      await performImport(fileContent);
    } catch (error) {
      haptics.error();
      Alert.alert("Import Error", "Failed to import mood data.");
      console.error(error);
    } finally {
      setLoading(null);
    }
  }, [performImport]);

  const handleDecryptAndImport = useCallback(async () => {
    if (!encryptedContent || !importPassword) return;

    setLoading("import");
    setDecryptError(null);

    try {
      const decrypted = decryptString(encryptedContent, importPassword);

      if (!decrypted) {
        haptics.error();
        setDecryptError("Incorrect password or corrupted file");
        setLoading(null);
        return;
      }

      // Close modal and perform import
      setPasswordModalVisible(false);
      setEncryptedContent(null);
      setImportPassword("");

      await performImport(decrypted);
    } catch (error) {
      haptics.error();
      setDecryptError("Failed to decrypt. Please check your password.");
      console.error(error);
    } finally {
      setLoading(null);
    }
  }, [encryptedContent, importPassword, performImport]);

  const handleCancelPasswordModal = useCallback(() => {
    setPasswordModalVisible(false);
    setEncryptedContent(null);
    setImportPassword("");
    setDecryptError(null);
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
            subLabel="Save your history as JSON (with optional encryption)"
            icon="download-outline"
            onPress={() => setExportModalVisible(true)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Import">
          <SettingRow
            label="Import Data"
            subLabel="Restore from JSON or encrypted backup"
            icon="cloud-upload-outline"
            onPress={handleImport}
            isLast
            action={
              loading === "import" && !passwordModalVisible ? (
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

      {/* Password Modal for Encrypted Imports */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelPasswordModal}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View
            className="w-full max-w-sm rounded-3xl p-6 bg-paper-100 dark:bg-paper-900"
            style={styles.modalShadow}
          >
            {/* Header */}
            <View className="items-center mb-6">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: isDark ? "#2D2A33" : "#EFECF2" }}
              >
                <Ionicons
                  name="lock-closed"
                  size={32}
                  color={isDark ? "#C4BBCF" : "#695C78"}
                />
              </View>
              <Text className="text-xl font-bold text-paper-800 dark:text-paper-200">
                Encrypted Backup
              </Text>
              <Text className="text-sm text-sand-500 dark:text-sand-400 text-center mt-1">
                Enter the password used to encrypt this backup
              </Text>
            </View>

            {/* Password Input */}
            <View className="mb-4">
              <View className="flex-row items-center bg-paper-200 dark:bg-paper-800 rounded-xl">
                <TextInput
                  value={importPassword}
                  onChangeText={(text) => {
                    setImportPassword(text);
                    setDecryptError(null);
                  }}
                  secureTextEntry={!showImportPassword}
                  placeholder="Enter password"
                  placeholderTextColor={isDark ? "#6B5C4A" : "#BDA77D"}
                  className="flex-1 p-4 text-paper-800 dark:text-paper-200"
                  style={styles.input}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => setShowImportPassword(!showImportPassword)}
                  className="p-4"
                >
                  <Ionicons
                    name={showImportPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={isDark ? "#6B5C4A" : "#BDA77D"}
                  />
                </TouchableOpacity>
              </View>

              {decryptError && (
                <View className="flex-row items-center mt-2 px-1">
                  <Ionicons name="alert-circle" size={16} color={isDark ? "#F5A899" : "#C75441"} />
                  <Text className="text-sm ml-1 text-coral-500 dark:text-coral-400">
                    {decryptError}
                  </Text>
                </View>
              )}
            </View>

            {/* Buttons */}
            <View className="gap-3">
              <TouchableOpacity
                onPress={handleDecryptAndImport}
                disabled={!importPassword || loading === "import"}
                className={`p-4 rounded-xl flex-row justify-center items-center ${
                  !importPassword || loading === "import"
                    ? "bg-dusk-200 dark:bg-dusk-800"
                    : "bg-dusk-500 dark:bg-dusk-600"
                }`}
              >
                {loading === "import" ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons
                      name="lock-open-outline"
                      size={20}
                      color="white"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-white font-bold text-base">
                      Decrypt & Import
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCancelPasswordModal}
                className="p-4 rounded-xl items-center bg-paper-200 dark:bg-paper-800"
              >
                <Text className="font-semibold text-sand-600 dark:text-sand-400">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  input: {
    fontSize: 16,
  },
});
