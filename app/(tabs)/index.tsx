import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Modal,
  TextInput,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  FadeInRight,
  FadeInLeft,
  SlideOutRight,
  SlideOutLeft,
  runOnJS,
} from "react-native-reanimated";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  insertMood,
  getAllMoods,
  deleteMood,
  updateMoodNote,
} from "../../db/db";
import type { MoodEntry } from "../../db/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Mood scale with color and label
const moodScale = [
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

const screenHeight = Dimensions.get("window").height;

function NoteModal({
  visible,
  noteText,
  setNoteText,
  onCancel,
  onSave,
}: {
  visible: boolean;
  noteText: string;
  setNoteText: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-2xl w-[90%] m-4 shadow-xl">
          <Text className="text-xl font-bold mb-4 text-blue-800">
            Add Note {}
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-4 mb-4 text-base"
            multiline
            numberOfLines={4}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Enter your note here..."
            autoFocus
          />
          <View className="flex-row justify-end space-x-3">
            <Pressable
              className="bg-gray-100 px-6 py-3 rounded-xl"
              onPress={onCancel}
            >
              <Text className="text-gray-600 font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              className="bg-blue-500 px-6 py-3 rounded-xl"
              onPress={onSave}
            >
              <Text className="text-white font-medium">Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
    const newMood = await insertMood(mood, note);
    setMoods((prev) => [newMood, ...prev]);
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
    (direction: "left" | "right", mood: MoodEntry) => {
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

  // Render right swipe action for delete
  const renderRightActions = () => (
    <Animated.View
      entering={FadeInRight}
      exiting={SlideOutRight}
      className="flex justify-center items-end h-full"
    >
      <View className="rounded-2xl shadow-lg h-full px-6 justify-center bg-red-50">
        <Text className="text-red-500 font-bold">Delete</Text>
      </View>
    </Animated.View>
  );

  // Render left swipe action for adding note
  const renderLeftActions = () => (
    <Animated.View
      entering={FadeInLeft}
      exiting={SlideOutLeft}
      className="flex justify-center items-start h-full"
    >
      <View className="rounded-2xl shadow-lg h-full px-6 justify-center bg-blue-50">
        <Text className="text-blue-500 font-bold">Add Note</Text>
      </View>
    </Animated.View>
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
                    <Pressable
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
                    </Pressable>
                  ))}
                </View>
                <View className="w-full flex-row justify-between mb-2">
                  {moodScale.slice(4, 8).map((mood) => (
                    <Pressable
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
                    </Pressable>
                  ))}
                </View>
                <View className="w-full flex-row justify-evenly">
                  {moodScale.slice(8).map((mood) => (
                    <Pressable
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
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View className="flex-1 bg-white rounded-2xl shadow-lg p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="font-bold text-xl text-blue-800">
                  Mood History
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
                <ScrollView
                  contentContainerStyle={{
                    paddingBottom: insets.bottom + 24, // Add extra space for tab bar
                  }}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={["#3b82f6"]}
                      tintColor="#3b82f6"
                    />
                  }
                >
                  {moods.map((mood) => (
                    <Swipeable
                      key={mood.id}
                      renderRightActions={renderRightActions}
                      renderLeftActions={renderLeftActions}
                      overshootLeft={false}
                      overshootRight={false}
                      friction={2}
                      shouldCancelWhenOutside={true}
                      rightThreshold={SWIPE_THRESHOLD}
                      leftThreshold={SWIPE_THRESHOLD}
                      onSwipeableOpen={(direction) =>
                        runOnJS(onSwipeableWillOpen)(direction, mood)
                      }
                    >
                      <Animated.View className="p-4 rounded-xl shadow-sm bg-white flex-row justify-between items-center">
                        <View>
                          <Text className="text-lg font-bold text-blue-800">
                            Mood: {mood.mood}
                            {mood.note ? ` • ${mood.note}` : ""}
                          </Text>
                          <Text className="text-xs text-gray-500 mt-1">
                            {new Date(mood.timestamp).toLocaleString()}
                          </Text>
                        </View>
                      </Animated.View>
                    </Swipeable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
      {modalVisible && (
        <View>
          <NoteModal
            visible={modalVisible}
            noteText={noteText}
            setNoteText={setNoteText}
            onCancel={() => setModalVisible(false)}
            onSave={handleAddNote}
          />
        </View>
      )}
    </>
  );
}
