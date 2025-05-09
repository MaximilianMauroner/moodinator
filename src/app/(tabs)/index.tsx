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
  insertMoodEntry,
} from "@db/db";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { NoteModal } from "@/components/NoteModal";
import { MoodButtonsDetailed } from "@/components/MoodButtonsDetailed";
import { MoodButtonsCompact } from "@/components/MoodButtonsCompact";
import { SwipeDirection } from "@/types/mood";
import { MoodEntry } from "@db/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import ToastManager, { Toast } from "toastify-react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { HapticTab } from "@/components/HapticTab";
import { set } from "date-fns";

const SHOW_LABELS_KEY = "showLabelsPreference";

const toastConfig = {
  success: ({
    text1,
    text2,
    hide,
    onPress,
  }: {
    text1: string;
    text2?: string;
    hide: () => void;
    onPress: () => void;
  }) => (
    <View className="flex-row items-center bg-blue-600 rounded-xl px-4 py-3 shadow-lg m-2">
      <View className="flex-1 flex-row items-center" style={{ minHeight: 48 }}>
        <View className="flex-1 ml-3">
          <Text className="text-white font-bold text-base">{text1}</Text>
          {text2 ? <Text className="text-white text-xs">{text2}</Text> : null}
        </View>
        <HapticTab onPress={onPress}>
          <Text
            className="text-blue-600 font-bold text-sm px-2 py-1 bg-white rounded-lg ml-2"
            accessibilityRole="button"
          >
            Undo
          </Text>
        </HapticTab>
      </View>
      <HapticTab onPress={hide}>
        <IconSymbol
          name="xmark"
          size={20}
          color="#fff"
          style={{ marginLeft: 8 }}
        />
      </HapticTab>
    </View>
  ),
  // Add other toast types if needed
};

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
  const [showDetailedLabels, setShowDetailedLabels] = useState(false);

  const SWIPE_THRESHOLD = 100; // pixels to trigger action

  const fetchMoods = useCallback(async () => {
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
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMoods();
  }, [fetchMoods]);

  useEffect(() => {
    fetchMoods();
  }, [fetchMoods]);

  const handleMoodPress = useCallback(async (mood: number) => {
    const newMood = await insertMood(mood);
    setMoods((prev) => [newMood, ...prev]);
    setLastTracked(new Date());
  }, []);

  const handleLongPress = useCallback((mood: number) => {
    setCurrentMoodPressed(mood);
    setSelectedMoodId(null);
    setNoteText("");
    setModalVisible(true);
  }, []);

  const handleAddNote = useCallback(async () => {
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
  }, [selectedMoodId, noteText, currentMoodPressed]);

  const handleDeleteMood = useCallback(async (mood: MoodEntry) => {
    await deleteMood(mood.id);
    setMoods((prev) => prev.filter((m) => m.id !== mood.id));
    Toast.show({
      type: "success",
      text1: "Mood deleted",
      text2: "You can undo this action",
      autoHide: true,
      visibilityTime: 3000,
      progressBarColor: "#3b82f6",
      onPress: async () => {
        if (mood) {
          const crmood = await insertMoodEntry(mood);

          setMoods((prev) => {
            const updated = [...prev, crmood].sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            );
            return updated;
          });

          setLastTracked((prevLastTracked) => {
            if (
              !prevLastTracked ||
              new Date(crmood.timestamp) > prevLastTracked
            ) {
              return new Date(crmood.timestamp);
            }
            return prevLastTracked;
          });
          Toast.hide();
        } else {
          Toast.error("Failed to restore mood");
        }
      },
    });
  }, []);

  const onSwipeableWillOpen = useCallback(
    (direction: SwipeDirection, mood: MoodEntry) => {
      if (direction === "right") {
        handleDeleteMood(mood);
      } else if (direction === "left") {
        setSelectedMoodId(mood.id);
        setNoteText(mood.note || "");
        setModalVisible(true);
      }
    },
    [handleDeleteMood]
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

  const toggleLabelsPreference = useCallback(async () => {
    const newValue = !showDetailedLabels;
    setShowDetailedLabels(newValue);
    try {
      await AsyncStorage.setItem(SHOW_LABELS_KEY, newValue.toString());
    } catch (error) {
      console.error("Failed to save label preference:", error);
    }
  }, [showDetailedLabels]);

  const loadShowLabelsPreference = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(SHOW_LABELS_KEY);
      if (value !== null) {
        setShowDetailedLabels(value === "true");
      }
    } catch (error) {
      console.error("Failed to load label preference:", error);
    }
  }, []);

  useEffect(() => {
    loadShowLabelsPreference();
  }, [loadShowLabelsPreference]);

  useFocusEffect(
    useCallback(() => {
      loadShowLabelsPreference();
    }, [loadShowLabelsPreference])
  );

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setCurrentMoodPressed(null);
    setSelectedMoodId(null);
  }, []);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
          <View className="flex-1 p-4 space-y-4">
            <View>
              <Text className="text-3xl font-extrabold text-center mb-2 text-blue-700">
                Moodinator
              </Text>
              <View className="bg-white rounded-2xl shadow-lg p-4 mb-2">
                {lastTracked && (
                  <Text className="text-xs text-gray-400 text-center mb-2">
                    Last tracked: {lastTracked.toLocaleTimeString()}
                  </Text>
                )}

                {showDetailedLabels ? (
                  <MoodButtonsDetailed
                    onMoodPress={handleMoodPress}
                    onLongPress={handleLongPress}
                  />
                ) : (
                  <MoodButtonsCompact
                    onMoodPress={handleMoodPress}
                    onLongPress={handleLongPress}
                  />
                )}
              </View>
            </View>

            <View className="flex-1 bg-white rounded-2xl shadow-lg overflow-hidden">
              <View className="flex-1 flex flex-col">
                <View className="p-4 flex-row justify-between items-center">
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
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
      {modalVisible && (
        <NoteModal
          visible={modalVisible}
          noteText={noteText}
          setNoteText={setNoteText}
          onCancel={handleCloseModal}
          onSave={handleAddNote}
        />
      )}
      <ToastManager config={toastConfig} />
    </>
  );
}
