import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import {
  DEFAULT_THERAPY_EXPORT_PREFS,
  TherapyExportField,
  getTherapyExportPrefs,
  saveTherapyExportPrefs,
} from "@/lib/entrySettings";
import { MoodDateRange, MoodRangePreset, getMoodsWithinRange } from "@db/db";

type RangeOption = MoodRangePreset | "custom";

const FIELD_OPTIONS: {
  key: TherapyExportField;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "timestamp",
    label: "Timestamp",
    description: "Exact date and time of the entry",
    icon: "time-outline",
  },
  {
    key: "mood",
    label: "Mood Score",
    description: "0-10 rating selected for the entry",
    icon: "happy-outline",
  },
  {
    key: "emotions",
    label: "Emotions",
    description: "Selected emotion tags (up to 3)",
    icon: "heart-outline",
  },
  {
    key: "context",
    label: "Context Tags",
    description: "Where you were or who you were with",
    icon: "location-outline",
  },
  {
    key: "energy",
    label: "Energy Level",
    description: "Selected energy value (0-10)",
    icon: "flash-outline",
  },
  {
    key: "notes",
    label: "Notes",
    description: "Additional thoughts saved with the entry",
    icon: "document-text-outline",
  },
];

const RANGE_OPTIONS: {
  key: RangeOption;
  label: string;
  description: string;
}[] = [
  {
    key: "week",
    label: "Last 7 Days",
    description: "Entries from the past week",
  },
  {
    key: "twoWeeks",
    label: "Last 14 Days",
    description: "Entries from the past two weeks",
  },
  {
    key: "month",
    label: "Last 30 Days",
    description: "Entries from the past month",
  },
  {
    key: "custom",
    label: "Custom Range",
    description: "Choose your own start and end dates",
  },
];

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatTimestamp(value: number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function formatDateSlug(date: Date) {
  return date.toISOString().split("T")[0];
}

function buildCsv(
  rows: Awaited<ReturnType<typeof getMoodsWithinRange>>,
  fields: TherapyExportField[]
) {
  const header = fields.map((field) => {
    const option = FIELD_OPTIONS.find((item) => item.key === field);
    return option ? option.label : field;
  });

  const body = rows.map((entry) => {
    return fields.map((field) => {
      switch (field) {
        case "timestamp":
          return csvEscape(formatTimestamp(entry.timestamp));
        case "mood":
          return csvEscape(entry.mood);
        case "emotions":
          return csvEscape(entry.emotions.map((emotion) => emotion.name).join("; "));
        case "context":
          return csvEscape(entry.contextTags.join("; "));
        case "energy":
          return csvEscape(
            entry.energy === null || entry.energy === undefined
              ? ""
              : entry.energy
          );
        case "notes":
          return csvEscape(entry.note ?? "");
        default:
          return "";
      }
    });
  });

  return [header, ...body].map((cells) => cells.join(",")).join("\n");
}

export default function TherapyExportScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [selectedFields, setSelectedFields] = useState<TherapyExportField[]>(
    DEFAULT_THERAPY_EXPORT_PREFS.fields
  );
  const [rangeOption, setRangeOption] = useState<RangeOption>("week");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date;
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    (async () => {
      const prefs = await getTherapyExportPrefs();
      setSelectedFields(prefs.fields);
    })();
  }, []);

  const handleToggleField = (field: TherapyExportField) => {
    setSelectedFields((prev) => {
      const hasField = prev.includes(field);
      if (hasField && prev.length === 1) {
        Alert.alert("At least one field", "Keep at least one field selected.");
        return prev;
      }
      const next = hasField
        ? prev.filter((item) => item !== field)
        : [...prev, field];
      void saveTherapyExportPrefs({ fields: next });
      return next;
    });
  };

  const rangeSummary = useMemo(() => {
    if (rangeOption === "custom") {
      return `${formatDateSlug(customStartDate)} → ${formatDateSlug(customEndDate)}`;
    }
    const option = RANGE_OPTIONS.find((opt) => opt.key === rangeOption);
    return option?.label ?? "Last 7 Days";
  }, [rangeOption, customStartDate, customEndDate]);

  const resolveRangePayload = ():
    | MoodDateRange
    | { startDate: number; endDate: number }
    | null => {
    if (rangeOption === "custom") {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (end.getTime() < start.getTime()) {
        Alert.alert("Invalid range", "End date must be after start date.");
        return null;
      }
      return {
        startDate: start.getTime(),
        endDate: end.getTime(),
      };
    }
    return { preset: rangeOption };
  };

  const handleExport = async () => {
    if (!selectedFields.length) {
      Alert.alert("Select fields", "Choose at least one field to export.");
      return;
    }

    const rangePayload = resolveRangePayload();
    if (!rangePayload) return;

    try {
      setLoading(true);
      const rows = await getMoodsWithinRange(rangePayload);
      if (!rows.length) {
        Alert.alert("No entries", "No mood entries found for this range.");
        return;
      }
      const csv = buildCsv(rows, selectedFields);
      const fileSuffix =
        rangeOption === "custom"
          ? `${formatDateSlug(customStartDate)}-to-${formatDateSlug(customEndDate)}`
          : rangeOption;
      const fileUri = `${FileSystem.cacheDirectory}therapy-export-${fileSuffix}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Share Therapy Export",
        });
      } else {
        await Clipboard.setStringAsync(csv);
        Alert.alert(
          "Copied instead",
          "CSV export copied to clipboard (sharing unavailable)."
        );
      }
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error("Therapy export failed", error);
      Alert.alert(
        "Export failed",
        "We couldn't generate the CSV. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = selectedFields.length;

  return (
    <SafeAreaView className="flex-1 bg-paper-100 dark:bg-paper-900" edges={["top"]}>
      {/* Header */}
      <View className="px-4 pt-2 pb-4 bg-paper-100 dark:bg-paper-900">
        {/* Back button row */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center py-2 -ml-1 mb-3"
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={isDark ? "#A8C5A8" : "#5B8A5B"}
          />
          <Text className="text-base font-medium ml-1 text-sage-500 dark:text-sage-300">
            Settings
          </Text>
        </TouchableOpacity>

        {/* Title row with icon */}
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4 bg-dusk-100 dark:bg-dusk-800">
            <Ionicons name="medical-outline" size={28} color={isDark ? "#C4BBCF" : "#847596"} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-medium mb-0.5 text-dusk-500 dark:text-dusk-300">
              Data
            </Text>
            <Text className="text-2xl font-bold text-paper-800 dark:text-paper-200 tracking-tight">
              Therapy Export
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View className="mx-4 mb-4 p-4 rounded-2xl bg-dusk-100 dark:bg-dusk-800">
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl mr-2">📋</Text>
            <Text className="text-base font-bold text-dusk-500 dark:text-dusk-300">
              Share what matters
            </Text>
          </View>
          <Text className="text-xs text-sand-500 dark:text-sand-400 mb-2">
            Customize the CSV your therapist receives. Pick the fields to include, choose a timeframe, and export a spreadsheet-ready file.
          </Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="calendar-outline" size={14} color={isDark ? "#C4BBCF" : "#847596"} />
            <Text className="text-xs font-medium ml-1 text-dusk-500 dark:text-dusk-300">
              {rangeSummary}
            </Text>
          </View>
        </View>

        {/* Fields Section */}
        <View className="mx-4 mb-4">
          <Text className="text-xs font-semibold uppercase tracking-wider text-sand-500 dark:text-sand-400 mb-2 ml-1">
            Fields to Include ({selectedCount}/6)
          </Text>
          <View
            className="rounded-2xl bg-paper-50 dark:bg-paper-850 overflow-hidden"
            style={isDark ? styles.sectionShadowDark : styles.sectionShadowLight}
          >
            {FIELD_OPTIONS.map((field, index) => {
              const enabled = selectedFields.includes(field.key);
              const isLast = index === FIELD_OPTIONS.length - 1;
              return (
                <View
                  key={field.key}
                  className={`flex-row items-center p-4 ${!isLast ? "border-b border-paper-200 dark:border-paper-800" : ""}`}
                >
                  <View className="w-9 h-9 rounded-xl items-center justify-center mr-3 bg-sage-100 dark:bg-sage-600/20">
                    <Ionicons
                      name={field.icon}
                      size={18}
                      color={isDark ? "#A8C5A8" : "#5B8A5B"}
                    />
                  </View>
                  <View className="flex-1 mr-4">
                    <Text className="text-base font-medium text-paper-800 dark:text-paper-200">
                      {field.label}
                    </Text>
                    <Text className="text-sm text-sand-500 dark:text-sand-400 mt-0.5">
                      {field.description}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => handleToggleField(field.key)}
                    trackColor={{
                      false: isDark ? "#3D352A" : "#E5D9BF",
                      true: "#5B8A5B",
                    }}
                    thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
                    ios_backgroundColor={isDark ? "#3D352A" : "#E5D9BF"}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Time Range Section */}
        <View className="mx-4 mb-4">
          <Text className="text-xs font-semibold uppercase tracking-wider text-sand-500 dark:text-sand-400 mb-2 ml-1">
            Time Range
          </Text>
          <View
            className="rounded-2xl bg-paper-50 dark:bg-paper-850 overflow-hidden p-4"
            style={isDark ? styles.sectionShadowDark : styles.sectionShadowLight}
          >
            <View className="gap-3">
              {RANGE_OPTIONS.map((option) => {
                const isSelected = rangeOption === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setRangeOption(option.key)}
                    className={`rounded-2xl border px-4 py-3 ${
                      isSelected
                        ? "border-sage-500 bg-sage-100 dark:bg-sage-600/20"
                        : "border-paper-200 dark:border-paper-800"
                    }`}
                  >
                    <Text
                      className={`font-semibold ${
                        isSelected
                          ? "text-sage-500 dark:text-sage-300"
                          : "text-paper-800 dark:text-paper-200"
                      }`}
                    >
                      {option.label}
                    </Text>
                    <Text className="text-xs text-sand-500 dark:text-sand-400 mt-1">
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {rangeOption === "custom" && (
              <View className="mt-4 gap-4">
                <View>
                  <Text className="text-sm font-semibold text-paper-700 dark:text-paper-300 mb-2">
                    Start Date
                  </Text>
                  {Platform.OS === "ios" ? (
                    <View className="rounded-2xl border border-paper-200 dark:border-paper-800 bg-paper-100 dark:bg-paper-900 p-2 overflow-hidden">
                      <DateTimePicker
                        value={customStartDate}
                        mode="date"
                        display="spinner"
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
                  ) : (
                    <>
                      <Pressable
                        onPress={() => setShowStartPicker(true)}
                        className="rounded-2xl border border-paper-200 dark:border-paper-800 bg-paper-100 dark:bg-paper-900 p-4 flex-row items-center justify-between"
                      >
                        <View className="flex-row items-center">
                          <Ionicons name="calendar-outline" size={20} color={isDark ? "#A8C5A8" : "#5B8A5B"} />
                          <Text className="text-base font-medium text-paper-800 dark:text-paper-200 ml-3">
                            {customStartDate.toLocaleDateString()}
                          </Text>
                        </View>
                        <Ionicons name="chevron-down" size={20} color={isDark ? "#6B5C4A" : "#9D8660"} />
                      </Pressable>
                      {showStartPicker && (
                        <DateTimePicker
                          value={customStartDate}
                          mode="date"
                          display="default"
                          maximumDate={customEndDate}
                          onChange={(_, date) => {
                            setShowStartPicker(false);
                            if (date) {
                              setCustomStartDate(date);
                              if (date > customEndDate) {
                                setCustomEndDate(date);
                              }
                            }
                          }}
                        />
                      )}
                    </>
                  )}
                </View>
                <View>
                  <Text className="text-sm font-semibold text-paper-700 dark:text-paper-300 mb-2">
                    End Date
                  </Text>
                  {Platform.OS === "ios" ? (
                    <View className="rounded-2xl border border-paper-200 dark:border-paper-800 bg-paper-100 dark:bg-paper-900 p-2 overflow-hidden">
                      <DateTimePicker
                        value={customEndDate}
                        mode="date"
                        display="spinner"
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
                  ) : (
                    <>
                      <Pressable
                        onPress={() => setShowEndPicker(true)}
                        className="rounded-2xl border border-paper-200 dark:border-paper-800 bg-paper-100 dark:bg-paper-900 p-4 flex-row items-center justify-between"
                      >
                        <View className="flex-row items-center">
                          <Ionicons name="calendar-outline" size={20} color={isDark ? "#A8C5A8" : "#5B8A5B"} />
                          <Text className="text-base font-medium text-paper-800 dark:text-paper-200 ml-3">
                            {customEndDate.toLocaleDateString()}
                          </Text>
                        </View>
                        <Ionicons name="chevron-down" size={20} color={isDark ? "#6B5C4A" : "#9D8660"} />
                      </Pressable>
                      {showEndPicker && (
                        <DateTimePicker
                          value={customEndDate}
                          mode="date"
                          display="default"
                          minimumDate={customStartDate}
                          maximumDate={new Date()}
                          onChange={(_, date) => {
                            setShowEndPicker(false);
                            if (date) {
                              setCustomEndDate(date);
                              if (date < customStartDate) {
                                setCustomStartDate(date);
                              }
                            }
                          }}
                        />
                      )}
                    </>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Export Button */}
        <View className="mx-4 mt-2">
          <Pressable
            onPress={handleExport}
            disabled={loading}
            className={`rounded-2xl py-4 items-center flex-row justify-center ${
              loading ? "bg-sage-400" : "bg-sage-500"
            }`}
            style={isDark ? styles.buttonShadowDark : styles.buttonShadowLight}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text className="text-white font-semibold text-base ml-2">
                  Export CSV for Therapist
                </Text>
              </>
            )}
          </Pressable>
          <Text className="text-xs text-center text-sand-500 dark:text-sand-400 mt-3">
            CSV files include column headers. Arrays are joined with semicolons.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionShadowLight: {
    elevation: 2,
    shadowColor: "#9D8660",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionShadowDark: {
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonShadowLight: {
    elevation: 3,
    shadowColor: "#5B8A5B",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonShadowDark: {
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
