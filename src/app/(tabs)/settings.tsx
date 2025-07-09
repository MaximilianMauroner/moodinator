import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  exportMoods,
  importMoods,
  clearMoods,
  seedMoodsFromFile,
} from "@db/db";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  getNotificationSettings,
  saveNotificationSettings,
} from "@/hooks/useNotifications";
import { NotificationTimePickerModal } from "@/components/NotificationTimePickerModal";

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

  // Notification settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationHour, setNotificationHour] = useState(20);
  const [notificationMinute, setNotificationMinute] = useState(0);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);

  // Load saved preferences on component mount
  useEffect(() => {
    loadShowLabelsPreference();
    loadNotificationSettings();
  }, []);

  // Load notification settings
  const loadNotificationSettings = async () => {
    try {
      const settings = await getNotificationSettings();
      setNotificationsEnabled(settings.enabled);
      setNotificationHour(settings.hour);
      setNotificationMinute(settings.minute);
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
  };

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

  // Handle notification settings
  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await saveNotificationSettings(value, notificationHour, notificationMinute);
  };

  const handleTimePickerSave = async (hour: number, minute: number) => {
    setNotificationHour(hour);
    setNotificationMinute(minute);
    await saveNotificationSettings(notificationsEnabled, hour, minute);
  };

  const formatNotificationTime = () => {
    const date = new Date();
    date.setHours(notificationHour);
    date.setMinutes(notificationMinute);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text
            className="text-3xl font-extrabold text-center mb-6"
            style={{ color: "#5DADE2" }}
          >
            Settings
          </Text>

          <View className="space-y-4">
            <Text className="text-lg font-semibold mb-2 text-gray-700">
              Data Management
            </Text>

            <View className="bg-white rounded-xl p-4 shadow-sm">
              <View className="space-y-4">
                <View>
                  <Text className="text-base font-medium text-gray-800 mb-1">
                    Export Data
                  </Text>
                  <Text className="text-sm text-gray-600 mb-2">
                    Export your mood data as a JSON file that you can save or
                    share
                  </Text>
                  <Pressable
                    onPress={handleExport}
                    className="bg-blue-500 py-3 px-4 rounded-lg"
                  >
                    {loading === "export" ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-medium text-center">
                        Export Mood Data
                      </Text>
                    )}
                  </Pressable>
                </View>

                <View className="border-t border-gray-200 my-4" />

                <View>
                  <Text className="text-base font-medium text-gray-800 mb-1">
                    Import Data
                  </Text>
                  <Text className="text-sm text-gray-600 mb-2">
                    Import previously exported mood data from a JSON file
                  </Text>
                  <Pressable
                    onPress={handleImport}
                    className="bg-green-500 py-3 px-4 rounded-lg"
                  >
                    {loading === "import" ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-medium text-center">
                        Import Mood Data
                      </Text>
                    )}
                  </Pressable>
                </View>

                <>
                  <View className="border-t border-gray-200 my-4" />

                  <View>
                    <Text className="text-base font-medium text-gray-800 mb-1">
                      Add Sample Data
                    </Text>
                    <Text className="text-sm text-gray-600 mb-2">
                      Add sample mood entries for testing and demonstration
                    </Text>
                    <Pressable
                      onPress={handleSeedMoods}
                      className="bg-purple-500 py-3 px-4 rounded-lg"
                    >
                      {loading === "seed" ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-medium text-center">
                          Add Sample Data
                        </Text>
                      )}
                    </Pressable>
                  </View>

                  <View className="border-t border-gray-200 my-4" />

                  <View>
                    <Text className="text-base font-medium text-gray-800 mb-1">
                      Clear All Data
                    </Text>
                    <Text className="text-sm text-gray-600 mb-2">
                      Remove all mood entries from the database
                    </Text>
                    <Pressable
                      onPress={handleClearMoods}
                      className="bg-red-500 py-3 px-4 rounded-lg"
                    >
                      {loading === "clear" ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-medium text-center">
                          Clear All Data
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </>
                {lastSeedResult && (
                  <View className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Text className="text-green-800 text-center font-medium">
                      ✅ Added {lastSeedResult.count} sample mood entries
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="space-y-4 pb-8">
              <Text className="text-lg font-semibold mb-2 text-gray-700">
                Preferences
              </Text>

              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="space-y-4">
                  <View>
                    <Text className="text-base font-medium text-gray-800 mb-1">
                      Show Detailed Labels
                    </Text>
                    <Text className="text-sm text-gray-600 mb-2">
                      Toggle whether detailed labels are displayed in the app
                    </Text>
                    <Switch
                      value={showDetailedLabels}
                      onValueChange={handleToggleLabels}
                    />
                  </View>

                  <View className="border-t border-gray-200 my-4" />

                  <View>
                    <Text className="text-base font-medium text-gray-800 mb-1">
                      Daily Mood Reminders
                    </Text>
                    <Text className="text-sm text-gray-600 mb-2">
                      Get a daily notification to remind you to log your mood
                    </Text>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={handleToggleNotifications}
                    />
                  </View>

                  {notificationsEnabled && (
                    <View>
                      <Text className="text-base font-medium text-gray-800 mb-1">
                        Notification Time
                      </Text>
                      <Text className="text-sm text-gray-600 mb-2">
                        Choose when you'd like to receive daily reminders
                      </Text>
                      <Pressable
                        onPress={() => setShowTimePickerModal(true)}
                        className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                      >
                        <Text className="text-center text-lg font-medium">
                          {formatNotificationTime()}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {__DEV__ && (
              <View className="space-y-4 pb-8">
                <Text className="text-lg font-semibold mb-2 text-gray-700">
                  Developer Options
                </Text>

                <View className="bg-white rounded-xl p-4 shadow-sm">
                  <View className="space-y-4">
                    <View>
                      <Text className="text-base font-medium text-gray-800 mb-1">
                        Test Notification
                      </Text>
                      <Text className="text-sm text-gray-600 mb-2">
                        Schedule a test notification to appear in 2 seconds.
                      </Text>
                      <Pressable
                        onPress={handleTestNotification}
                        className="bg-gray-500 py-3 px-4 rounded-lg"
                      >
                        <Text className="text-white font-medium text-center">
                          Send Test Notification
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Notification Time Picker Modal */}
      <NotificationTimePickerModal
        visible={showTimePickerModal}
        initialHour={notificationHour}
        initialMinute={notificationMinute}
        onClose={() => setShowTimePickerModal(false)}
        onSave={handleTimePickerSave}
      />
    </SafeAreaView>
  );
}
