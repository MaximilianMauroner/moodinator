import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Dimensions,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { seedMoods, clearMoods, getAllMoods } from "@/db/db";
import type { MoodEntry } from "@/db/types";
import { format, parseISO } from "date-fns";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChartsScreen() {
  const [loading, setLoading] = useState<"seed" | "clear" | null>(null);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [moodCount, setMoodCount] = useState<number>(0);

  const getMoodCount = useCallback(async () => {
    const allMoods = await getAllMoods();
    setMoods(allMoods);
    setMoodCount(allMoods.length);
  }, []);

  useEffect(() => {
    getMoodCount();
  }, [loading, getMoodCount]);
  const handleSeedMoods = useCallback(async () => {
    setLoading("seed");
    try {
      await seedMoods();
    } finally {
      setLoading(null);
    }
  }, []);

  const handleClearMoods = useCallback(async () => {
    setLoading("clear");
    try {
      await clearMoods();
    } finally {
      setLoading(null);
    }
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <View className="mt-1 flex gap-2 flex-row justify-between items-center p-4">
        {__DEV__ && (
          <Pressable
            onPress={handleSeedMoods}
            className="bg-blue-500 px-4 py-2 rounded "
          >
            {loading === "seed" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Seed Moods</Text>
            )}
          </Pressable>
        )}
        <View className="flex flex-row justify-center items-center">
          <Text className="text-3xl font-extrabold text-center mb-2 text-blue-700">
            Chart
          </Text>
          <Text className="font-semibold text-gray-500">({moodCount})</Text>
        </View>
        {__DEV__ && (
          <Pressable
            onPress={handleClearMoods}
            className="bg-red-500 px-4 py-2 rounded"
          >
            {loading === "clear" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Clear Moods</Text>
            )}
          </Pressable>
        )}
      </View>
      {moodCount > 0 && <DisplayMoodChart />}
    </SafeAreaView>
  );
}

const DisplayMoodChart = () => {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMoods = async () => {
      setLoading(true);
      const allMoods = await getAllMoods();
      setMoods(allMoods);
      setLoading(false);
    };
    fetchMoods();
  }, []);

  const chartData = useMemo(() => {
    return {
      labels: moods.map((m) => format(new Date(m.timestamp), "HH d/M")),
      datasets: [
        {
          data: moods.map((m) => m.mood),
          color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, [moods]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!moods.length) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-500">No mood data available.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal={true}
      contentContainerStyle={{ flexGrow: 1 }}
      className="p-4"
    >
      <LineChart
        data={chartData}
        width={Math.max(Dimensions.get("window").width, moods.length * 60)}
        height={220}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#e0e7ff",
          backgroundGradientTo: "#fff",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
          style: { borderRadius: 16 },
          propsForDots: {
            r: "4",
            strokeWidth: "2",
            stroke: "#2563eb",
          },
        }}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </ScrollView>
  );
};
