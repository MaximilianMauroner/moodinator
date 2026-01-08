import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Notifications from "expo-notifications";
import { importMoods, clearMoods, seedMoods } from "@db/db";
import {
  createBackup,
  getBackupFolder,
  getBackupInfo,
  setBackupFolder,
} from "@db/backup";
import { useNotifications } from "@/hooks/useNotifications";
import { useSettingsStore } from "@/shared/state/settingsStore";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  type QuickEntryPrefs,
} from "@/lib/entrySettings";
import { PreferencesSection } from "../sections/PreferencesSection";
import { EntryCustomizationSection } from "../sections/EntryCustomizationSection";
import { DataSection } from "../sections/DataSection";
import { AdvancedSection } from "../sections/AdvancedSection";
import { ExportModal } from "../components/ExportModal";

export function SettingsScreen() {
  const [loading, setLoading] = useState<
    "import" | "seed" | "clear" | "backup" | null
  >(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [newEmotion, setNewEmotion] = useState("");
  const [newContext, setNewContext] = useState("");
  const [backupInfo, setBackupInfo] = useState<{
    count: number;
    latestBackup: number | null;
  } | null>(null);
  const [backupFolderUri, setBackupFolderUri] = useState<string | null>(null);

  const hydrate = useSettingsStore((state) => state.hydrate);
  const showDetailedLabels = useSettingsStore((state) => state.showDetailedLabels);
  const setShowDetailedLabels = useSettingsStore((state) => state.setShowDetailedLabels);
  const devOptionsEnabled = useSettingsStore((state) => state.devOptionsEnabled);
  const setDevOptionsEnabled = useSettingsStore((state) => state.setDevOptionsEnabled);
  const emotions = useSettingsStore((state) => state.emotions);
  const setEmotions = useSettingsStore((state) => state.setEmotions);
  const contexts = useSettingsStore((state) => state.contexts);
  const setContexts = useSettingsStore((state) => state.setContexts);
  const quickEntryPrefs = useSettingsStore((state) => state.quickEntryPrefs);
  const setQuickEntryPrefs = useSettingsStore((state) => state.setQuickEntryPrefs);
  useNotifications();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
          Alert.alert(
            "Backup Folder Selected",
            "Backups will now be saved to the selected folder."
          );
        } else {
          Alert.alert(
            "Permission Denied",
            "Please grant folder access to enable backup functionality."
          );
        }
      } else {
        Alert.alert(
          "Backup Location",
          "On iOS, backups are saved to the app's Documents folder, which is accessible via the Files app. No folder selection needed."
        );
      }
    } catch (error) {
      console.error("Error selecting backup folder:", error);
      Alert.alert("Error", "Failed to select backup folder.");
    }
  }, [loadBackupInfo]);

  const handleAddEmotion = useCallback(async () => {
    const trimmed = newEmotion.trim();
    if (!trimmed) {
      return;
    }
    if (emotions.includes(trimmed)) {
      Alert.alert("Duplicate Emotion", "This emotion is already in the list.");
      return;
    }
    const updated = [...emotions, trimmed];
    await setEmotions(updated);
    setNewEmotion("");
  }, [emotions, newEmotion, setEmotions]);

  const handleRemoveEmotion = useCallback(
    async (value: string) => {
      const updated = emotions.filter((item) => item !== value);
      const finalList = updated.length > 0 ? updated : DEFAULT_EMOTIONS;
      await setEmotions(finalList);
    },
    [emotions, setEmotions]
  );

  const handleAddContext = useCallback(async () => {
    const trimmed = newContext.trim();
    if (!trimmed) {
      return;
    }
    if (contexts.includes(trimmed)) {
      Alert.alert("Duplicate Context", "This context already exists.");
      return;
    }
    const updated = [...contexts, trimmed];
    await setContexts(updated);
    setNewContext("");
  }, [contexts, newContext, setContexts]);

  const handleRemoveContext = useCallback(
    async (value: string) => {
      const updated = contexts.filter((item) => item !== value);
      const finalList = updated.length > 0 ? updated : DEFAULT_CONTEXTS;
      await setContexts(finalList);
    },
    [contexts, setContexts]
  );

  const handleQuickEntryToggle = useCallback(
    async (key: keyof QuickEntryPrefs, value: boolean) => {
      const updated = { ...quickEntryPrefs, [key]: value };
      await setQuickEntryPrefs(updated);
    },
    [quickEntryPrefs, setQuickEntryPrefs]
  );

  const handleImport = useCallback(async () => {
    try {
      setLoading("import");
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
      });

      if (result.canceled) {
        return;
      }

      const fileContent = await FileSystem.readAsStringAsync(
        result.assets[0].uri
      );
      const importedCount = await importMoods(fileContent);
      Alert.alert(
        "Import Successful",
        `Successfully imported ${importedCount} mood entries.`
      );
    } catch (error) {
      Alert.alert("Import Error", "Failed to import mood data.");
      console.error(error);
    } finally {
      setLoading(null);
    }
  }, []);

  const handleSeedMoods = useCallback(async () => {
    try {
      setLoading("seed");
      const result = await seedMoods();
      Alert.alert(
        "Sample Data Added",
        `Successfully added ${result} sample mood entries.`
      );
    } catch {
      Alert.alert("Error", "Failed to add sample data");
    } finally {
      setLoading(null);
    }
  }, []);

  const handleTestNotification = useCallback(async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Notification",
        body: "This is a test notification!",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
    Alert.alert("Scheduled", "Notification will appear in 2 seconds.");
  }, []);

  const handleClearMoods = useCallback(() => {
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to delete all mood data? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading("clear");
              await clearMoods();
              Alert.alert("Success", "All mood data has been cleared.");
            } catch {
              Alert.alert("Error", "Failed to clear mood data");
            } finally {
              setLoading(null);
            }
          },
        },
      ]
    );
  }, []);

  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      edges={["top"]}
    >
      <View className="px-6 pt-2 pb-4 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
        <Text className="text-3xl font-extrabold text-slate-900 dark:text-white">
          Settings
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <PreferencesSection
          showDetailedLabels={showDetailedLabels}
          onToggleDetailedLabels={setShowDetailedLabels}
        />
        <EntryCustomizationSection
          quickEntryPrefs={quickEntryPrefs}
          onQuickEntryToggle={handleQuickEntryToggle}
          emotions={emotions}
          contexts={contexts}
          newEmotion={newEmotion}
          setNewEmotion={setNewEmotion}
          newContext={newContext}
          setNewContext={setNewContext}
          onAddEmotion={handleAddEmotion}
          onRemoveEmotion={handleRemoveEmotion}
          onAddContext={handleAddContext}
          onRemoveContext={handleRemoveContext}
        />
        <DataSection
          onExport={() => setExportModalVisible(true)}
          onImport={handleImport}
          backupInfo={backupInfo}
          backupFolderUri={backupFolderUri}
          onSelectBackupFolder={handleSelectBackupFolder}
          onManualBackup={handleManualBackup}
          isBusy={loading === "backup"}
        />
        <AdvancedSection
          devOptionsEnabled={devOptionsEnabled}
          onToggleDevOptions={setDevOptionsEnabled}
          onSeedMoods={handleSeedMoods}
          onTestNotification={handleTestNotification}
          onClearMoods={handleClearMoods}
        />

        <View className="mt-8 mb-4 items-center">
          <Text className="text-slate-400 text-xs">Moodinator v1.0.0</Text>
        </View>
      </ScrollView>

      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
      />
    </SafeAreaView>
  );
}
