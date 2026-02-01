import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
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
import { useColorScheme } from "@/hooks/useColorScheme";

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

const MemoOverviewTab = React.memo(OverviewTab);
const MemoWeeklyTab = React.memo(WeeklyTab);
const MemoDailyTab = React.memo(DailyTab);
const MemoRawDataTab = React.memo(RawDataTab);

const TabSelector = React.memo(
  ({
    activeTab,
    onTabPress,
    isDark,
  }: {
    activeTab: TabType;
    onTabPress: (id: TabType) => void;
    isDark: boolean;
  }) => {
    return (
      <View
        className="mx-4 mb-4 rounded-2xl p-1.5 flex-row"
        style={{
          backgroundColor: isDark ? "#2A2520" : "#F5F1E8",
          shadowColor: isDark ? "#000" : "#9D8660",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.08,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onTabPress(tab.id)}
              className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl"
              style={isActive ? {
                backgroundColor: isDark ? "#1C1916" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.12,
                shadowRadius: 8,
                elevation: 3,
              } : {}}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={isActive
                  ? (isDark ? "#A8C5A8" : "#5B8A5B")
                  : (isDark ? "#6B5C4A" : "#BDA77D")
                }
                style={{ marginRight: 4 }}
              />
              <Text
                className="text-[10px] font-semibold"
                style={{
                  color: isActive
                    ? (isDark ? "#A8C5A8" : "#5B8A5B")
                    : (isDark ? "#6B5C4A" : "#BDA77D"),
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  },
  (prev, next) =>
    prev.activeTab === next.activeTab &&
    prev.onTabPress === next.onTabPress &&
    prev.isDark === next.isDark
);

export default function ChartsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [moodCount, setMoodCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const pagerRef = useRef<PagerView>(null);
  const tabIndexMap = useMemo(() => {
    const map = new Map<TabType, number>();
    tabs.forEach((tab, index) => map.set(tab.id, index));
    return map;
  }, []);

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

  const handleTabPress = useCallback(
    (tabId: TabType) => {
      if (tabId === activeTab) {
        return;
      }
      const tabIndex = tabIndexMap.get(tabId);
      if (tabIndex === undefined) {
        return;
      }
      if (pagerRef.current) {
        pagerRef.current.setPageWithoutAnimation(tabIndex);
      }
      setActiveTab(tabId);
    },
    [activeTab, tabIndexMap]
  );

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
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
      >
        <View
          className="p-8 rounded-3xl"
          style={{
            backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
            shadowColor: isDark ? "#000" : "#9D8660",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 24,
            elevation: 4,
          }}
        >
          <ActivityIndicator size="large" color={isDark ? "#A8C5A8" : "#5B8A5B"} />
          <Text
            className="mt-4 font-medium text-sm text-center"
            style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
          >
            Loading insights...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
        edges={["top"]}
      >
        {/* Header */}
        <View
          className="px-6 py-5"
          style={{ backgroundColor: isDark ? "#1C1916" : "#FAF8F4" }}
        >
          <View className="flex-row justify-between items-end">
            <View>
              <Text
                className="text-xs font-medium mb-1"
                style={{ color: isDark ? "#A8C5A8" : "#5B8A5B" }}
              >
                Your wellness journey
              </Text>
              <Text
                className="text-2xl font-bold"
                style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
              >
                Insights
              </Text>
              <Text
                className="text-sm mt-0.5"
                style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
              >
                {moodCount} entries tracked
              </Text>
            </View>
            <TouchableOpacity
              onPress={onRefresh}
              className="p-3 rounded-2xl"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.1,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Ionicons
                name="refresh"
                size={18}
                color={isDark ? "#A8C5A8" : "#5B8A5B"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {moodCount > 0 ? (
          <>
            <TabSelector activeTab={activeTab} onTabPress={handleTabPress} isDark={isDark} />
            <PagerView
              ref={pagerRef}
              style={{ flex: 1 }}
              initialPage={0}
              scrollEnabled={true}
              onPageSelected={handlePageSelected}
            >
              <View key="overview" className="flex-1">
                <MemoOverviewTab moods={moods} onRefresh={onRefresh} />
              </View>
              <View key="weekly" className="flex-1">
                <MemoWeeklyTab moods={moods} onRefresh={onRefresh} />
              </View>
              <View key="daily" className="flex-1">
                <MemoDailyTab moods={moods} onRefresh={onRefresh} />
              </View>
              <View key="raw" className="flex-1">
                <MemoRawDataTab moods={moods} onRefresh={onRefresh} />
              </View>
            </PagerView>
          </>
        ) : (
          <View className="flex-1 justify-center items-center p-8">
            <View
              className="p-8 rounded-3xl items-center max-w-xs"
              style={{
                backgroundColor: isDark ? "#231F1B" : "#FDFCFA",
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.3 : 0.1,
                shadowRadius: 24,
                elevation: 4,
              }}
            >
              <View
                className="w-20 h-20 rounded-3xl items-center justify-center mb-5"
                style={{ backgroundColor: isDark ? "#2D3D2D" : "#E8EFE8" }}
              >
                <Text className="text-4xl">📊</Text>
              </View>
              <Text
                className="text-xl font-bold mb-2 text-center"
                style={{ color: isDark ? "#F5F1E8" : "#3D352A" }}
              >
                No Insights Yet
              </Text>
              <Text
                className="text-center text-sm leading-6"
                style={{ color: isDark ? "#BDA77D" : "#9D8660" }}
              >
                Start tracking your moods to discover patterns and understand your emotional well-being better.
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
