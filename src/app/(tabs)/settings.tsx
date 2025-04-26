import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { exportMoods, importMoods } from "@db/db";

export default function SettingsScreen() {
  const [loading, setLoading] = useState<"export" | "import" | null>(null);

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
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
