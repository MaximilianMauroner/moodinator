import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  TouchableOpacity,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  exportMoods,
  importMoods,
  clearMoods,
  seedMoodsFromFile,
  getAllMoods,
} from "@db/db";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MoodEntry } from "@db/types";
import { getMoodInterpretation } from "@/components/charts";
import { format } from "date-fns";

// Storage key for show labels preference
const SHOW_LABELS_KEY = "showLabelsPreference";

export default function SettingsScreen() {
  const [loading, setLoading] = useState<
    "export" | "import" | "seed" | "clear" | null
  >(null);
  const [showDetailedLabels, setShowDetailedLabels] = useState(false);
  const [lastSeedResult, setLastSeedResult] = useState<{
    count: number;
    source: "file" | "random";
  } | null>(null);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load saved preference and mood data on component mount
  useEffect(() => {
    loadShowLabelsPreference();
    loadMoodData();
  }, []);

  // Load mood data for statistics
  const loadMoodData = async () => {
    try {
      const data = await getAllMoods();
      setMoods(data);
    } catch (error) {
      console.error("Failed to load mood data:", error);
    }
  };

  // Calculate data statistics
  const dataStats = useMemo(() => {
    if (!moods.length) return null;

    const totalEntries = moods.length;
    const withNotes = moods.filter(
      (m) => m.note && m.note.trim().length > 0
    ).length;
    const overallAvg =
      moods.reduce((sum, mood) => sum + mood.mood, 0) / moods.length;
    const oldestEntry = moods.reduce((oldest, mood) =>
      new Date(mood.timestamp) < new Date(oldest.timestamp) ? mood : oldest
    );
    const newestEntry = moods.reduce((newest, mood) =>
      new Date(mood.timestamp) > new Date(newest.timestamp) ? mood : newest
    );

    const daysSinceFirst = Math.floor(
      (new Date().getTime() - new Date(oldestEntry.timestamp).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      totalEntries,
      withNotes,
      overallAvg,
      oldestEntry,
      newestEntry,
      daysSinceFirst: daysSinceFirst + 1, // +1 to include the first day
      averagePerDay: totalEntries / (daysSinceFirst + 1),
    };
  }, [moods]);

  // Load saved preference on component mount
  useEffect(() => {
    loadShowLabelsPreference();
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

  // Save preference when changed
  const handleToggleLabels = async (value: boolean) => {
    setShowDetailedLabels(value);
    try {
      await AsyncStorage.setItem(SHOW_LABELS_KEY, value.toString());
    } catch (error) {
      console.error("Failed to save label preference:", error);
    }
  };

  const handleExport = async () => {
    try {
      setLoading("export");
      const jsonData = await exportMoods();
      const fileName = `moodinator-export-${
        new Date().toISOString().split("T")[0]
      }.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, jsonData);

      // Check if sharing is available on the device
      // Instead of sharing, prompt the user to pick a location to save the file
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        Alert.alert(
          "Permission Denied",
          "Cannot access storage to save the file."
        );
        return;
      }
      await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        "application/json"
      )
        .then(async (uri) => {
          await FileSystem.writeAsStringAsync(uri, jsonData, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          Alert.alert("Export Successful", "Mood data exported successfully.");
        })
        .catch((err) => {
          Alert.alert("Export Error", "Failed to save the file.");
          console.error(err);
        });
      return;
    } catch (error) {
      Alert.alert("Export Error", "Failed to export mood data");
      console.error(error);
    } finally {
      setLoading(null);
    }
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
              setMoods([]);
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

  const handleSeedMoods = async () => {
    try {
      setLoading("seed");
      const result = await seedMoodsFromFile();
      setLastSeedResult(result);
      await loadMoodData(); // Refresh mood data
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
      await loadMoodData(); // Refresh mood data

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

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="mt-1 flex flex-row justify-center items-center p-4">
          <Text className="text-3xl font-extrabold text-center text-sky-400">
            Settings
          </Text>
          {dataStats && (
            <View className="justify-center">
              <Text className="font-semibold pl-2 text-purple-600">
                ({dataStats.totalEntries})
              </Text>
            </View>
          )}
        </View>

        {/* Data Overview Card */}
        {dataStats && (
          <View className="mx-4 mb-6 bg-white p-6 rounded-2xl shadow-lg">
            <Text className="text-xl font-bold text-gray-800 mb-4 text-center">
              📊 Your Data Overview
            </Text>

            {/* Primary Stats */}
            <View className="flex-row justify-between mb-4">
              <View className="flex-1 items-center">
                <Text className="text-2xl font-bold text-blue-600">
                  {dataStats.totalEntries}
                </Text>
                <Text className="text-xs text-gray-500 text-center">
                  Total Entries
                </Text>
              </View>
              <View className="flex-1 items-center">
                <Text
                  className={`text-2xl font-bold ${
                    getMoodInterpretation(dataStats.overallAvg).textClass
                  }`}
                >
                  {dataStats.overallAvg.toFixed(1)}
                </Text>
                <Text className="text-xs text-gray-500 text-center">
                  Average Mood
                </Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-2xl font-bold text-green-600">
                  {dataStats.daysSinceFirst}
                </Text>
                <Text className="text-xs text-gray-500 text-center">
                  Days Tracked
                </Text>
              </View>
            </View>

            {/* Additional Stats */}
            <View className="bg-gray-50 p-4 rounded-xl">
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-gray-600">
                  Entries with notes:
                </Text>
                <Text className="text-sm font-medium text-gray-800">
                  {dataStats.withNotes} (
                  {(
                    (dataStats.withNotes / dataStats.totalEntries) *
                    100
                  ).toFixed(0)}
                  %)
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-gray-600">Average per day:</Text>
                <Text className="text-sm font-medium text-gray-800">
                  {dataStats.averagePerDay.toFixed(1)} entries
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600">First entry:</Text>
                <Text className="text-sm font-medium text-gray-800">
                  {format(
                    new Date(dataStats.oldestEntry.timestamp),
                    "MMM dd, yyyy"
                  )}
                </Text>
              </View>
            </View>

            <View className="mt-4 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50">
              <Text className="text-center text-sm text-gray-700">
                <Text className="font-medium">
                  {getMoodInterpretation(dataStats.overallAvg).text}
                </Text>{" "}
                overall mood
              </Text>
            </View>
          </View>
        )}

        {/* Preferences Section */}
        <View className="mx-4 mb-6">
          <Text className="text-lg font-semibold mb-3 text-gray-800">
            ⚙️ Preferences
          </Text>

          <View className="bg-white rounded-xl p-4 shadow-sm">
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-base font-medium text-gray-800 mb-1">
                  Show Detailed Labels
                </Text>
                <Text className="text-sm text-gray-600">
                  Display detailed mood descriptions in the tracking interface
                </Text>
              </View>
              <Switch
                value={showDetailedLabels}
                onValueChange={handleToggleLabels}
                trackColor={{ false: "#f3f4f6", true: "#ddd6fe" }}
                thumbColor={showDetailedLabels ? "#8b5cf6" : "#9ca3af"}
              />
            </View>
          </View>
        </View>

        {/* Data Management Section */}
        <View className="mx-4 mb-6">
          <Text className="text-lg font-semibold mb-3 text-gray-800">
            💾 Data Management
          </Text>

          <View className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            {/* Export */}
            <View>
              <Text className="text-base font-medium text-gray-800 mb-1">
                Export Data
              </Text>
              <Text className="text-sm text-gray-600 mb-3">
                Save your mood data as a JSON file for backup or sharing
              </Text>
              <TouchableOpacity
                onPress={handleExport}
                disabled={loading === "export"}
                className="bg-blue-500 py-3 px-4 rounded-xl flex-row justify-center items-center"
                style={{ opacity: loading === "export" ? 0.7 : 1 }}
              >
                {loading === "export" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text className="text-white font-medium text-center mr-2">
                      📤
                    </Text>
                    <Text className="text-white font-medium text-center">
                      Export Mood Data
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View className="border-t border-gray-200 my-4" />

            {/* Import */}
            <View>
              <Text className="text-base font-medium text-gray-800 mb-1">
                Import Data
              </Text>
              <Text className="text-sm text-gray-600 mb-3">
                Restore previously exported mood data from a JSON file
              </Text>
              <TouchableOpacity
                onPress={handleImport}
                disabled={loading === "import"}
                className="bg-green-500 py-3 px-4 rounded-xl flex-row justify-center items-center"
                style={{ opacity: loading === "import" ? 0.7 : 1 }}
              >
                {loading === "import" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text className="text-white font-medium text-center mr-2">
                      📥
                    </Text>
                    <Text className="text-white font-medium text-center">
                      Import Mood Data
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View className="border-t border-gray-200 my-4" />

            {/* Add Sample Data */}
            <View>
              <Text className="text-base font-medium text-gray-800 mb-1">
                Add Sample Data
              </Text>
              <Text className="text-sm text-gray-600 mb-3">
                Generate sample mood entries for testing and demonstration
              </Text>
              <TouchableOpacity
                onPress={handleSeedMoods}
                disabled={loading === "seed"}
                className="bg-purple-500 py-3 px-4 rounded-xl flex-row justify-center items-center"
                style={{ opacity: loading === "seed" ? 0.7 : 1 }}
              >
                {loading === "seed" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text className="text-white font-medium text-center mr-2">
                      🎲
                    </Text>
                    <Text className="text-white font-medium text-center">
                      Add Sample Data
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View className="border-t border-gray-200 my-4" />

            {/* Clear Data */}
            <View>
              <Text className="text-base font-medium text-gray-800 mb-1">
                Clear All Data
              </Text>
              <Text className="text-sm text-gray-600 mb-3">
                ⚠️ Permanently remove all mood entries from the database
              </Text>
              <TouchableOpacity
                onPress={handleClearMoods}
                disabled={loading === "clear"}
                className="bg-red-500 py-3 px-4 rounded-xl flex-row justify-center items-center"
                style={{ opacity: loading === "clear" ? 0.7 : 1 }}
              >
                {loading === "clear" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text className="text-white font-medium text-center mr-2">
                      🗑️
                    </Text>
                    <Text className="text-white font-medium text-center">
                      Clear All Data
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Success message for sample data */}
            {lastSeedResult && (
              <View className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <Text className="text-green-800 text-center font-medium">
                  ✅ Added {lastSeedResult.count} sample mood entries
                  successfully
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* App Info Section */}
        <View className="mx-4 mb-6">
          <Text className="text-lg font-semibold mb-3 text-gray-800">
            ℹ️ About
          </Text>

          <View className="bg-white rounded-xl p-4 shadow-sm">
            <View className="items-center">
              <Text className="text-4xl mb-2">🎯</Text>
              <Text className="text-lg font-semibold text-gray-800 mb-1">
                Moodinator
              </Text>
              <Text className="text-sm text-gray-600 text-center mb-4">
                Track, analyze, and understand your emotional patterns with
                detailed insights and beautiful visualizations.
              </Text>

              <View className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg w-full">
                <Text className="text-center text-sm text-gray-700">
                  💡 <Text className="font-medium">Tip:</Text> Use swipe
                  gestures in the home screen - swipe left to edit notes, right
                  to delete entries
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom padding */}
        <View className="pb-20" />
      </ScrollView>
    </SafeAreaView>
  );
}
