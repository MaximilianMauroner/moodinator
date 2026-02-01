import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Notifications from "expo-notifications";
import {
  importMoods,
  clearMoods,
  seedMoods,
  updateEmotionCategoryInMoods,
  removeEmotionFromMoods,
  getEmotionNamesFromMoods,
} from "@db/db";
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
import type { Emotion } from "@db/types";
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
  const [newEmotionCategory, setNewEmotionCategory] =
    useState<Emotion["category"]>("neutral");
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
    const trimmedLower = trimmed.toLowerCase();
    if (emotions.some((emotion) => emotion.name.toLowerCase() === trimmedLower)) {
      Alert.alert("Duplicate Emotion", "This emotion is already in the list.");
      return;
    }
    const updated = [
      ...emotions,
      { name: trimmed, category: newEmotionCategory } as Emotion,
    ];
    await setEmotions(updated);
    setNewEmotion("");
  }, [emotions, newEmotion, newEmotionCategory, setEmotions]);

  const handleUpdateEmotionCategory = useCallback(
    async (name: string, category: Emotion["category"]) => {
      const target = name.trim().toLowerCase();
      const updated = emotions.map((emotion) =>
        emotion.name.trim().toLowerCase() === target
          ? { ...emotion, category }
          : emotion
      );

      const changed = emotions.some(
        (emotion) =>
          emotion.name.trim().toLowerCase() === target &&
          emotion.category !== category
      );
      if (!changed) {
        return;
      }

      await setEmotions(updated);
      try {
        const result = await updateEmotionCategoryInMoods(name, category);
        if (result.updated > 0) {
          Alert.alert("Updated", `Updated ${result.updated} entries.`);
        }
      } catch (error) {
        console.error("Failed to update mood entries for emotion:", error);
        Alert.alert(
          "Update Failed",
          "Emotion category updated in settings, but existing mood entries could not be updated."
        );
      }
    },
    [emotions, setEmotions]
  );

  const handleRemoveEmotion = useCallback(
    async (value: string) => {
      Alert.alert(
        "Remove Emotion",
        "Do you want to remove this emotion from settings only, or also from past entries?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Settings Only",
            onPress: async () => {
              const updated = emotions.filter((item) => item.name !== value);
              const finalList = updated.length > 0 ? updated : DEFAULT_EMOTIONS;
              await setEmotions(finalList);
            },
          },
          {
            text: "Also Past Entries",
            style: "destructive",
            onPress: async () => {
              const updated = emotions.filter((item) => item.name !== value);
              const finalList = updated.length > 0 ? updated : DEFAULT_EMOTIONS;
              await setEmotions(finalList);
              try {
                const result = await removeEmotionFromMoods(value);
                Alert.alert(
                  "Updated",
                  `Removed from ${result.updated} entries.`
                );
              } catch (error) {
                console.error("Failed to remove emotion from moods:", error);
                Alert.alert(
                  "Update Failed",
                  "Emotion removed from settings, but past entries could not be updated."
                );
              }
            },
          },
        ]
      );
    },
    [emotions, setEmotions]
  );

  const handleImportEmotionsFromEntries = useCallback(async () => {
    try {
      const names = await getEmotionNamesFromMoods();
      if (names.length === 0) {
        Alert.alert("No Emotions Found", "No emotions were found in past entries.");
        return;
      }

      const existing = new Set(
        emotions.map((emotion) => emotion.name.trim().toLowerCase())
      );
      const additions = names.filter(
        (name) => !existing.has(name.trim().toLowerCase())
      );

      if (additions.length === 0) {
        Alert.alert(
          "Up to Date",
          "All emotions from past entries are already in your presets."
        );
        return;
      }

      const updated = [
        ...emotions,
        ...additions.map(
          (name) => ({ name, category: "neutral" }) as Emotion
        ),
      ];

      await setEmotions(updated);
      Alert.alert(
        "Imported",
        `Added ${additions.length} emotion${additions.length === 1 ? "" : "s"} as neutral presets.`
      );
    } catch (error) {
      console.error("Failed to import emotions from entries:", error);
      Alert.alert("Import Failed", "Could not import emotions from entries.");
    }
  }, [emotions, setEmotions]);

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
      className="flex-1 bg-paper-100 dark:bg-paper-900"
      edges={["top"]}
    >
      {/* Header */}
      <View className="px-6 pt-4 pb-5 bg-paper-100 dark:bg-paper-900">
        <Text className="text-xs font-medium mb-1 text-sage-500 dark:text-sage-300">
          Customize your experience
        </Text>
        <Text className="text-2xl font-bold text-paper-800 dark:text-paper-200">
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
          newEmotionCategory={newEmotionCategory}
          setNewEmotion={setNewEmotion}
          setNewEmotionCategory={setNewEmotionCategory}
          newContext={newContext}
          setNewContext={setNewContext}
          onAddEmotion={handleAddEmotion}
          onRemoveEmotion={handleRemoveEmotion}
          onUpdateEmotionCategory={handleUpdateEmotionCategory}
          onImportEmotionsFromEntries={handleImportEmotionsFromEntries}
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

        {/* Version footer */}
        <View className="mt-8 mb-4 items-center">
          <View className="px-5 py-2.5 rounded-full bg-sage-100 dark:bg-sage-600/30">
            <Text className="text-xs font-medium text-sage-500 dark:text-sage-300">
              Moodinator v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>

      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
      />
    </SafeAreaView>
  );
}
