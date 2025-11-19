import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { MoodEntry } from "@db/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import PagerView, {
  PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { getAllMoods } from "@db/db";
import {
  DailyTab,
  OverviewTab,
  RawDataTab,
  WeeklyTab,
} from "@/components/charts";
import { Ionicons } from "@expo/vector-icons";

type TabType = "overview" | "weekly" | "daily" | "raw";

const tabs: {
  id: TabType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "overview", label: "Overview", icon: "stats-chart" },
  { id: "weekly", label: "Weekly", icon: "calendar" },
  { id: "daily", label: "Daily", icon: "today" },
  { id: "raw", label: "Data", icon: "list" },
];

const TabSelector = ({
  activeTab,
  onTabPress,
}: {
  activeTab: TabType;
  onTabPress: (id: TabType) => void;
}) => {
  const containerShadow = {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  };

  const activeTabShadow = {
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  };

  return (
    <View
      className="mx-4 mb-4 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 flex-row"
      style={containerShadow}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onTabPress(tab.id)}
            className={`flex-1 flex-row items-center justify-center py-2 rounded-lg transition-all ${
              isActive ? "bg-white dark:bg-slate-800" : ""
            }`}
            style={isActive ? activeTabShadow : undefined}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={isActive ? "#3b82f6" : "#94a3b8"}
              style={{ marginRight: 6 }}
            />
            <Text
              className={`text-xs font-bold ${
                isActive
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default function ChartsScreen() {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [moodCount, setMoodCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const pagerRef = useRef<PagerView>(null);

  const loadFullMoodData = useCallback(async () => {
    try {
      setLoading(true);
      const allMoods = await getAllMoods();
      setMoods(allMoods);
      setMoodCount(allMoods.length);
      setDataLoaded(true);
    } catch (error) {
      console.error("Failed to load mood data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    loadFullMoodData();
  }, [loadFullMoodData]);

  useEffect(() => {
    loadFullMoodData();
  }, [loadFullMoodData]);

  const handleTabPress = (tabId: TabType) => {
    const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) return;
    pagerRef.current?.setPage(tabIndex);
    setActiveTab(tabId);
  };

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      const pageIndex = event.nativeEvent.position;
      const selectedTab = tabs[pageIndex];
      if (selectedTab) {
        setActiveTab(selectedTab.id);
      }
    },
    []
  );

  if (loading && !dataLoaded) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-slate-950">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-slate-400 mt-4 font-medium">
          Loading Insights...
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1 bg-slate-50 dark:bg-slate-950"
        edges={["top"]}
      >
        {/* Header */}
        <View className="px-6 py-4 bg-slate-50 dark:bg-slate-950">
          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-3xl font-extrabold text-slate-900 dark:text-white">
                Insights
              </Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {moodCount} entries tracked
              </Text>
            </View>
            <TouchableOpacity
              onPress={onRefresh}
              className="bg-white dark:bg-slate-800 p-2 rounded-full border border-slate-200 dark:border-slate-700"
            >
              <Ionicons name="refresh" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {moodCount > 0 ? (
          <>
            <TabSelector activeTab={activeTab} onTabPress={handleTabPress} />
            <PagerView
              ref={pagerRef}
              style={{ flex: 1 }}
              initialPage={0}
              scrollEnabled={true}
              onPageSelected={handlePageSelected}
            >
              <View key="overview" className="flex-1">
                <OverviewTab moods={moods} onRefresh={onRefresh} />
              </View>
              <View key="weekly" className="flex-1">
                <WeeklyTab moods={moods} onRefresh={onRefresh} />
              </View>
              <View key="daily" className="flex-1">
                <DailyTab moods={moods} onRefresh={onRefresh} />
              </View>
              <View key="raw" className="flex-1">
                <RawDataTab moods={moods} onRefresh={onRefresh} />
              </View>
            </PagerView>
          </>
        ) : (
          <View className="flex-1 justify-center items-center p-8 opacity-70">
            <View className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center mb-6">
              <Text className="text-4xl">📊</Text>
            </View>
            <Text className="text-slate-900 dark:text-white text-xl font-bold mb-2">
              No Data Yet
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-center leading-6">
              Start tracking your moods to unlock insights about your patterns
              and well-being.
            </Text>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
