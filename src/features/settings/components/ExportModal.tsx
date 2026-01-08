import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { exportMoods } from "@db/db";
import { styles } from "../styles";

type ExportRange = "week" | "month" | "custom" | "full";
type ExportRangePayload =
  | { preset: "week" | "month" }
  | { startDate: number; endDate: number }
  | undefined;

function formatDateSlug(date: Date) {
  return date.toISOString().split("T")[0];
}

function resolveRangePayload(
  exportRange: ExportRange,
  customStartDate: Date,
  customEndDate: Date
): ExportRangePayload | null {
  if (exportRange === "full") {
    return undefined;
  }
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
  return { startDate: start.getTime(), endDate: end.getTime() };
}

async function shareJsonData(
  jsonData: string,
  exportRange: ExportRange,
  customStartDate: Date,
  customEndDate: Date
) {
  const fileName =
    exportRange === "custom"
      ? `moodinator-export-${formatDateSlug(customStartDate)}-to-${formatDateSlug(customEndDate)}.json`
      : exportRange === "full"
        ? `moodinator-export-full-${formatDateSlug(new Date())}.json`
        : `moodinator-export-${exportRange}-${formatDateSlug(new Date())}.json`;

  if (Platform.OS === "android") {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      Alert.alert(
        "Permission Denied",
        "Please grant folder access to save the export."
      );
      return;
    }

    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      fileName,
      "application/json"
    );
    await FileSystem.writeAsStringAsync(fileUri, jsonData, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    Alert.alert("Export Saved", "Your export was saved to the selected folder.");
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, jsonData, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/json",
      dialogTitle: "Moodinator Export",
    });
  } else {
    try {
      await Clipboard.setStringAsync(jsonData);
      Alert.alert(
        "Copied",
        "Sharing isn't available, so the JSON was copied to your clipboard."
      );
    } catch {
      Alert.alert("Error", "Export file created but could not be shared.");
    }
  }

  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch (e) {
    console.warn("Cleanup failed:", e);
  }
}

export function ExportModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [exportRange, setExportRange] = useState<ExportRange>("week");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date;
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const start = new Date();
    start.setDate(start.getDate() - 6);
    setCustomStartDate(start);
    setCustomEndDate(new Date());
    setExportRange("week");
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    setLoading(false);
  }, [visible]);

  const handleExportShare = async () => {
    const rangePayload = resolveRangePayload(
      exportRange,
      customStartDate,
      customEndDate
    );
    if (rangePayload === null) {
      return;
    }
    try {
      setLoading(true);
      const jsonData = await exportMoods(rangePayload);
      await shareJsonData(jsonData, exportRange, customStartDate, customEndDate);
      onClose();
    } catch (error) {
      Alert.alert("Export Error", "Failed to export mood data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white dark:bg-slate-900 rounded-t-3xl p-6 border-t border-slate-200 dark:border-slate-800 pb-10">
          <View className="items-center mb-6">
            <View className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-4" />
            <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Export Data
            </Text>
          </View>

          <View className="flex-row bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
            {(["week", "month", "custom", "full"] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setExportRange(opt)}
                className={`flex-1 py-2 rounded-lg ${
                  exportRange === opt ? "bg-white dark:bg-slate-700" : ""
                }`}
                style={exportRange === opt ? styles.segmentShadow : undefined}
              >
                <Text
                  className={`text-center font-medium capitalize ${
                    exportRange === opt
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {opt === "week"
                    ? "7 Days"
                    : opt === "month"
                      ? "30 Days"
                      : opt === "custom"
                        ? "Custom"
                        : "Full Backup"}
                </Text>
              </Pressable>
            ))}
          </View>

          {exportRange === "custom" && (
            <View className="flex-row gap-3 mb-6">
              <Pressable
                onPress={() => setShowStartDatePicker(true)}
                className="flex-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  From
                </Text>
                <Text className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {customStartDate.toLocaleDateString()}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowEndDatePicker(true)}
                className="flex-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  To
                </Text>
                <Text className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {customEndDate.toLocaleDateString()}
                </Text>
              </Pressable>
            </View>
          )}

          {showStartDatePicker && (
            <DateTimePicker
              value={customStartDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={customEndDate}
              onChange={(e, d) => {
                if (Platform.OS !== "ios") {
                  setShowStartDatePicker(false);
                }
                if (d) {
                  setCustomStartDate(d);
                }
              }}
            />
          )}
          {showEndDatePicker && (
            <DateTimePicker
              value={customEndDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={customStartDate}
              maximumDate={new Date()}
              onChange={(e, d) => {
                if (Platform.OS !== "ios") {
                  setShowEndDatePicker(false);
                }
                if (d) {
                  setCustomEndDate(d);
                }
              }}
            />
          )}

          <View className="gap-3">
            <TouchableOpacity
              onPress={handleExportShare}
              disabled={loading}
              className="bg-blue-600 p-4 rounded-xl flex-row justify-center items-center"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-white font-bold text-base">
                    Share JSON
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl items-center"
            >
              <Text className="text-slate-900 dark:text-slate-300 font-semibold">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
