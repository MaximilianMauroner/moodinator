import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { clearMoods, getAllMoods, seedMoodsFromFile } from "@db/db";
import type { MoodEntry } from "@db/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  OverviewTab,
  WeeklyTab,
  DailyTab,
  RawDataTab,
} from "@/components/charts";

type TabType = "overview" | "weekly" | "daily" | "raw";

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "weekly", label: "Weekly", icon: "📅" },
  { id: "daily", label: "Daily", icon: "📈" },
  { id: "raw", label: "Raw Data", icon: "🔬" },
];

export default function ChartsScreen() {
  const [loading, setLoading] = useState<"seed" | "clear" | null>(null);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [moodCount, setMoodCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [lastSeedResult, setLastSeedResult] = useState<{
    count: number;
    source: "file" | "random";
  } | null>(null);

  const getMoodCount = useCallback(async () => {
    const allMoods = await getAllMoods();
    setMoods(allMoods);
    setMoodCount(allMoods.length);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getMoodCount();
  }, [getMoodCount]);

  useEffect(() => {
    getMoodCount();
  }, [loading, getMoodCount]);

  const handleSeedMoods = useCallback(async () => {
    setLoading("seed");
    try {
      const result = await seedMoodsFromFile();
      setLastSeedResult(result);
      console.log(`Seeded ${result.count} moods from ${result.source}`);
    } finally {
      setLoading(null);
    }
  }, []);

  const handleClearMoods = useCallback(async () => {
    setLoading("clear");
    try {
      await clearMoods();
      setLastSeedResult(null);
    } finally {
      setLoading(null);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View className="mt-1 flex gap-2 flex-row justify-center items-center p-4">
            {__DEV__ && (
              <TouchableOpacity
                onPress={handleSeedMoods}
                style={{
                  backgroundColor: "#2563EB",
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 6,
                }}
              >
                {loading === "seed" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    Seed Moods
                  </Text>
                )}
              </TouchableOpacity>
            )}
            <View className="flex flex-row justify-center items-center">
              <Text className="text-3xl font-extrabold text-center text-sky-400">
                Insights
              </Text>
              <Text className="font-semibold pl-2 text-purple-600">
                ({moodCount})
              </Text>
            </View>
            {__DEV__ && (
              <TouchableOpacity
                onPress={handleClearMoods}
                style={{
                  backgroundColor: "#EF4444",
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 6,
                }}
              >
                {loading === "clear" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    Clear Moods
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Seed Result Feedback */}
          {__DEV__ && lastSeedResult && (
            <View className="mx-4 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Text className="text-green-800 text-center font-medium">
                ✅ Loaded {lastSeedResult.count} moods from{" "}
                {lastSeedResult.source === "file" ? "JSON file" : "random data"}
              </Text>
            </View>
          )}

          {/* Tab Navigation */}
          {moodCount > 0 && (
            <View className="mx-4 mb-6">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-row"
              >
                {tabs.map((tab, index) => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={{
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 25,
                      marginRight: 12,
                      backgroundColor:
                        activeTab === tab.id ? "#3B82F6" : "#F3F4F6",
                      borderWidth: activeTab === tab.id ? 0 : 1,
                      borderColor: "#E5E7EB",
                      shadowColor:
                        activeTab === tab.id ? "#3B82F6" : "transparent",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: activeTab === tab.id ? 4 : 0,
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text style={{ fontSize: 18, marginRight: 8 }}>
                        {tab.icon}
                      </Text>
                      <Text
                        style={{
                          fontWeight: "600",
                          color: activeTab === tab.id ? "#FFFFFF" : "#374151",
                        }}
                      >
                        {tab.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Content based on selected tab */}
          <View className="min-h-screen pb-20">
            {moodCount > 0 ? (
              <>
                {activeTab === "overview" && <OverviewTab moods={moods} />}
                {activeTab === "weekly" && <WeeklyTab moods={moods} />}
                {activeTab === "daily" && <DailyTab moods={moods} />}
                {activeTab === "raw" && <RawDataTab moods={moods} />}
              </>
            ) : (
              <View className="flex-1 justify-center items-center p-8 mt-20">
                <Text className="text-6xl mb-4">📊</Text>
                <Text className="text-gray-500 text-center text-lg font-semibold">
                  No mood data available yet
                </Text>
                <Text className="text-gray-400 text-center mt-2">
                  Start tracking your moods to see beautiful insights here!
                </Text>
                {__DEV__ && (
                  <Text className="text-blue-500 text-center mt-4 text-sm">
                    💡 Use "Seed Moods" button above to add sample data
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
