import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  RefreshControl,
  FlatList,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  insertMood,
  getAllMoods,
  deleteMood,
  updateMoodNote,
} from "../../db/db";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/HapticTab";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { NoteModal } from "@/components/NoteModal";
import { MoodScale, SwipeDirection } from "@/types/mood";
import { MoodEntry } from "@/db/types";

// Move moodScale to a separate constants file if needed
const moodScale: MoodScale[] = [
  {
    value: 0,
    label: "No bad thoughts (0%)",
    color: "text-emerald-500",
    bg: "bg-emerald-100",
  },
  {
    value: 1,
    label: "10% bad thoughts",
    color: "text-green-500",
    bg: "bg-green-100",
  },
  {
    value: 2,
    label: "20% bad thoughts",
    color: "text-lime-500",
    bg: "bg-lime-100",
  },
  {
    value: 3,
    label: "30% bad thoughts",
    color: "text-yellow-500",
    bg: "bg-yellow-100",
  },
  {
    value: 4,
    label: "40% bad thoughts",
    color: "text-amber-500",
    bg: "bg-amber-100",
  },
  {
    value: 5,
    label: "Average (50% bad thoughts)",
    color: "text-blue-500",
    bg: "bg-blue-100",
  },
  {
    value: 6,
    label: "60% bad thoughts",
    color: "text-indigo-500",
    bg: "bg-indigo-100",
  },
  {
    value: 7,
    label: "70% bad thoughts",
    color: "text-violet-500",
    bg: "bg-violet-100",
  },
  {
    value: 8,
    label: "80% bad thoughts",
    color: "text-purple-500",
    bg: "bg-purple-100",
  },
  {
    value: 9,
    label: "90% bad thoughts",
    color: "text-pink-500",
    bg: "bg-pink-100",
  },
  {
    value: 10,
    label: "Only bad thoughts (100%)",
    color: "text-red-500",
    bg: "bg-red-100",
  },
];

