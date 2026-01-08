import React, { useState, useEffect, memo, useCallback } from "react";
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
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Link } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { exportMoods, importMoods, clearMoods, seedMoods } from "@db/db";
import {
  createBackup,
  getBackupInfo,
  getBackupFolder,
  setBackupFolder,
} from "@db/backup";
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
import type { Emotion } from "@db/types";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNotifications } from "@/hooks/useNotifications";
import { Ionicons } from "@expo/vector-icons";
import { getCategoryColors, getCategoryIconColor } from "@/lib/emotionColors";

const SHOW_LABELS_KEY = "showLabelsPreference";
const DEV_OPTIONS_KEY = "devOptionsEnabled";

const styles = StyleSheet.create({
  cardShadow: {
    // Android
    elevation: 2,
    // iOS
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentShadow: {
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});

const SectionHeader = ({ title, icon }: { title: string; icon?: string }) => (
  <View className="flex-row items-center mb-3 mt-6 px-1">
    {icon && <Text className="mr-2 text-lg">{icon}</Text>}
    <Text className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {title}
    </Text>
  </View>
);

const SettingCard = ({ children }: { children: React.ReactNode }) => (
  <View
    className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
    style={styles.cardShadow}
  >
    {children}
  </View>
);

const SettingRow = ({
  label,
  subLabel,
  action,
  onPress,
  isLast,
  icon,
  destructive,
}: {
  label: string;
  subLabel?: string;
  action?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    className={`flex-row items-center justify-between p-4 ${
      !isLast ? "border-b border-slate-100 dark:border-slate-800" : ""
    } ${onPress ? "active:bg-slate-50 dark:active:bg-slate-800/50" : ""}`}
  >
    <View className="flex-row items-center flex-1 mr-4">
      {icon && (
        <View
          className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
            destructive
              ? "bg-red-100 dark:bg-red-900/20"
              : "bg-slate-100 dark:bg-slate-800"
          }`}
        >
          <Ionicons
            name={icon}
            size={18}
            color={destructive ? "#ef4444" : "#64748b"}
          />
        </View>
      )}
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            destructive
              ? "text-red-600 dark:text-red-400"
              : "text-slate-900 dark:text-slate-100"
          }`}
        >
          {label}
        </Text>
        {subLabel && (
          <Text className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-5">
            {subLabel}
          </Text>
        )}
      </View>
    </View>
    {action && <View>{action}</View>}
    {!action && onPress && (
      <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
    )}
  </Pressable>
);

const ToggleRow = memo(function ToggleRow({
  title,
  description,
  value,
  onChange,
  isLast,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <SettingRow
      label={title}
      subLabel={description}
      isLast={isLast}
      action={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: "#e2e8f0", true: "#3b82f6" }}
          thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
        />
      }
    />
  );
});

const EmotionListEditor = memo(function EmotionListEditor({
  title,
  description,
  placeholder,
  items,
  newValue,
  newCategory,
  onChangeNewValue,
  onChangeCategory,
  onAdd,
  onRemove,
  onEdit,
  isLast,
}: {
  title: string;
  description: string;
  placeholder: string;
  items: Emotion[];
  newValue: string;
  newCategory: "positive" | "negative" | "neutral";
  onChangeNewValue: (value: string) => void;
  onChangeCategory: (category: "positive" | "negative" | "neutral") => void;
  onAdd: () => void;
  onRemove: (emotion: Emotion) => void;
  onEdit: (oldEmotion: Emotion, newCategory: "positive" | "negative" | "neutral") => void;
  isLast?: boolean;
}) {
  const [editingEmotion, setEditingEmotion] = useState<Emotion | null>(null);
  const [editCategory, setEditCategory] = useState<"positive" | "negative" | "neutral">("neutral");

  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));

  const handleEditStart = (emotion: Emotion) => {
    setEditingEmotion(emotion);
    setEditCategory(emotion.category);
  };

  const handleEditSave = () => {
    if (editingEmotion) {
      onEdit(editingEmotion, editCategory);
      setEditingEmotion(null);
    }
  };

  const handleEditCancel = () => {
    setEditingEmotion(null);
  };

  return (
    <View
      className={`p-4 ${
        !isLast ? "border-b border-slate-100 dark:border-slate-800" : ""
      }`}
    >
      <Text className="text-base font-medium text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </Text>
      <Text className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        {description}
      </Text>

      <View className="mb-3">
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Category
        </Text>
        <View className="flex-row gap-2 mb-3">
          <TouchableOpacity
            onPress={() => onChangeCategory("positive")}
            className={`flex-1 py-2 px-3 rounded-lg border ${
              newCategory === "positive"
                ? "bg-green-600 border-green-600"
                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
            }`}
          >
            <Text
              className={`text-sm font-medium text-center ${
                newCategory === "positive"
                  ? "text-white"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              Positive
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onChangeCategory("negative")}
            className={`flex-1 py-2 px-3 rounded-lg border ${
              newCategory === "negative"
                ? "bg-red-600 border-red-600"
                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
            }`}
          >
            <Text
              className={`text-sm font-medium text-center ${
                newCategory === "negative"
                  ? "text-white"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              Negative
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onChangeCategory("neutral")}
            className={`flex-1 py-2 px-3 rounded-lg border ${
              newCategory === "neutral"
                ? "bg-slate-600 border-slate-600"
                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
            }`}
          >
            <Text
              className={`text-sm font-medium text-center ${
                newCategory === "neutral"
                  ? "text-white"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              Neutral
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row gap-2 mb-4">
        <TextInput
          value={newValue}
          onChangeText={onChangeNewValue}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 border border-transparent focus:border-blue-500 transition-colors"
          blurOnSubmit={false}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
        <TouchableOpacity
          onPress={onAdd}
          className="bg-blue-600 w-12 h-12 rounded-xl items-center justify-center active:bg-blue-700"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {sortedItems.map((emotion) => {
          const colors = getCategoryColors(emotion.category);
          const iconColor = getCategoryIconColor(emotion.category);
          return (
            <View
              key={emotion.name}
              className={`flex-row items-center ${colors.bg} border ${colors.border} rounded-full pl-3 pr-1 py-1.5 gap-1`}
            >
              <Text className={`text-sm font-medium ${colors.text}`}>
                {emotion.name}
              </Text>
              <TouchableOpacity
                onPress={() => handleEditStart(emotion)}
                className="p-0.5"
              >
                <Ionicons name="create-outline" size={16} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRemove(emotion)}
                className="p-0.5"
              >
                <Ionicons name="close-circle" size={16} color={iconColor} />
              </TouchableOpacity>
            </View>
          );
        })}
        {items.length === 0 && (
          <Text className="text-sm text-slate-400 italic p-1">
            No emotions added yet.
          </Text>
        )}
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editingEmotion !== null}
        transparent
        animationType="fade"
        onRequestClose={handleEditCancel}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md">
            <Text className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Edit Emotion Category
            </Text>

            <Text className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-4">
              {editingEmotion?.name}
            </Text>

            <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select Category
            </Text>
            <View className="flex-row gap-2 mb-6">
              <TouchableOpacity
                onPress={() => setEditCategory("positive")}
                className={`flex-1 py-3 px-3 rounded-lg border ${
                  editCategory === "positive"
                    ? "bg-green-600 border-green-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                }`}
              >
                <Text
                  className={`text-sm font-medium text-center ${
                    editCategory === "positive"
                      ? "text-white"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Positive
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditCategory("negative")}
                className={`flex-1 py-3 px-3 rounded-lg border ${
                  editCategory === "negative"
                    ? "bg-red-600 border-red-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                }`}
              >
                <Text
                  className={`text-sm font-medium text-center ${
                    editCategory === "negative"
                      ? "text-white"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Negative
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditCategory("neutral")}
                className={`flex-1 py-3 px-3 rounded-lg border ${
                  editCategory === "neutral"
                    ? "bg-slate-600 border-slate-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                }`}
              >
                <Text
                  className={`text-sm font-medium text-center ${
                    editCategory === "neutral"
                      ? "text-white"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  Neutral
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleEditCancel}
                className="flex-1 bg-slate-200 dark:bg-slate-700 py-3 rounded-xl"
              >
                <Text className="text-center text-slate-800 dark:text-slate-200 font-medium">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditSave}
                className="flex-1 bg-blue-600 py-3 rounded-xl"
              >
                <Text className="text-center text-white font-medium">
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  isLast,
}: {
  title: string;
  description: string;
  placeholder: string;
  items: string[];
  newValue: string;
  onChangeNewValue: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  isLast?: boolean;
}) {
  return (
    <View
      className={`p-4 ${
        !isLast ? "border-b border-slate-100 dark:border-slate-800" : ""
      }`}
    >
      <Text className="text-base font-medium text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </Text>
      <Text className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        {description}
      </Text>

      <View className="flex-row gap-2 mb-4">
        <TextInput
          value={newValue}
          onChangeText={onChangeNewValue}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 border border-transparent focus:border-blue-500 transition-colors"
          blurOnSubmit={false}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
        <TouchableOpacity
          onPress={onAdd}
          className="bg-blue-600 w-12 h-12 rounded-xl items-center justify-center active:bg-blue-700"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => onRemove(item)}
            className="flex-row items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pl-3 pr-2 py-1.5"
          >
            <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-1">
              {item}
            </Text>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ))}
        {items.length === 0 && (
          <Text className="text-sm text-slate-400 italic p-1">
            No items added yet.
          </Text>
        )}
      </View>
    </View>
  );
});

export default function SettingsScreen() {
  const [loading, setLoading] = useState<
    "export" | "import" | "seed" | "clear" | null
  >(null);
  const [showDetailedLabels, setShowDetailedLabels] = useState(false);
  const [devOptionsEnabled, setDevOptionsEnabled] = useState(false);

  const [emotions, setEmotions] = useState<Emotion[]>(DEFAULT_EMOTIONS);
  const [contexts, setContexts] = useState<string[]>(DEFAULT_CONTEXTS);
  const [quickEntryPrefs, setQuickEntryPrefs] = useState<QuickEntryPrefs>(
    DEFAULT_QUICK_ENTRY_PREFS
  );
  const [newEmotion, setNewEmotion] = useState("");
  const [newEmotionCategory, setNewEmotionCategory] = useState<"positive" | "negative" | "neutral">("neutral");
  const [newContext, setNewContext] = useState("");
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportRange, setExportRange] = useState<
    "week" | "month" | "custom" | "full"
  >("week");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date;
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{
    count: number;
    latestBackup: number | null;
  } | null>(null);
  const [backupFolderUri, setBackupFolderUri] = useState<string | null>(null);
  useNotifications();

  useEffect(() => {
    loadShowLabelsPreference();
    loadDevOptionsPreference();
    loadEmotionPresets();
    loadContextTags();
    loadQuickEntryPrefs();
    loadBackupInfo();
  }, []);

  const loadBackupInfo = async () => {
    const info = await getBackupInfo();
    setBackupInfo({
      count: info.count,
      latestBackup: info.latestBackup,
    });

    // Load backup folder URI
    const folderUri = await getBackupFolder();
    setBackupFolderUri(folderUri);
  };

  const formatBackupDate = (timestamp: number | null): string => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const handleManualBackup = async () => {
    try {
      setLoading("export");
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
  };

  const handleSelectBackupFolder = async () => {
    try {
      if (Platform.OS === "android") {
        // On Android, use StorageAccessFramework to request directory access
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
        // On iOS, use documentDirectory (accessible via Files app)
        // For iOS, we'll use the default location which is accessible via Files app
        Alert.alert(
          "Backup Location",
          "On iOS, backups are saved to the app's Documents folder, which is accessible via the Files app. No folder selection needed."
        );
      }
    } catch (error) {
      console.error("Error selecting backup folder:", error);
      Alert.alert("Error", "Failed to select backup folder.");
    }
  };

  const formatBackupFolderPath = (uri: string | null): string => {
    if (!uri) return "Default location";
    // Extract readable path from URI
    if (uri.includes("documentDirectory")) {
      return "App Documents (accessible via Files app)";
    }
    // For Android SAF URIs, show a simplified path
    if (uri.startsWith("content://")) {
      const parts = uri.split("/");
      const lastPart = parts[parts.length - 1];
      return lastPart || "Selected folder";
    }
    return uri.length > 50 ? `${uri.substring(0, 50)}...` : uri;
  };

  const loadShowLabelsPreference = async () => {
    try {
      const value = await AsyncStorage.getItem(SHOW_LABELS_KEY);
      if (value !== null) setShowDetailedLabels(value === "true");
    } catch (error) {
      console.error("Failed to load label preference:", error);
    }
  };

  const loadDevOptionsPreference = async () => {
    try {
      const value = await AsyncStorage.getItem(DEV_OPTIONS_KEY);
      if (value !== null) setDevOptionsEnabled(value === "true");
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

  const handleAddEmotion = useCallback(async () => {
    const trimmed = newEmotion.trim();
    if (!trimmed) return;
    const trimmedLower = trimmed.toLowerCase();
    if (emotions.some((e) => e.name.trim().toLowerCase() === trimmedLower)) {
      Alert.alert("Duplicate Emotion", "This emotion is already in the list.");
      return;
    }
    const newEmotionObj: Emotion = { name: trimmed, category: newEmotionCategory };
    const updated = [...emotions, newEmotionObj];
    setEmotions(updated);
    setNewEmotion("");
    setNewEmotionCategory("neutral");
    await saveEmotionPresets(updated);
  }, [newEmotion, newEmotionCategory, emotions]);

  const handleRemoveEmotion = useCallback(async (emotion: Emotion) => {
    setEmotions((prev) => {
      const updated = prev.filter((item) => item.name !== emotion.name);
      const finalList = updated.length > 0 ? updated : DEFAULT_EMOTIONS;
      saveEmotionPresets(finalList);
      return finalList;
    });
  }, []);

  const handleEditEmotion = useCallback(async (oldEmotion: Emotion, newCategory: "positive" | "negative" | "neutral") => {
    setEmotions((prev) => {
      const updated = prev.map((item) =>
        item.name === oldEmotion.name
          ? { ...item, category: newCategory }
          : item
      );
      saveEmotionPresets(updated);
      return updated;
    });
  }, []);

  const handleAddContext = useCallback(async () => {
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
  }, [newContext, contexts]);

  const handleRemoveContext = useCallback(async (value: string) => {
    setContexts((prev) => {
      const updated = prev.filter((item) => item !== value);
      const finalList = updated.length > 0 ? updated : DEFAULT_CONTEXTS;
      saveContextTags(finalList);
      return finalList;
    });
  }, []);

  const handleQuickEntryToggle = async (
    key: keyof QuickEntryPrefs,
    value: boolean
  ) => {
    const updated = { ...quickEntryPrefs, [key]: value };
    setQuickEntryPrefs(updated);
    await saveQuickEntryPrefs(updated);
  };

  const resolveExportRange = () => {
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
  };

  const formatDateSlug = (date: Date) => date.toISOString().split("T")[0];

  const shareJsonData = async (jsonData: string) => {
    const fileName =
      exportRange === "custom"
        ? `moodinator-export-${formatDateSlug(
            customStartDate
          )}-to-${formatDateSlug(customEndDate)}.json`
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

      const fileUri =
        await FileSystem.StorageAccessFramework.createFileAsync(
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
      } catch (error) {
        Alert.alert("Error", "Export file created but could not be shared.");
      }
    }

    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (e) {
      console.warn("Cleanup failed:", e);
    }
  };

  const handleExportShare = async () => {
    const rangePayload = resolveExportRange();
    if (rangePayload === null) return;
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

  const handleToggleLabels = async (value: boolean) => {
    setShowDetailedLabels(value);
    try {
      await AsyncStorage.setItem(SHOW_LABELS_KEY, value.toString());
    } catch (error) {
      console.error("Failed to save label preference:", error);
    }
  };

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
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    setExportModalVisible(true);
  };

  const handleImport = async () => {
    try {
      setLoading("import");
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
      });

      if (result.canceled) return;

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
  };

  const handleSeedMoods = async () => {
    try {
      setLoading("seed");
      const result = await seedMoods();
      Alert.alert(
        "Sample Data Added",
        `Successfully added ${result} sample mood entries.`
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add sample data");
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
    Alert.alert("Scheduled", "Notification will appear in 2 seconds.");
  };

  const handleClearMoods = async () => {
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
            } catch (error) {
              Alert.alert("Error", "Failed to clear mood data");
            } finally {
              setLoading(null);
            }
          },
        },
      ]
    );
  };

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
        {/* App Settings */}
        <SectionHeader title="Preferences" icon="⚙️" />
        <SettingCard>
          <ToggleRow
            title="Detailed Labels"
            description="Show mood descriptions in charts"
            value={showDetailedLabels}
            onChange={handleToggleLabels}
          />
          <SettingRow
            label="Notifications"
            subLabel="Manage reminders"
            icon="notifications-outline"
            isLast
            action={
              <Link href="/notifications" asChild>
                <TouchableOpacity>
                  <View className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                    <Text className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                      Configure
                    </Text>
                  </View>
                </TouchableOpacity>
              </Link>
            }
          />
        </SettingCard>

        {/* Customization */}
        <SectionHeader title="Entry Customization" icon="✨" />
        <SettingCard>
          <ToggleRow
            title="Quick Entry: Emotions"
            value={quickEntryPrefs.showEmotions}
            onChange={(v) => handleQuickEntryToggle("showEmotions", v)}
          />
          <ToggleRow
            title="Quick Entry: Context"
            value={quickEntryPrefs.showContext}
            onChange={(v) => handleQuickEntryToggle("showContext", v)}
          />
          <ToggleRow
            title="Quick Entry: Energy"
            value={quickEntryPrefs.showEnergy}
            onChange={(v) => handleQuickEntryToggle("showEnergy", v)}
          />
          <ToggleRow
            title="Quick Entry: Notes"
            value={quickEntryPrefs.showNotes}
            onChange={(v) => handleQuickEntryToggle("showNotes", v)}
          />
          <EmotionListEditor
            title="Emotions"
            description="Custom emotions for entries (sorted alphabetically)"
            placeholder="Add emotion..."
            items={emotions}
            newValue={newEmotion}
            newCategory={newEmotionCategory}
            onChangeNewValue={setNewEmotion}
            onChangeCategory={setNewEmotionCategory}
            onAdd={handleAddEmotion}
            onRemove={handleRemoveEmotion}
            onEdit={handleEditEmotion}
          />
          <ListEditor
            title="Contexts"
            description="Tags for where/who/what"
            placeholder="Add context..."
            items={contexts}
            newValue={newContext}
            onChangeNewValue={setNewContext}
            onAdd={handleAddContext}
            onRemove={handleRemoveContext}
            isLast
          />
        </SettingCard>

        {/* Data Management */}
        <SectionHeader title="Data" icon="💾" />
        <SettingCard>
          <SettingRow
            label="Export Data"
            subLabel="Save your history as JSON"
            icon="download-outline"
            onPress={handleExport}
          />
          <SettingRow
            label="Import Data"
            subLabel="Restore from JSON backup"
            icon="refresh-outline"
            onPress={handleImport}
          />
          <SettingRow
            label="Therapy Export"
            subLabel="Create a report for your therapist"
            icon="document-text-outline"
            action={
              <Link href="/therapy-export" asChild>
                <TouchableOpacity>
                  <View className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full">
                    <Text className="text-purple-600 dark:text-purple-400 font-medium text-sm">
                      Create
                    </Text>
                  </View>
                </TouchableOpacity>
              </Link>
            }
          />
          {Platform.OS === "android" ? (
            <>
              <SettingRow
                label="Backup Folder"
                subLabel={
                  backupFolderUri !== null
                    ? `Location: ${formatBackupFolderPath(backupFolderUri)}`
                    : "Select a folder for automatic backups"
                }
                icon="folder-outline"
                onPress={handleSelectBackupFolder}
                isLast={!backupFolderUri}
              />
              {backupFolderUri ? (
                <SettingRow
                  label="Automatic Backups"
                  subLabel={
                    backupInfo
                      ? `${
                          backupInfo.count
                        } backup(s), last: ${formatBackupDate(
                          backupInfo.latestBackup
                        )}`
                      : "Checking backup status..."
                  }
                  icon="cloud-done-outline"
                  action={
                    <TouchableOpacity
                      onPress={handleManualBackup}
                      disabled={loading === "export"}
                    >
                      <View className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                        {loading === "export" ? (
                          <ActivityIndicator size="small" color="#16a34a" />
                        ) : (
                          <Text className="text-green-600 dark:text-green-400 font-medium text-sm">
                            Backup Now
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  }
                  isLast
                />
              ) : null}
            </>
          ) : (
            <SettingRow
              label="Automatic Backups"
              subLabel={
                backupInfo
                  ? `${backupInfo.count} backup(s), last: ${formatBackupDate(
                      backupInfo.latestBackup
                    )}`
                  : "Checking backup status..."
              }
              icon="cloud-done-outline"
              action={
                <TouchableOpacity
                  onPress={handleManualBackup}
                  disabled={loading === "export"}
                >
                  <View className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                    {loading === "export" ? (
                      <ActivityIndicator size="small" color="#16a34a" />
                    ) : (
                      <Text className="text-green-600 dark:text-green-400 font-medium text-sm">
                        Backup Now
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              }
              isLast
            />
          )}
        </SettingCard>

        {/* Developer Options */}
        <SectionHeader title="Advanced" icon="🛠️" />
        <SettingCard>
          <ToggleRow
            title="Developer Mode"
            value={devOptionsEnabled}
            onChange={handleToggleDevOptions}
            isLast={!devOptionsEnabled}
          />
          {devOptionsEnabled && (
            <>
              <SettingRow
                label="Add Sample Data"
                subLabel="Generate test entries"
                icon="flask-outline"
                onPress={handleSeedMoods}
              />
              <SettingRow
                label="Test Notification"
                subLabel="Send a push in 2s"
                icon="notifications-circle-outline"
                onPress={handleTestNotification}
              />
              <SettingRow
                label="Clear All Data"
                subLabel="Permanently delete everything"
                icon="trash-outline"
                destructive
                isLast
                onPress={handleClearMoods}
              />
            </>
          )}
        </SettingCard>

        <View className="mt-8 mb-4 items-center">
          <Text className="text-slate-400 text-xs">Moodinator v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Export Modal */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExportModalVisible(false)}
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

            {/* Date Pickers */}
            {showStartDatePicker && (
              <DateTimePicker
                value={customStartDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={customEndDate}
                onChange={(e, d) => {
                  if (Platform.OS !== "ios") setShowStartDatePicker(false);
                  if (d) setCustomStartDate(d);
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
                  if (Platform.OS !== "ios") setShowEndDatePicker(false);
                  if (d) setCustomEndDate(d);
                }}
              />
            )}

            <View className="gap-3">
              <TouchableOpacity
                onPress={handleExportShare}
                disabled={loading === "export"}
                className="bg-blue-600 p-4 rounded-xl flex-row justify-center items-center"
              >
                {loading === "export" ? (
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
                onPress={() => setExportModalVisible(false)}
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
    </SafeAreaView>
  );
}
