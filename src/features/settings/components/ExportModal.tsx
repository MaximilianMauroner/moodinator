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
  StyleSheet,
  TextInput,
  Switch,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { exportMoods } from "@db/db";
import { encryptString, validatePassword } from "@/lib/encryption";
import { haptics } from "@/lib/haptics";

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

async function shareData(
  data: string,
  exportRange: ExportRange,
  customStartDate: Date,
  customEndDate: Date,
  isEncrypted: boolean
) {
  const extension = isEncrypted ? "json.enc" : "json";
  const mimeType = isEncrypted ? "application/octet-stream" : "application/json";

  const baseName =
    exportRange === "custom"
      ? `moodinator-export-${formatDateSlug(customStartDate)}-to-${formatDateSlug(customEndDate)}`
      : exportRange === "full"
        ? `moodinator-export-full-${formatDateSlug(new Date())}`
        : `moodinator-export-${exportRange}-${formatDateSlug(new Date())}`;

  const fileName = `${baseName}.${extension}`;

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
      mimeType
    );
    await FileSystem.writeAsStringAsync(fileUri, data, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    Alert.alert(
      "Export Saved",
      isEncrypted
        ? "Your encrypted export was saved to the selected folder."
        : "Your export was saved to the selected folder."
    );
    return;
  }

  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, data, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: "Moodinator Export",
    });
  } else {
    try {
      await Clipboard.setStringAsync(data);
      Alert.alert(
        "Copied",
        isEncrypted
          ? "Sharing isn't available, so the encrypted data was copied to your clipboard."
          : "Sharing isn't available, so the JSON was copied to your clipboard."
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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

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

  // Encryption state
  const [encryptExport, setEncryptExport] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    setEncryptExport(false);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
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

    // Validate encryption if enabled
    if (encryptExport) {
      const validation = validatePassword(password);
      if (!validation.valid) {
        Alert.alert("Invalid Password", validation.message);
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Password Mismatch", "Passwords do not match. Please try again.");
        return;
      }
    }

    try {
      setLoading(true);
      let jsonData = await exportMoods(rangePayload);

      // Encrypt if enabled
      if (encryptExport) {
        jsonData = encryptString(jsonData, password);
        haptics.patterns.confirm();
      } else {
        haptics.success();
      }

      await shareData(jsonData, exportRange, customStartDate, customEndDate, encryptExport);
      onClose();
    } catch (error) {
      haptics.error();
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
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl p-6 pb-10 bg-paper-100 dark:bg-paper-900 border-t border-sand-300 dark:border-paper-800">
          <View className="items-center mb-6">
            <View className="w-12 h-1.5 rounded-full mb-4 bg-sand-300 dark:bg-sand-800" />
            <Text className="text-xl font-bold text-paper-800 dark:text-paper-200">
              Export Data
            </Text>
          </View>

          {/* Range Selector */}
          <View className="flex-row p-1 rounded-xl mb-4 bg-paper-200 dark:bg-paper-800">
            {(["week", "month", "custom", "full"] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  haptics.selection();
                  setExportRange(opt);
                }}
                className={`flex-1 py-2 rounded-lg ${
                  exportRange === opt ? "bg-white dark:bg-sand-800" : ""
                }`}
                style={exportRange === opt ? localStyles.segmentShadow : undefined}
              >
                <Text
                  className={`text-center font-medium capitalize ${
                    exportRange === opt
                      ? "text-paper-800 dark:text-paper-200"
                      : "text-sand-500 dark:text-sand-800"
                  }`}
                >
                  {opt === "week"
                    ? "7 Days"
                    : opt === "month"
                      ? "30 Days"
                      : opt === "custom"
                        ? "Custom"
                        : "Full"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Custom Date Range */}
          {exportRange === "custom" && (
            <View className="flex-row gap-3 mb-4">
              <Pressable
                onPress={() => setShowStartDatePicker(true)}
                className="flex-1 p-3 rounded-xl bg-paper-200 dark:bg-paper-800 border border-sand-300 dark:border-sand-800"
              >
                <Text className="text-xs mb-1 text-sand-500 dark:text-sand-800">
                  From
                </Text>
                <Text className="text-base font-medium text-paper-800 dark:text-paper-200">
                  {customStartDate.toLocaleDateString()}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowEndDatePicker(true)}
                className="flex-1 p-3 rounded-xl bg-paper-200 dark:bg-paper-800 border border-sand-300 dark:border-sand-800"
              >
                <Text className="text-xs mb-1 text-sand-500 dark:text-sand-800">
                  To
                </Text>
                <Text className="text-base font-medium text-paper-800 dark:text-paper-200">
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

          {/* Encryption Toggle */}
          <View className="mb-4 p-4 rounded-xl bg-paper-200 dark:bg-paper-800">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-9 h-9 rounded-xl items-center justify-center mr-3 bg-dusk-100 dark:bg-dusk-600/20">
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={isDark ? "#C4BBCF" : "#695C78"}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-paper-800 dark:text-paper-200">
                    Encrypt Export
                  </Text>
                  <Text className="text-xs text-sand-500 dark:text-sand-400">
                    Password protect your data
                  </Text>
                </View>
              </View>
              <Switch
                value={encryptExport}
                onValueChange={(value) => {
                  haptics.selection();
                  setEncryptExport(value);
                }}
                trackColor={{
                  false: isDark ? "#3D352A" : "#E5D9BF",
                  true: isDark ? "#2D3D2D" : "#C4DFC4",
                }}
                thumbColor={encryptExport ? (isDark ? "#A8C5A8" : "#5B8A5B") : "#FDFCFA"}
              />
            </View>

            {/* Password Fields */}
            {encryptExport && (
              <View className="mt-4 gap-3">
                <View>
                  <Text className="text-xs text-sand-500 dark:text-sand-400 mb-1 ml-1">
                    Password
                  </Text>
                  <View className="flex-row items-center bg-paper-100 dark:bg-paper-700 rounded-xl">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholder="Enter password"
                      placeholderTextColor={isDark ? "#6B5C4A" : "#BDA77D"}
                      className="flex-1 p-3 text-paper-800 dark:text-paper-200"
                      style={localStyles.input}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      className="p-3"
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={isDark ? "#6B5C4A" : "#BDA77D"}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <Text className="text-xs text-sand-500 dark:text-sand-400 mb-1 ml-1">
                    Confirm Password
                  </Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Confirm password"
                    placeholderTextColor={isDark ? "#6B5C4A" : "#BDA77D"}
                    className="p-3 bg-paper-100 dark:bg-paper-700 rounded-xl text-paper-800 dark:text-paper-200"
                    style={localStyles.input}
                  />
                </View>

                {password && confirmPassword && password !== confirmPassword && (
                  <Text className="text-xs text-coral-500 dark:text-coral-400 ml-1">
                    Passwords do not match
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <TouchableOpacity
              onPress={handleExportShare}
              disabled={loading || (encryptExport && (!password || password !== confirmPassword))}
              className={`p-4 rounded-xl flex-row justify-center items-center ${
                loading || (encryptExport && (!password || password !== confirmPassword))
                  ? "bg-sage-300 dark:bg-sage-800"
                  : "bg-sage-500 dark:bg-sage-600"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons
                    name={encryptExport ? "lock-closed-outline" : "share-outline"}
                    size={20}
                    color="white"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-white font-bold text-base">
                    {encryptExport ? "Export Encrypted" : "Share JSON"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
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
  );
}

const localStyles = StyleSheet.create({
  segmentShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    fontSize: 16,
  },
});
