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
  updateMoodTimestamp,
  getCachedMoods,
  isMoodsCacheWarm,
} from "@db/db";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { NoteModal } from "@/components/NoteModal";
import { DateTimePickerModal } from "@/components/DateTimePickerModal";
import { MoodButtonsDetailed } from "@/components/MoodButtonsDetailed";
import { MoodButtonsCompact } from "@/components/MoodButtonsCompact";
import { SwipeDirection } from "@/types/mood";
import { MoodEntry } from "@db/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import ToastManager, { Toast } from "toastify-react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { HapticTab } from "@/components/HapticTab";

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
    <View className="flex-row items-center bg-blue-600 rounded-2xl px-4 py-3 shadow-lg m-3">
      <View className="flex-1 flex-row items-center" style={{ minHeight: 48 }}>
        <View className="flex-1 ml-3">
          <Text className="text-white font-bold text-base">{text1}</Text>
          {text2 ? (
            <Text className="text-white/90 text-xs">{text2}</Text>
          ) : null}
        </View>
        <HapticTab onPress={onPress}>
          <Text
            className="text-blue-600 font-semibold text-sm px-2 py-1 bg-white rounded-lg ml-2"
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
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodEntry | null>(null);

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

  const refreshMoods = useCallback(async () => {
    try {
      const data = await getAllMoods();
      setMoods(data);
      if (data.length > 0) {
        setLastTracked(new Date(data[0].timestamp));
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshMoods();
  }, [refreshMoods]);

  useEffect(() => {
    // Hydrate from cache instantly if available, then revalidate
    if (isMoodsCacheWarm()) {
      const cached = getCachedMoods();
      if (cached && cached.length > 0) {
        setMoods(cached);
        setLastTracked(new Date(cached[0].timestamp));
        setLoading(false);
        // Soft refresh
        refreshMoods();
        return;
      }
    }
    fetchMoods();
  }, [fetchMoods, refreshMoods]);

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
      if (direction === "left") {
        handleDeleteMood(mood);
      } else if (direction === "right") {
        setSelectedMoodId(mood.id);
        setNoteText(mood.note || "");
        setModalVisible(true);
      }
    },
    [handleDeleteMood]
  );

  const handleMoodItemLongPress = useCallback((mood: MoodEntry) => {
    setSelectedMood(mood);
    setShowDateModal(true);
  }, []);

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number) => {
      await updateMoodTimestamp(moodId, newTimestamp);
      await fetchMoods(); // Refresh the moods list
      setShowDateModal(false);
    },
    [fetchMoods]
  );

  const renderMoodItem = useCallback(
    ({ item }: { item: MoodEntry }) => (
      <DisplayMoodItem
        mood={item}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onLongPress={handleMoodItemLongPress}
        swipeThreshold={SWIPE_THRESHOLD}
      />
    ),
    [onSwipeableWillOpen, handleMoodItemLongPress]
  );

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
        {/* Use solid backgrounds (NativeWind gradients are not supported on native) */}
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
          <View className="flex-1 p-4 space-y-4">
            <View>
              <Text className="text-3xl font-extrabold text-center mb-1 text-sky-600 dark:text-sky-400">
                Moodinator
              </Text>
              <Text className="text-center text-xs text-slate-500 dark:text-slate-400 mb-2">
                Track. Reflect. Improve.
              </Text>
              <View className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-4 mb-2 border border-slate-100 dark:border-slate-800">
                {lastTracked && (
                  <Text className="text-xs text-gray-400 dark:text-slate-500 text-center mb-2">
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

            <View className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-lg overflow-hidden border border-slate-100 dark:border-slate-800">
              <View className="flex-1 flex flex-col">
                <View className="p-4 flex-row justify-between items-center">
                  <Text className="font-bold text-xl text-blue-800 dark:text-blue-200">
                    Mood History {moods.length > 0 ? `(${moods.length})` : ""}
                  </Text>
                </View>
                {loading ? (
                  <Text className="text-center py-4 text-gray-500 dark:text-slate-400">
                    Loading...
                  </Text>
                ) : moods.length === 0 ? (
                  <View className="flex-1 items-center justify-center p-8">
                    <Text className="text-6xl mb-2">📝</Text>
                    <Text className="text-center text-slate-500 dark:text-slate-400">
                      No moods tracked yet.
                    </Text>
                    <Text className="text-center text-slate-400 dark:text-slate-500 mt-1">
                      Tap a mood above to get started.
                    </Text>
                  </View>
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
      {showDateModal && (
        <DateTimePickerModal
          visible={showDateModal}
          mood={selectedMood}
          onClose={() => setShowDateModal(false)}
          onSave={handleDateTimeSave}
        />
      )}
      <ToastManager config={toastConfig} useModal={false} />
    </>
  );
}
