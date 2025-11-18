import React, { useState, useEffect, memo } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { Link } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  exportMoods,
  importMoods,
  clearMoods,
  seedMoodsFromFile,
} from "@db/db";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_CONTEXTS,
  DEFAULT_EMOTIONS,
  DEFAULT_QUICK_ENTRY_PREFS,
  QuickEntryPrefs,
  getContextTags,
  getEmotionPresets,
  getQuickEntryPrefs,
  saveContextTags,
  saveEmotionPresets,
  saveQuickEntryPrefs,
} from "@/lib/entrySettings";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNotifications } from "@/hooks/useNotifications";
// Storage key for show labels preference
const SHOW_LABELS_KEY = "showLabelsPreference";
const DEV_OPTIONS_KEY = "devOptionsEnabled";

export default function SettingsScreen() {
  const [loading, setLoading] = useState<
    "export" | "import" | "seed" | "clear" | null
  >(null);
  const [showDetailedLabels, setShowDetailedLabels] = useState(false);
  const [devOptionsEnabled, setDevOptionsEnabled] = useState(false);
  const [lastSeedResult, setLastSeedResult] = useState<{
    count: number;
    source: "file" | "random";
  } | null>(null);

  const [emotions, setEmotions] = useState<string[]>(DEFAULT_EMOTIONS);
  const [contexts, setContexts] = useState<string[]>(DEFAULT_CONTEXTS);
  const [quickEntryPrefs, setQuickEntryPrefs] = useState<QuickEntryPrefs>(
    DEFAULT_QUICK_ENTRY_PREFS
  );
  const [newEmotion, setNewEmotion] = useState("");
  const [newContext, setNewContext] = useState("");
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportRange, setExportRange] = useState<"week" | "month" | "custom">(
    "week"
  );
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date;
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date());
  useNotifications();

  // Load saved preferences on component mount
  useEffect(() => {
    loadShowLabelsPreference();
    loadDevOptionsPreference();
    loadEmotionPresets();
    loadContextTags();
    loadQuickEntryPrefs();
  }, []);

  // Load the saved preference
  const loadShowLabelsPreference = async () => {
    try {
      const value = await AsyncStorage.getItem(SHOW_LABELS_KEY);
      if (value !== null) {
        setShowDetailedLabels(value === "true");
      }
    } catch (error) {
      console.error("Failed to load label preference:", error);
    }
  };

  // Load dev options preference
  const loadDevOptionsPreference = async () => {
    try {
      const value = await AsyncStorage.getItem(DEV_OPTIONS_KEY);
      if (value !== null) {
        setDevOptionsEnabled(value === "true");
      }
    } catch (error) {
      console.error("Failed to load dev options preference:", error);
    }
  };

  const loadEmotionPresets = async () => {
    const list = await getEmotionPresets();
    setEmotions(list);
  };

  const loadContextTags = async () => {
    const list = await getContextTags();
    setContexts(list);
  };

  const loadQuickEntryPrefs = async () => {
    const prefs = await getQuickEntryPrefs();
    setQuickEntryPrefs(prefs);
  };

  const handleAddEmotion = async () => {
    const trimmed = newEmotion.trim();
    if (!trimmed) return;
    if (emotions.includes(trimmed)) {
      Alert.alert("Duplicate Emotion", "This emotion is already in the list.");
      return;
    }
    const updated = [...emotions, trimmed];
    setEmotions(updated);
    setNewEmotion("");
    await saveEmotionPresets(updated);
  };

  const handleRemoveEmotion = async (value: string) => {
    const updated = emotions.filter((item) => item !== value);
    const finalList = updated.length > 0 ? updated : DEFAULT_EMOTIONS;
    setEmotions(finalList);
    await saveEmotionPresets(finalList);
  };

  const handleAddContext = async () => {
    const trimmed = newContext.trim();
    if (!trimmed) return;
    if (contexts.includes(trimmed)) {
      Alert.alert("Duplicate Context", "This context already exists.");
      return;
    }
    const updated = [...contexts, trimmed];
    setContexts(updated);
    setNewContext("");
    await saveContextTags(updated);
  };

  const handleRemoveContext = async (value: string) => {
    const updated = contexts.filter((item) => item !== value);
    const finalList = updated.length > 0 ? updated : DEFAULT_CONTEXTS;
    setContexts(finalList);
    await saveContextTags(finalList);
  };

  const handleQuickEntryToggle = async (
    key: keyof QuickEntryPrefs,
    value: boolean
  ) => {
    const updated = {
      ...quickEntryPrefs,
      [key]: value,
    };
    setQuickEntryPrefs(updated);
    await saveQuickEntryPrefs(updated);
  };

  const resolveExportRange = () => {
    if (exportRange === "week" || exportRange === "month") {
      return { preset: exportRange };
    }
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (end.getTime() < start.getTime()) {
      Alert.alert("Invalid Range", "End date must be after the start date.");
      return null;
    }
    return {
      startDate: start.getTime(),
      endDate: end.getTime(),
    };
  };

  const formatDateSlug = (date: Date) => date.toISOString().split("T")[0];

  const shareJsonData = async (jsonData: string) => {
    const fileName =
      exportRange === "custom"
        ? `moodinator-export-${formatDateSlug(
            customStartDate
          )}-to-${formatDateSlug(customEndDate)}.json`
        : `moodinator-export-${exportRange}-${formatDateSlug(new Date())}.json`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, jsonData, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Moodinator Export",
      });
      Alert.alert("Export Ready", "Mood data shared successfully.");
    } else {
      await Clipboard.setStringAsync(jsonData);
      Alert.alert(
        "Copied Instead",
        "Sharing isn't available on this device, so the JSON was copied to your clipboard."
      );
    }

    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.warn("Failed to clean up export file:", error);
    }
  };

  const handleExportShare = async () => {
    const rangePayload = resolveExportRange();
    if (!rangePayload) return;
    try {
      setLoading("export");
      const jsonData = await exportMoods(rangePayload);
      await shareJsonData(jsonData);
      setExportModalVisible(false);
    } catch (error) {
      Alert.alert("Export Error", "Failed to export mood data");
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleExportCopy = async () => {
    const rangePayload = resolveExportRange();
    if (!rangePayload) return;
    try {
      setLoading("export");
      const jsonData = await exportMoods(rangePayload);
      await Clipboard.setStringAsync(jsonData);
      Alert.alert("Copied", "Mood data copied to your clipboard.");
      setExportModalVisible(false);
    } catch (error) {
      Alert.alert("Export Error", "Failed to copy mood data");
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  // Save preference when changed
  const handleToggleLabels = async (value: boolean) => {
    setShowDetailedLabels(value);
    try {
      await AsyncStorage.setItem(SHOW_LABELS_KEY, value.toString());
    } catch (error) {
      console.error("Failed to save label preference:", error);
    }
  };

  // Save dev options when changed
  const handleToggleDevOptions = async (value: boolean) => {
    setDevOptionsEnabled(value);
    try {
      await AsyncStorage.setItem(DEV_OPTIONS_KEY, value.toString());
    } catch (error) {
      console.error("Failed to save dev options preference:", error);
    }
  };

  const resetCustomRange = () => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    setCustomStartDate(start);
    setCustomEndDate(new Date());
  };

  const handleExport = () => {
    resetCustomRange();
    setExportRange("week");
    setExportModalVisible(true);
  };

  const handleImport = async () => {
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
      Alert.alert(
        "Import Error",
        "Failed to import mood data. Please make sure the file is a valid JSON export."
      );
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleSeedMoods = async () => {
    try {
      setLoading("seed");
      const result = await seedMoodsFromFile();
      setLastSeedResult(result);
      Alert.alert(
        "Sample Data Added",
        `Successfully added ${result.count} sample mood entries.`
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add sample data");
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleTestNotification = async () => {
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
    Alert.alert(
      "Notification Scheduled",
      "A test notification has been scheduled and will appear in 2 seconds."
    );
  };


  const handleClearMoods = async () => {
    Alert.alert(
      "Clear All Data",
      "Are you sure you want to delete all mood data? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading("clear");
              await clearMoods();
              setLastSeedResult(null);
              Alert.alert("Success", "All mood data has been cleared.");
            } catch (error) {
              Alert.alert("Error", "Failed to clear mood data");
              console.error(error);
            } finally {
              setLoading(null);
            }
          },
        },
      ]
    );
  };

  // Simple reusable toggle row for consistent styling
  const ToggleRow = memo(function ToggleRow({
    title,
    description,
    value,
    onChange,
    testID,
  }: {
    title: string;
    description?: string;
    value: boolean;
    onChange: (v: boolean) => void;
    testID?: string;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange(!value)}
        className="flex-row items-center justify-between"
        testID={testID}
      >
        <View className="flex-1 pr-3">
          <Text className="text-base font-medium text-gray-800 dark:text-slate-100">
            {title}
          </Text>
          {description ? (
            <Text className="text-sm text-gray-600 dark:text-slate-300 mt-0.5">
              {description}
            </Text>
          ) : null}
        </View>
        <Switch value={value} onValueChange={onChange} />
      </Pressable>
    );
  });

  const ListEditor = memo(function ListEditor({
    title,
    description,
    placeholder,
    items,
    newValue,
    onChangeNewValue,
    onAdd,
    onRemove,
  }: {
    title: string;
    description: string;
    placeholder: string;
    items: string[];
    newValue: string;
    onChangeNewValue: (value: string) => void;
    onAdd: () => void;
    onRemove: (value: string) => void;
  }) {
    return (
      <View className="space-y-3">
        <View>
          <Text className="text-base font-medium text-gray-800 dark:text-slate-100">
            {title}
          </Text>
          <Text className="text-sm text-gray-600 dark:text-slate-300 mt-1">
            {description}
          </Text>
        </View>
        <View className="flex-row gap-3 items-stretch">
          <TextInput
            value={newValue}
            onChangeText={onChangeNewValue}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            className="flex-1 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-base bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
          <Pressable
            onPress={onAdd}
            className="bg-blue-600 px-5 py-3 rounded-2xl self-stretch justify-center"
          >
            <Text className="text-white font-semibold">Add</Text>
          </Pressable>
        </View>
        <View className="flex-row flex-wrap gap-3 pt-1">
          {items.map((item) => (
            <Pressable
              key={item}
              onPress={() => onRemove(item)}
              className="flex-row items-center bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-full px-4 py-1.5"
            >
              <Text className="text-sm font-medium text-blue-800 dark:text-slate-100 mr-2">
                {item}
              </Text>
              <Text className="text-xs uppercase tracking-wide text-blue-600 dark:text-slate-300">
                Remove
              </Text>
            </Pressable>
          ))}
          {items.length === 0 && (
            <Text className="text-sm text-gray-500 dark:text-slate-400">
              No items yet.
            </Text>
          )}
        </View>
      </View>
    );
  });

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text className="text-3xl font-extrabold text-center mb-6 text-sky-600 dark:text-sky-400">
            Settings
          </Text>

          <View className="space-y-4">
            <Text className="text-lg font-semibold mb-2 text-gray-700 dark:text-slate-200">
              Data Management
            </Text>

            <View className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <View className="space-y-4">
                <View>
                  <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-1">
                    Export Data
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-slate-300 mb-2">
                    Export your mood data as a JSON file that you can save or
                    share
                  </Text>
                  <Pressable
                    onPress={handleExport}
                    className="bg-blue-600 py-3 px-4 rounded-lg"
                  >
                    {loading === "export" ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold text-center">
                        Export Mood Data
                      </Text>
                    )}
                  </Pressable>
                </View>

                <View className="border-t border-gray-200 dark:border-slate-800 my-4" />

                <View>
                  <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-1">
                    Import Data
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-slate-300 mb-2">
                    Import previously exported mood data from a JSON file
                  </Text>
                  <Pressable
                    onPress={handleImport}
                    className="bg-green-600 py-3 px-4 rounded-lg"
                  >
                    {loading === "import" ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold text-center">
                        Import Mood Data
                      </Text>
                    )}
                  </Pressable>
                </View>

                {/* Dev-only actions moved into the Developer Options card below */}
              </View>
            </View>

            <View className="space-y-4 pb-8">
              <Text className="text-lg font-semibold mb-2 text-gray-700 dark:text-slate-200">
                Therapy Export
              </Text>

              <View className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
                <Text className="text-base font-medium text-gray-800 dark:text-slate-100">
                  Therapy Export Profile
                </Text>
                <Text className="text-sm text-gray-600 dark:text-slate-300">
                  Choose which fields to include, define date ranges, and export
                  a therapist-friendly CSV.
                </Text>
                <Link href="/therapy-export" asChild>
                  <Pressable className="mt-2 bg-blue-600 rounded-xl py-3 px-4 items-center">
                    <Text className="text-white font-semibold">
                      Open Therapy Export
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </View>

            <View className="space-y-4 pb-8">
              <Text className="text-lg font-semibold mb-2 text-gray-700 dark:text-slate-200">
                Preferences
              </Text>

              <View className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                <View className="space-y-4">
                  <ToggleRow
                    title="Show Detailed Labels"
                    description="Toggle whether detailed labels are displayed in the app"
                    value={showDetailedLabels}
                    onChange={handleToggleLabels}
                    testID="toggle-detailed-labels"
                  />

                  <View className="border-t border-gray-200 dark:border-slate-800 my-4" />

                  <View>
                    <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-1">
                      Notifications
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-slate-300 mb-3">
                      Manage your mood reminder notifications
                    </Text>
                    <Link href="/notifications" asChild>
                      <Pressable className="bg-blue-600 rounded-xl py-3 px-4 items-center">
                        <Text className="text-white font-semibold">
                          Manage Notifications
                        </Text>
                      </Pressable>
                    </Link>
                  </View>

                  <View className="border-t border-gray-200 dark:border-slate-800 my-4" />

                  <ToggleRow
                    title="Developer Options"
                    description="Show tools for testing: Add Sample Data, Clear All Data, Test Notification"
                    value={devOptionsEnabled}
                    onChange={handleToggleDevOptions}
                    testID="toggle-developer-options"
                  />
                </View>
              </View>
            </View>

            <View className="space-y-4 pb-8">
              <Text className="text-lg font-semibold mb-2 text-gray-700 dark:text-slate-200">
                Entry Customization
              </Text>

              <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6 flex gap-2">
                <ToggleRow
                  title="Quick Entry: Show Emotions"
                  description="Display emotion selection in Quick Entry modal"
                  value={quickEntryPrefs.showEmotions}
                  onChange={(value) =>
                    handleQuickEntryToggle("showEmotions", value)
                  }
                />

                <ToggleRow
                  title="Quick Entry: Show Context"
                  description="Display context tags in Quick Entry modal"
                  value={quickEntryPrefs.showContext}
                  onChange={(value) =>
                    handleQuickEntryToggle("showContext", value)
                  }
                />

                <ToggleRow
                  title="Quick Entry: Show Energy"
                  description="Display energy slider in Quick Entry modal"
                  value={quickEntryPrefs.showEnergy}
                  onChange={(value) =>
                    handleQuickEntryToggle("showEnergy", value)
                  }
                />

                <ToggleRow
                  title="Quick Entry: Show Notes"
                  description="Allow notes input directly in Quick Entry"
                  value={quickEntryPrefs.showNotes}
                  onChange={(value) =>
                    handleQuickEntryToggle("showNotes", value)
                  }
                />

                <View className="border-t border-gray-200 dark:border-slate-800" />

                <ListEditor
                  title="Emotion Presets"
                  description="Pick up to 3 emotions when logging. Add your own with the field below."
                  placeholder="Add emotion"
                  items={emotions}
                  newValue={newEmotion}
                  onChangeNewValue={setNewEmotion}
                  onAdd={handleAddEmotion}
                  onRemove={handleRemoveEmotion}
                />

                <View className="border-t border-gray-200 dark:border-slate-800" />

                <ListEditor
                  title="Context Tags"
                  description="Label where or with whom you were during an entry."
                  placeholder="Add context"
                  items={contexts}
                  newValue={newContext}
                  onChangeNewValue={setNewContext}
                  onAdd={handleAddContext}
                  onRemove={handleRemoveContext}
                />
              </View>
            </View>

            {devOptionsEnabled && (
              <View className="space-y-4 pb-8">
                <Text className="text-lg font-semibold mb-2 text-gray-700 dark:text-slate-200">
                  Developer Options
                </Text>

                <View className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
                  <View className="space-y-6">
                    <View>
                      <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-1">
                        Add Sample Data
                      </Text>
                      <Text className="text-sm text-gray-600 dark:text-slate-300 mb-2">
                        Add sample mood entries for testing and demonstration
                      </Text>
                      <Pressable
                        onPress={handleSeedMoods}
                        className="bg-purple-600 py-3 px-4 rounded-lg"
                      >
                        {loading === "seed" ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text className="text-white font-semibold text-center">
                            Add Sample Data
                          </Text>
                        )}
                      </Pressable>
                    </View>

                    <View className="border-t border-gray-200 dark:border-slate-800" />

                    <View>
                      <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-1">
                        Clear All Data
                      </Text>
                      <Text className="text-sm text-gray-600 dark:text-slate-300 mb-2">
                        Remove all mood entries from the database
                      </Text>
                      <Pressable
                        onPress={handleClearMoods}
                        className="bg-red-600 py-3 px-4 rounded-lg"
                      >
                        {loading === "clear" ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text className="text-white font-semibold text-center">
                            Clear All Data
                          </Text>
                        )}
                      </Pressable>
                    </View>

                    <View className="border-t border-gray-200 dark:border-slate-800" />

                    <View>
                      <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-1">
                        Test Notification
                      </Text>
                      <Text className="text-sm text-gray-600 dark:text-slate-300 mb-2">
                        Schedule a test notification to appear in 2 seconds.
                      </Text>
                      <Pressable
                        onPress={handleTestNotification}
                        className="bg-gray-600 py-3 px-4 rounded-lg"
                      >
                        <Text className="text-white font-semibold text-center">
                          Send Test Notification
                        </Text>
                      </Pressable>
                    </View>

                    {lastSeedResult && (
                      <View className="mt-2 p-3 bg-green-50 dark:bg-emerald-950 border border-green-200 dark:border-emerald-800 rounded-lg">
                        <Text className="text-green-800 dark:text-emerald-200 text-center font-medium">
                          ✅ Added {lastSeedResult.count} sample mood entries
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={exportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-3xl p-5 border-t border-slate-200 dark:border-slate-800">
            <Text className="text-xl font-semibold text-center text-slate-900 dark:text-slate-100 mb-2">
              Export Mood Data
            </Text>
            <Text className="text-sm text-center text-slate-500 dark:text-slate-400 mb-4">
              Choose a date range to include timestamp, mood, emotions, context,
              energy, and notes.
            </Text>

            <View className="flex-row justify-between mb-4">
              {[
                { key: "week", label: "Last 7 Days" },
                { key: "month", label: "Last 30 Days" },
                { key: "custom", label: "Custom" },
              ].map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() =>
                    setExportRange(option.key as "week" | "month" | "custom")
                  }
                  className={`flex-1 mx-1 rounded-xl border px-2 py-2 ${
                    exportRange === option.key
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`text-center text-sm font-semibold ${
                      exportRange === option.key
                        ? "text-white"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {exportRange === "custom" && (
              <View className="space-y-4 mb-4">
                <View>
                  <Text className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Start Date
                  </Text>
                  <View className="rounded-2xl border border-slate-200 dark:border-slate-700 p-2 bg-gray-50 dark:bg-slate-800">
                    <DateTimePicker
                      value={customStartDate}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      maximumDate={customEndDate}
                      onChange={(_, date) => {
                        if (date) {
                          setCustomStartDate(date);
                          if (date > customEndDate) {
                            setCustomEndDate(date);
                          }
                        }
                      }}
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    End Date
                  </Text>
                  <View className="rounded-2xl border border-slate-200 dark:border-slate-700 p-2 bg-gray-50 dark:bg-slate-800">
                    <DateTimePicker
                      value={customEndDate}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      minimumDate={customStartDate}
                      maximumDate={new Date()}
                      onChange={(_, date) => {
                        if (date) {
                          setCustomEndDate(date);
                          if (date < customStartDate) {
                            setCustomStartDate(date);
                          }
                        }
                      }}
                    />
                  </View>
                </View>
              </View>
            )}

            <View className="space-y-3 mt-2">
              <Pressable
                onPress={handleExportShare}
                disabled={loading === "export"}
                className={`rounded-2xl py-3 items-center ${
                  loading === "export" ? "bg-blue-400" : "bg-blue-600"
                }`}
              >
                {loading === "export" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">
                    Share JSON (Therapist)
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleExportCopy}
                disabled={loading === "export"}
                className="rounded-2xl py-3 items-center border border-slate-300 dark:border-slate-700"
              >
                <Text className="text-slate-800 dark:text-slate-100 font-semibold">
                  Copy JSON to Clipboard
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setExportModalVisible(false)}
                disabled={loading === "export"}
                className="rounded-2xl py-3 items-center bg-gray-100 dark:bg-slate-800"
              >
                <Text className="text-slate-700 dark:text-slate-100 font-semibold">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
