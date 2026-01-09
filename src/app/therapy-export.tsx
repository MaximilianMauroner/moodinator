import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
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

const FIELD_OPTIONS: Array<{
  key: TherapyExportField;
  label: string;
  description: string;
}> = [
  {
    key: "timestamp",
    label: "Timestamp",
    description: "Exact date and time of the entry",
  },
  {
    key: "mood",
    label: "Mood Score",
    description: "0-10 rating selected for the entry",
  },
  {
    key: "emotions",
    label: "Emotions",
    description: "Selected emotion tags (up to 3)",
  },
  {
    key: "context",
    label: "Context Tags",
    description: "Where you were or who you were with",
  },
  {
    key: "energy",
    label: "Energy Level",
    description: "Selected energy value (0-10)",
  },
  {
    key: "notes",
    label: "Notes",
    description: "Additional thoughts saved with the entry",
  },
];

const RANGE_OPTIONS: Array<{
  key: RangeOption;
  label: string;
  description: string;
}> = [
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
      return `${formatDateSlug(customStartDate)} → ${formatDateSlug(
        customEndDate
      )}`;
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
          ? `${formatDateSlug(customStartDate)}-to-${formatDateSlug(
              customEndDate
            )}`
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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
      <ScrollView className="flex-1 my-4">
        <View className="p-4 space-y-6 flex gap-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              className="px-4 py-2 rounded-xl bg-white/90 dark:bg-white/10 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <Text className="text-lg font-semibold text-slate-700 dark:text-slate-100">
                Back
              </Text>
            </Pressable>
            <Text className="text-xl font-bold text-slate-900 dark:text-white flex-1 text-center">
              Therapy Export Profile
            </Text>
            <View className="w-[64px]" />
          </View>

          <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
            <Text className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Share what matters
            </Text>
            <Text className="text-sm text-slate-600 dark:text-slate-300">
              Customize the CSV your therapist receives. Pick the fields to
              include, choose a timeframe, and export a spreadsheet-ready file.
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Current range: {rangeSummary}
            </Text>
          </View>

          <View className="space-y-3">
            <Text className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Fields to Include
            </Text>
            <View className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {FIELD_OPTIONS.map((field) => {
                const enabled = selectedFields.includes(field.key);
                return (
                  <View
                    key={field.key}
                    className="flex-row items-center justify-between px-4 py-4"
                  >
                    <View className="flex-1 pr-4">
                      <Text className="text-base font-medium text-slate-900 dark:text-slate-100">
                        {field.label}
                      </Text>
                      <Text className="text-sm text-slate-500 dark:text-slate-400">
                        {field.description}
                      </Text>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={() => handleToggleField(field.key)}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          <View className="space-y-3">
            <Text className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Time Range
            </Text>
            <View className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-4">
              {RANGE_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => setRangeOption(option.key)}
                  className={`rounded-2xl border px-4 py-4 ${
                    rangeOption === option.key
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      rangeOption === option.key
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {option.label}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {option.description}
                  </Text>
                </Pressable>
              ))}

              {rangeOption === "custom" && (
                <View className="space-y-5 pt-2">
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Start Date
                    </Text>
                    <View className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
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
                  <View className="space-y-2">
                    <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      End Date
                    </Text>
                    <View className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
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
            </View>
          </View>

          <View className="space-y-4 pt-2">
            <Pressable
              onPress={handleExport}
              disabled={loading}
              className={`rounded-3xl py-4 items-center ${
                loading ? "bg-blue-400" : "bg-blue-600"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Export CSV for Therapist
                </Text>
              )}
            </Pressable>
            <Text className="text-xs text-center text-slate-500 dark:text-slate-400">
              CSV files include column headers. Arrays are joined with
              semicolons.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
