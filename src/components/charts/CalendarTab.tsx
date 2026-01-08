import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { getAllMoods } from "@db/db";
import { MoodEntry } from "@db/types";

interface DayData {
  date: Date;
  moods: MoodEntry[];
  avgMood: number | null;
}

interface MonthData {
  year: number;
  month: number;
  days: (DayData | null)[];
}

export function CalendarTab({ onRefresh }: { onRefresh?: () => void }) {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  useEffect(() => {
    loadMoods();
  }, []);

  const loadMoods = async () => {
    setLoading(true);
    try {
      const data = await getAllMoods();
      setMoods(data);
    } catch (error) {
      console.error("Failed to load moods:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMoods();
    onRefresh?.();
    setRefreshing(false);
  };

  // Helper to format a date in local timezone as YYYY-MM-DD
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const monthsData = useMemo(() => {
    if (moods.length === 0) return [];

    // Group moods by date
    const moodsByDate: { [key: string]: MoodEntry[] } = {};
    for (const mood of moods) {
      const date = new Date(mood.timestamp);
      date.setHours(0, 0, 0, 0);
      const dateKey = formatLocalDate(date);
      if (!moodsByDate[dateKey]) {
        moodsByDate[dateKey] = [];
      }
      moodsByDate[dateKey].push(mood);
    }

    // Get date range
    const timestamps = moods.map((m) => m.timestamp);
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));

    earliest.setDate(1);
    earliest.setHours(0, 0, 0, 0);
    latest.setDate(1);
    latest.setHours(0, 0, 0, 0);

    const months: MonthData[] = [];
    const current = new Date(latest);

    // Generate last 12 months or until earliest date
    let monthsToShow = 12;
    while (monthsToShow > 0 && current >= earliest) {
      const year = current.getFullYear();
      const month = current.getMonth();

      // Get first day of month and last day
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // Build calendar grid (7 columns, starting with Sunday)
      const startDayOfWeek = firstDay.getDay();
      const daysInMonth = lastDay.getDate();

      const days: (DayData | null)[] = [];

      // Add empty cells for days before month starts
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null);
      }

      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateKey = formatLocalDate(date);
        const dayMoods = moodsByDate[dateKey] || [];
        const avgMood =
          dayMoods.length > 0
            ? dayMoods.reduce((sum, m) => sum + m.mood, 0) / dayMoods.length
            : null;

        days.push({
          date,
          moods: dayMoods,
          avgMood,
        });
      }

      months.push({ year, month, days });

      current.setMonth(current.getMonth() - 1);
      monthsToShow--;
    }

    // Return months in chronological order (earliest to latest)
    return months.reverse();
  }, [moods]);

  const getMoodColor = (avgMood: number | null) => {
    if (avgMood === null) {
      return "bg-slate-100 dark:bg-slate-800";
    }

    // Mood scale (with neutral band): 0-2 positive, 2-4.5 okay, 4.5-5.5 neutral, 5.5-7 low, 7-10 negative
    if (avgMood <= 2) {
      return "bg-indigo-500 dark:bg-indigo-600";
    } else if (avgMood < 4.5) {
      return "bg-cyan-400 dark:bg-cyan-500";
    } else if (avgMood >= 4.5 && avgMood <= 5.5) {
      return "bg-slate-400 dark:bg-slate-500";
    } else if (avgMood <= 7) {
      return "bg-yellow-500 dark:bg-yellow-600";
    } else {
      return "bg-orange-600 dark:bg-orange-700";
    }
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-slate-500 dark:text-slate-400 mt-4">
          Loading calendar...
        </Text>
      </View>
    );
  }

  if (moods.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-6xl mb-3">📅</Text>
        <Text className="text-center text-slate-600 dark:text-slate-300 font-medium">
          No moods tracked yet
        </Text>
        <Text className="text-center text-slate-500 dark:text-slate-400 text-sm mt-2">
          Start tracking to see your mood calendar!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View className="p-4 space-y-4">
        {/* Legend */}
        <View className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
            Mood Scale
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-row items-center">
              <View className="w-4 h-4 rounded bg-indigo-500 dark:bg-indigo-600 mr-2" />
              <Text className="text-xs text-slate-600 dark:text-slate-400">
                Great (0-2)
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-4 h-4 rounded bg-cyan-400 dark:bg-cyan-500 mr-2" />
              <Text className="text-xs text-slate-600 dark:text-slate-400">
                Good (2-4.5)
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-4 h-4 rounded bg-slate-400 dark:bg-slate-500 mr-2" />
              <Text className="text-xs text-slate-600 dark:text-slate-400">
                Neutral (4.5-5.5)
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-4 h-4 rounded bg-yellow-500 dark:bg-yellow-600 mr-2" />
              <Text className="text-xs text-slate-600 dark:text-slate-400">
                Low (5.5-7)
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-4 h-4 rounded bg-orange-600 dark:bg-orange-700 mr-2" />
              <Text className="text-xs text-slate-600 dark:text-slate-400">
                Struggling (8-10)
              </Text>
            </View>
          </View>
        </View>

        {/* Selected Day Details */}
        {selectedDay && selectedDay.avgMood !== null && (
          <View className="bg-blue-50 dark:bg-blue-950/40 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
                {selectedDay.date.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <TouchableOpacity onPress={() => setSelectedDay(null)}>
                <Text className="text-blue-600 dark:text-blue-400 font-semibold">
                  Close
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              {selectedDay.moods.length} {selectedDay.moods.length === 1 ? "entry" : "entries"}
            </Text>
            <Text className="text-sm text-slate-600 dark:text-slate-400">
              Average mood: {selectedDay.avgMood.toFixed(1)}
            </Text>
          </View>
        )}

        {/* Calendar Months */}
        {monthsData.map((monthData, monthIndex) => (
          <View
            key={`${monthData.year}-${monthData.month}`}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800"
          >
            <Text className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
              {monthNames[monthData.month]} {monthData.year}
            </Text>

            {/* Day labels */}
            <View className="flex-row mb-2">
              {dayLabels.map((label) => (
                <View key={label} className="flex-1 items-center">
                  <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View className="flex-row flex-wrap">
              {monthData.days.map((day, index) => {
                if (day === null) {
                  return (
                    <View
                      key={`empty-${index}`}
                      style={{ width: "14.28%" }}
                      className="aspect-square p-0.5"
                    />
                  );
                }

                const isToday =
                  day.date.toDateString() === new Date().toDateString();

                return (
                  <TouchableOpacity
                    key={index}
                    style={{ width: "14.28%" }}
                    className="aspect-square p-0.5"
                    onPress={() =>
                      day.avgMood !== null ? setSelectedDay(day) : null
                    }
                    disabled={day.avgMood === null}
                  >
                    <View
                      className={`flex-1 rounded-md items-center justify-center ${getMoodColor(
                        day.avgMood
                      )} ${
                        isToday
                          ? "border-2 border-blue-600 dark:border-blue-400"
                          : ""
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          day.avgMood !== null
                            ? "text-white"
                            : "text-slate-400 dark:text-slate-600"
                        }`}
                      >
                        {day.date.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View className="h-4" />
      </View>
    </ScrollView>
  );
}
