import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  RefreshControl,
  FlatList,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { insertMood, getAllMoods, deleteMood, updateMoodNote } from "@db/db";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/HapticTab";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { NoteModal } from "@/components/NoteModal";
import { SwipeDirection } from "@/types/mood";
import { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";

export default function HomeScreen() {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTracked, setLastTracked] = useState<Date | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedMoodId, setSelectedMoodId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMoodPressed, setCurrentMoodPressed] = useState<number | null>(
    null
  );

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

  const handleMoodPress = async (mood: number) => {
    const newMood = await insertMood(mood);
    setMoods((prev) => [newMood, ...prev]);
  };

  const handleLongPress = (mood: number) => {
    setCurrentMoodPressed(mood);
    setSelectedMoodId(null);
    setNoteText("");
    setModalVisible(true);
  };

  const handleAddNote = async () => {
    if (selectedMoodId !== null) {
      const updatedMood = await updateMoodNote(selectedMoodId, noteText);
      if (updatedMood) {
        setMoods((prev) =>
          prev.map((m) =>
            m.id === updatedMood.id ? { ...m, note: noteText } : m
          )
        );
      }
    }
    if (currentMoodPressed !== null) {
      const newMood = await insertMood(currentMoodPressed, noteText);
      setMoods((prev) => [newMood, ...prev]);
    }
    setCurrentMoodPressed(null);
    setModalVisible(false);
    setNoteText("");
    setSelectedMoodId(null);
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
        setSelectedMoodId(mood.id);
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
      <GestureHandlerRootView>
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
