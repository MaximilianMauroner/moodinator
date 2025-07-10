import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { MoodEntry } from "@db/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import PagerView from "react-native-pager-view";

// Use inline requires for lazy loading - these will only be loaded when needed
let OverviewTab: any = null;
let WeeklyTab: any = null;
let DailyTab: any = null;
let RawDataTab: any = null;
let getAllMoods: any = null;

type TabType = "overview" | "weekly" | "daily" | "raw";

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "weekly", label: "Weekly", icon: "📅" },
  { id: "daily", label: "Daily", icon: "📈" },
  { id: "raw", label: "Raw Data", icon: "🔬" },
];

export default function ChartsScreen() {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [moodCount, setMoodCount] = useState<number>(0);
  const [_, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [componentsLoaded, setComponentsLoaded] = useState(false);
  const pagerRef = useRef<PagerView>(null);
  const tabScrollRef = useRef<ScrollView>(null);

  const getCurrentTabIndex = () => {
    return tabs.findIndex((tab) => tab.id === activeTab);
  };

  // Scroll the active tab into view
  const scrollToActiveTab = useCallback((tabIndex: number) => {
    if (tabScrollRef.current) {
      // Calculate the position to scroll to keep the active tab centered
      const tabWidth = 120; // Approximate tab width including margins
      const scrollPosition = Math.max(0, tabIndex * tabWidth - tabWidth * 1.5);

      tabScrollRef.current.scrollTo({
        x: scrollPosition,
        animated: true,
      });
    }
  }, []);

  // Load chart components lazily when needed
  const loadChartComponents = useCallback(() => {
    if (!componentsLoaded) {
      try {
        const charts = require("@/components/charts");
        OverviewTab = charts.OverviewTab;
        WeeklyTab = charts.WeeklyTab;
        DailyTab = charts.DailyTab;
        RawDataTab = charts.RawDataTab;

        // Only set componentsLoaded if all components are successfully loaded
        if (OverviewTab && WeeklyTab && DailyTab && RawDataTab) {
          setComponentsLoaded(true);
        } else {
          console.error("Some chart components failed to load");
        }
      } catch (error) {
        console.error("Failed to load chart components:", error);
      }
    }
  }, [componentsLoaded]);

  // Load full mood data in background
  const loadFullMoodData = useCallback(async () => {
    try {
      // Use inline require to load getAllMoods only when needed
      if (!getAllMoods) {
        getAllMoods = require("@db/db").getAllMoods;
      }
      const allMoods = await getAllMoods();
      setMoods(allMoods);
      setMoodCount(allMoods.length);
      setDataLoaded(true);
      setRefreshing(false);
    } catch (error) {
      console.error("Failed to load mood data:", error);
      setRefreshing(false);
    }
  }, []);

  // Fast initial load - just get count first
  const getInitialMoodCount = useCallback(async () => {
    try {
      // Use inline require to defer loading the db module
      const { getMoodCount } = require("@db/db");
      const count = await getMoodCount();
      setMoodCount(count);
      setLoading(false);

      // Only load components and data when count > 0, but delay it
      if (count > 0) {
        // Use a longer delay to ensure UI is fully rendered first
        setTimeout(() => {
          loadChartComponents();
          // Load data after components are loaded
          setTimeout(() => {
            loadFullMoodData();
          }, 200);
        }, 100);
      }
    } catch (error) {
      console.error("Failed to get mood count:", error);
      setLoading(false);
    }
  }, [loadChartComponents, loadFullMoodData]);

  const getMoodCount = useCallback(async () => {
    setRefreshing(true);
    await loadFullMoodData();
  }, [loadFullMoodData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getMoodCount();
  }, [getMoodCount]);

  const handleTabPress = useCallback(
    (tabId: TabType) => {
      const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
      setActiveTab(tabId);
      pagerRef.current?.setPage(tabIndex);
      scrollToActiveTab(tabIndex);

      // Load components when user first interacts with tabs
      if (!componentsLoaded) {
        loadChartComponents();
      }
    },
    [componentsLoaded, loadChartComponents, scrollToActiveTab]
  );

  const handlePageSelected = useCallback(
    (e: any) => {
      const pageIndex = e.nativeEvent.position;
      const selectedTab = tabs[pageIndex];
      if (selectedTab && selectedTab.id !== activeTab) {
        setActiveTab(selectedTab.id);
        scrollToActiveTab(pageIndex);
      }
    },
    [activeTab, scrollToActiveTab]
  );

  const handlePageScroll = useCallback(
    (e: any) => {
      const { position, offset } = e.nativeEvent;

      // Determine which tab should be active based on scroll position
      let targetPosition = position;

      // If we're scrolling significantly toward the next page, switch early for responsiveness
      if (offset > 0.3) {
        targetPosition = position + 1;
      }

      // Make sure we're within bounds
      if (targetPosition >= 0 && targetPosition < tabs.length) {
        const selectedTab = tabs[targetPosition];
        if (selectedTab && selectedTab.id !== activeTab) {
          setActiveTab(selectedTab.id);
          scrollToActiveTab(targetPosition);
        }
      }
    },
    [activeTab, scrollToActiveTab]
  );

  useEffect(() => {
    getInitialMoodCount();
  }, [getInitialMoodCount]);

  // Scroll to active tab when components are loaded
  useEffect(() => {
    if (componentsLoaded && moodCount > 0) {
      const currentIndex = getCurrentTabIndex();
      scrollToActiveTab(currentIndex);
    }
  }, [componentsLoaded, moodCount, scrollToActiveTab]);

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
              ref={tabScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row"
              contentContainerStyle={{ paddingHorizontal: 8 }}
              decelerationRate="fast"
            >
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleTabPress(tab.id)}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 25,
                    marginHorizontal: 6,
                    backgroundColor:
                      activeTab === tab.id ? "#3B82F6" : "#F8FAFC",
                    borderWidth: activeTab === tab.id ? 0 : 1.5,
                    borderColor:
                      activeTab === tab.id ? "transparent" : "#E2E8F0",
                    shadowColor:
                      activeTab === tab.id ? "#3B82F6" : "transparent",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: activeTab === tab.id ? 0.25 : 0,
                    shadowRadius: 4,
                    elevation: activeTab === tab.id ? 4 : 0,
                    transform: [{ scale: activeTab === tab.id ? 1.02 : 1 }],
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>
                      {tab.icon}
                    </Text>
                    <Text
                      style={{
                        fontWeight: activeTab === tab.id ? "700" : "600",
                        color: activeTab === tab.id ? "#FFFFFF" : "#475569",
                        fontSize: 14,
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
          componentsLoaded &&
          OverviewTab &&
          WeeklyTab &&
          DailyTab &&
          RawDataTab &&
          moods.length > 0 ? (
            <PagerView
              ref={pagerRef}
              style={{ flex: 1 }}
              initialPage={getCurrentTabIndex()}
              onPageSelected={handlePageSelected}
              onPageScroll={handlePageScroll}
              scrollEnabled={true}
              overScrollMode="never"
              overdrag={false}
              orientation="horizontal"
              pageMargin={0}
              keyboardDismissMode="on-drag"
            >
              <View key="overview" style={{ flex: 1 }} collapsable={false}>
                {dataLoaded && OverviewTab ? (
                  <OverviewTab moods={moods} onRefresh={onRefresh} />
                ) : (
                  <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="text-gray-500 mt-4">
                      {!dataLoaded
                        ? "Loading chart data..."
                        : "Loading components..."}
                    </Text>
                  </View>
                )}
              </View>
              <View key="weekly" style={{ flex: 1 }} collapsable={false}>
                {dataLoaded && WeeklyTab ? (
                  <WeeklyTab moods={moods} onRefresh={onRefresh} />
                ) : (
                  <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="text-gray-500 mt-4">
                      {!dataLoaded
                        ? "Loading chart data..."
                        : "Loading components..."}
                    </Text>
                  </View>
                )}
              </View>
              <View key="daily" style={{ flex: 1 }} collapsable={false}>
                {dataLoaded && DailyTab ? (
                  <DailyTab moods={moods} onRefresh={onRefresh} />
                ) : (
                  <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="text-gray-500 mt-4">
                      {!dataLoaded
                        ? "Loading chart data..."
                        : "Loading components..."}
                    </Text>
                  </View>
                )}
              </View>
              <View key="raw" style={{ flex: 1 }} collapsable={false}>
                {dataLoaded && RawDataTab ? (
                  <RawDataTab moods={moods} onRefresh={onRefresh} />
                ) : (
                  <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="text-gray-500 mt-4">
                      {!dataLoaded
                        ? "Loading chart data..."
                        : "Loading components..."}
                    </Text>
                  </View>
                )}
              </View>
            </PagerView>
          ) : (
            <View className="flex-1 justify-center items-center p-8 mt-20">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-500 text-center text-lg font-semibold mt-4">
                Loading chart components...
              </Text>
            </View>
          )
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