export default function HomeScreen() {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTracked, setLastTracked] = useState<Date | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const SWIPE_THRESHOLD = 100; // pixels to trigger action
  const insets = useSafeAreaInsets();

  const fetchMoods = async () => {
    setLoading(true);
    try {
      const data = await getAllMoods();
      setMoods(data);
      if (data.length > 0) {
        setLastTracked(new Date(data[0].timestamp));
      }
    } finally {
      setLoading(false);
      setRefreshing(false); // <-- ensure refreshing is reset
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMoods();
  }, []);

  useEffect(() => {
    fetchMoods();
  }, []);

  const handleMoodPress = async (mood: number, note?: string) => {
    const tempId = Date.now();
    const tempMood: MoodEntry = {
      id: tempId,
      mood,
      note: note || "",
      timestamp: new Date().toISOString(),
    };
    setMoods((prev) => [tempMood, ...prev]);
    const newMood = await insertMood(mood, note);
    setMoods((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...newMood, note: newMood.note ?? "" } : m
      )
    );
  };

  const handleLongPress = (mood: number) => {
    setSelectedMood(mood);
    setNoteText("");
    setModalVisible(true);
  };

  const handleAddNote = async () => {
    if (selectedMood !== null) {
      const updatedMood = await updateMoodNote(selectedMood, noteText);
      if (updatedMood) {
        setMoods((prev) =>
          prev.map((m) =>
            m.id === updatedMood.id ? { ...m, note: noteText } : m
          )
        );
      }
      setModalVisible(false);
      setNoteText("");
      setSelectedMood(null);
    }
  };

  // Delete mood entry by id
  const handleDeleteMood = async (id: number) => {
    await deleteMood(id);
    setMoods((prev) => prev.filter((m) => m.id !== id));
  };

  const onSwipeableWillOpen = useCallback(
    (direction: SwipeDirection, mood: MoodEntry) => {
      if (direction === "right") {
        handleDeleteMood(mood.id);
      } else if (direction === "left") {
        setSelectedMood(mood.id);
        setNoteText(mood.note || "");
        setModalVisible(true);
      }
    },
    []
  );

  const renderMoodItem = useCallback(
    ({ item }: { item: MoodEntry }) => (
      <DisplayMoodItem
        mood={item}
        onSwipeableWillOpen={onSwipeableWillOpen}
        swipeThreshold={SWIPE_THRESHOLD}
      />
    ),
    [onSwipeableWillOpen]
  );

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
          <View className="flex-1 p-4 space-y-4">
            <Text className="text-3xl font-extrabold text-center mb-2 text-blue-700">
              Moodinator
            </Text>
            <View className="bg-white rounded-2xl shadow-lg p-4 mb-2">
              <Text className="text-xs text-gray-500 text-center mb-2">
                0 = No bad thoughts, 10 = Only bad thoughts
              </Text>
              {lastTracked && (
                <Text className="text-xs text-gray-400 text-center mb-2">
                  Last tracked: {lastTracked.toLocaleTimeString()}
                </Text>
              )}

              <View className="flex-row flex-wrap justify-between mb-2">
                <View className="w-full flex-row justify-between mb-2">
                  {moodScale.slice(0, 4).map((mood) => (
                    <HapticTab
                      key={mood.value}
                      className={`items-center justify-center h-16 rounded-lg shadow-sm ${mood.bg}`}
                      style={{ width: "23%" }}
                      onPress={() => handleMoodPress(mood.value)}
                      onLongPress={() => handleLongPress(mood.value)}
                      delayLongPress={500}
                    >
                      <Text className={`text-lg font-bold ${mood.color}`}>
                        {mood.value}
                      </Text>
                      <Text className={`text-xs font-medium ${mood.color}`}>
                        {mood.value * 10}%
                      </Text>
                    </HapticTab>
                  ))}
                </View>
                <View className="w-full flex-row justify-between mb-2">
                  {moodScale.slice(4, 8).map((mood) => (
                    <HapticTab
                      key={mood.value}
                      className={`items-center justify-center h-16 rounded-lg shadow-sm ${mood.bg}`}
                      style={{ width: "23%" }}
                      onPress={() => handleMoodPress(mood.value)}
                      onLongPress={() => handleLongPress(mood.value)}
                      delayLongPress={500}
                    >
                      <Text className={`text-lg font-bold ${mood.color}`}>
                        {mood.value}
                      </Text>
                      <Text className={`text-xs font-medium ${mood.color}`}>
                        {mood.value * 10}%
                      </Text>
                    </HapticTab>
                  ))}
                </View>
                <View className="w-full flex-row justify-evenly">
                  {moodScale.slice(8).map((mood) => (
                    <HapticTab
                      key={mood.value}
                      className={`items-center justify-center h-16 rounded-lg shadow-sm ${mood.bg}`}
                      style={{ width: "23%" }}
                      onPress={() => handleMoodPress(mood.value)}
                      onLongPress={() => handleLongPress(mood.value)}
                      delayLongPress={500}
                    >
                      <Text className={`text-lg font-bold ${mood.color}`}>
                        {mood.value}
                      </Text>
                      <Text className={`text-xs font-medium ${mood.color}`}>
                        {mood.value * 10}%
                      </Text>
                    </HapticTab>
                  ))}
                </View>
              </View>
            </View>

            <View className="flex-1 bg-white rounded-2xl shadow-lg overflow-hidden">
              <View className="p-4">
                <Text className="font-bold text-xl text-blue-800">
                  Mood History {moods.length > 0 ? `(${moods.length})` : ""}
                </Text>
              </View>
              {loading ? (
                <Text className="text-center py-4 text-gray-500">
                  Loading...
                </Text>
              ) : moods.length === 0 ? (
                <Text className="text-center py-4 text-gray-500">
                  No moods tracked yet.
                </Text>
              ) : (
                <FlatList
                  data={moods}
                  initialNumToRender={10}
                  contentContainerStyle={{
                    padding: 16,
                    paddingBottom: insets.bottom + 24,
                  }}
                  renderItem={renderMoodItem}
                  keyExtractor={(item) => item.id.toString()}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={["#3b82f6"]}
                      tintColor="#3b82f6"
                    />
                  }
                  removeClippedSubviews={true}
                  windowSize={7}
                  maxToRenderPerBatch={10}
                  updateCellsBatchingPeriod={50}
                  extraData={moods}
                />
              )}
            </View>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
      {modalVisible && (
        <NoteModal
          visible={modalVisible}
          noteText={noteText}
          setNoteText={setNoteText}
          onCancel={() => setModalVisible(false)}
          onSave={handleAddNote}
        />
      )}
    </>
  );
}
