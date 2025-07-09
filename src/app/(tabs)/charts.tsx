import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import type { MoodEntry } from "@db/types";
import { getAllMoods } from "@db/db";
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
  const { width } = useWindowDimensions();
  const horizontalPager = useRef<ScrollView>(null);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [moodCount, setMoodCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const getMoodCount = useCallback(async () => {
    setLoading(true);
    const allMoods = await getAllMoods();
    setMoods(allMoods);
    setMoodCount(allMoods.length);
    setRefreshing(false);
    setLoading(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getMoodCount();
  }, [getMoodCount]);

  useEffect(() => {
    getMoodCount();
  }, [getMoodCount]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
        {/* Header */}
        <View className="mt-1 flex flex-row justify-center items-center p-4">
          <Text className="text-3xl font-extrabold text-center text-sky-400">
            Insights
          </Text>
          <View className="justify-center">
            <Text className="font-semibold pl-2 text-purple-600">
              ({moodCount})
            </Text>
          </View>
        </View>

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
                  onPress={() => {
                    setActiveTab(tab.id);
                    horizontalPager.current?.scrollTo({
                      x: width * index,
                      animated: true,
                    });
                  }}
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
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
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
        {loading ? (
          <View className="flex-1 justify-center items-center p-8 mt-20">
            <Text className="text-6xl mb-4">⏳</Text>
            <Text className="text-gray-500 text-center text-lg font-semibold">
              Loading your mood data...
            </Text>
          </View>
        ) : moodCount > 0 ? (
          <ScrollView
            ref={horizontalPager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={1}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveTab(tabs[idx].id);
            }}
            onScrollEndDrag={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveTab(tabs[idx].id);
            }}
            onScrollBeginDrag={(e) => {
              const currentOffset = e.nativeEvent.contentOffset.x;
              const idx = Math.round(currentOffset / width);
              setActiveTab(tabs[idx].id);
            }}
            style={{ flex: 1 }}
            directionalLockEnabled={true}
          >
            <View style={{ width }}>
              <OverviewTab moods={moods} onRefresh={onRefresh} />
            </View>
            <View style={{ width }}>
              <WeeklyTab moods={moods} onRefresh={onRefresh} />
            </View>
            <View style={{ width }}>
              <DailyTab moods={moods} onRefresh={onRefresh} />
            </View>
            <View style={{ width }}>
              <RawDataTab moods={moods} onRefresh={onRefresh} />
            </View>
          </ScrollView>
        ) : !loading ? (
          <View className="flex-1 justify-center items-center p-8 mt-20">
            <Text className="text-6xl mb-4">📊</Text>
            <Text className="text-gray-500 text-center text-lg font-semibold">
              No mood data available yet
            </Text>
            <Text className="text-gray-400 text-center mt-2">
              Start tracking your moods to see beautiful insights here!
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
