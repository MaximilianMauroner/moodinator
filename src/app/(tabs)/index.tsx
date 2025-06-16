import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SafeAreaView,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  insertMood,
  getAllMoods,
  deleteMood,
  updateMoodNote,
  insertMoodEntry,
  updateMoodTimestamp,
} from "@db/db";
import { DisplayMoodItem } from "@/components/DisplayMoodItem";
import { EditMoodModal } from "@/components/EditMoodModal";
import { MoodButtonsDetailed } from "@/components/MoodButtonsDetailed";
import { MoodButtonsCompact } from "@/components/MoodButtonsCompact";
import { SwipeDirection } from "@/types/mood";
import { MoodEntry } from "@db/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import ToastManager, { Toast } from "toastify-react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { HapticTab } from "@/components/HapticTab";
import { moodScale } from "@/constants/moodScale";
import { getMoodInterpretation } from "@/components/charts";
import {
  format,
  isToday,
  isYesterday,
  startOfDay,
  endOfDay,
  isWithinInterval,
  subDays,
} from "date-fns";

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
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#10B981",
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        shadowColor: "#10B981",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        marginHorizontal: 16,
        marginVertical: 8,
        borderWidth: 0,
        maxWidth: "94%",
        alignSelf: "center",
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          minHeight: 48,
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: 20,
            padding: 6,
            marginRight: 12,
          }}
        >
          <IconSymbol name="checkmark" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "white",
              fontWeight: "600",
              fontSize: 15,
              letterSpacing: 0.2,
              lineHeight: 18,
            }}
          >
            {text1}
          </Text>
          {text2 ? (
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: 13,
                marginTop: 2,
                fontWeight: "400",
                lineHeight: 16,
              }}
            >
              {text2}
            </Text>
          ) : null}
        </View>
        <HapticTab onPress={onPress} style={{ pointerEvents: "auto" }}>
          <View
            style={{
              backgroundColor: "white",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              marginLeft: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <Text
              style={{
                color: "#10B981",
                fontWeight: "600",
                fontSize: 13,
                letterSpacing: 0.1,
              }}
            >
              Undo
            </Text>
          </View>
        </HapticTab>
      </View>
      <HapticTab onPress={hide} style={{ pointerEvents: "auto" }}>
        <View
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: 16,
            padding: 6,
            marginLeft: 8,
          }}
        >
          <IconSymbol name="xmark" size={14} color="#fff" />
        </View>
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
    // Create a temporary mood entry for the modal to display
    setSelectedMood({
      id: -1, // Temporary ID
      mood: mood,
      timestamp: new Date().toISOString(),
      note: null,
    });
    setNoteText("");
    setModalVisible(true);
  }, []);

  const handleAddNote = useCallback(async () => {
    try {
      if (selectedMoodId !== null) {
        // Editing existing mood note
        const updatedMood = await updateMoodNote(selectedMoodId, noteText);
        if (updatedMood) {
          // Refresh the entire mood list to ensure consistency
          await fetchMoods();
        }
      } else if (currentMoodPressed !== null) {
        // Creating new mood with note
        const newMood = await insertMood(currentMoodPressed, noteText);
        setMoods((prev) => [newMood, ...prev]);
        setLastTracked(new Date());
      }
    } catch (error) {
      console.error("Error saving note:", error);
    }

    // Reset states
    setCurrentMoodPressed(null);
    setSelectedMoodId(null);
    setSelectedMood(null);
    setNoteText("");
  }, [selectedMoodId, noteText, currentMoodPressed, fetchMoods]);

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
        setSelectedMood(mood);
        setNoteText(mood.note || "");
        setCurrentMoodPressed(null); // Clear this for editing existing mood
        setModalVisible(true);
      }
    },
    [handleDeleteMood]
  );

  const handleMoodItemLongPress = useCallback((mood: MoodEntry) => {
    setSelectedMood(mood);
    setSelectedMoodId(mood.id);
    setNoteText(mood.note || "");
    setCurrentMoodPressed(null); // Clear this for editing existing mood
    setShowDateModal(false); // Make sure we're not in date mode
    setModalVisible(true);
  }, []);

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number) => {
      try {
        await updateMoodTimestamp(moodId, newTimestamp);
        await fetchMoods(); // Refresh the moods list to show updated time
        setShowDateModal(false);
      } catch (error) {
        console.error("Error updating timestamp:", error);
      }
    },
    [fetchMoods]
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
    setShowDateModal(false);
    setCurrentMoodPressed(null);
    setSelectedMoodId(null);
    setSelectedMood(null);
    setNoteText("");
  }, []);

  // Calculate quick stats for today and recent activity
  const quickStats = useMemo(() => {
    if (!moods.length) return null;

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Today's moods
    const todayMoods = moods.filter((mood) =>
      isWithinInterval(new Date(mood.timestamp), {
        start: todayStart,
        end: todayEnd,
      })
    );

    // Yesterday's moods
    const yesterday = subDays(today, 1);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEnd = endOfDay(yesterday);
    const yesterdayMoods = moods.filter((mood) =>
      isWithinInterval(new Date(mood.timestamp), {
        start: yesterdayStart,
        end: yesterdayEnd,
      })
    );

    // Recent week average
    const recentWeek = moods.filter((mood) => {
      const moodDate = new Date(mood.timestamp);
      const daysDiff =
        (today.getTime() - moodDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 7;
    });

    const todayAvg =
      todayMoods.length > 0
        ? todayMoods.reduce((sum, mood) => sum + mood.mood, 0) /
          todayMoods.length
        : null;

    const yesterdayAvg =
      yesterdayMoods.length > 0
        ? yesterdayMoods.reduce((sum, mood) => sum + mood.mood, 0) /
          yesterdayMoods.length
        : null;

    const weekAvg =
      recentWeek.length > 0
        ? recentWeek.reduce((sum, mood) => sum + mood.mood, 0) /
          recentWeek.length
        : null;

    return {
      todayCount: todayMoods.length,
      todayAvg,
      yesterdayAvg,
      weekAvg,
      totalEntries: moods.length,
      withNotes: moods.filter((m) => m.note && m.note.trim().length > 0).length,
    };
  }, [moods]);

  const toggleLabelsView = useCallback(() => {
    const newValue = !showDetailedLabels;
    setShowDetailedLabels(newValue);
    AsyncStorage.setItem(SHOW_LABELS_KEY, newValue.toString()).catch(
      console.error
    );
  }, [showDetailedLabels]);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Header */}
            <View className="mt-1 flex flex-row justify-center items-center p-4">
              <Text className="text-3xl font-extrabold text-center text-sky-400">
                Moodinator
              </Text>
              {quickStats && (
                <View className="justify-center">
                  <Text className="font-semibold pl-2 text-purple-600">
                    ({quickStats.totalEntries})
                  </Text>
                </View>
              )}
            </View>

            {/* Quick Stats Cards */}
            {quickStats && (
              <View className="mx-4 mb-6">
                <View className="flex-row">
                  <View className="flex-1 bg-white p-4 rounded-xl mr-2 shadow-sm">
                    <Text className="text-center text-xs text-gray-500 mb-1">
                      Today's Entries
                    </Text>
                    <Text className="text-center text-2xl font-bold text-blue-600">
                      {quickStats.todayCount}
                    </Text>
                    {quickStats.todayAvg && (
                      <Text
                        className={`text-center text-xs ${
                          getMoodInterpretation(quickStats.todayAvg).textClass
                        }`}
                      >
                        Avg: {quickStats.todayAvg.toFixed(1)}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1 bg-white p-4 rounded-xl ml-2 shadow-sm">
                    <Text className="text-center text-xs text-gray-500 mb-1">
                      Week Average
                    </Text>
                    {quickStats.weekAvg ? (
                      <>
                        <Text
                          className={`text-center text-2xl font-bold ${
                            getMoodInterpretation(quickStats.weekAvg).textClass
                          }`}
                        >
                          {quickStats.weekAvg.toFixed(1)}
                        </Text>
                        <Text className="text-center text-xs text-gray-400">
                          {getMoodInterpretation(quickStats.weekAvg).text}
                        </Text>
                      </>
                    ) : (
                      <Text className="text-center text-2xl font-bold text-gray-400">
                        --
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Mood Input Section */}
            <View className="mx-4 mb-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-800">
                  🎯 Track Your Mood
                </Text>
                <TouchableOpacity
                  onPress={toggleLabelsView}
                  className="bg-gray-100 px-3 py-1 rounded-full"
                >
                  <Text className="text-xs text-gray-600">
                    {showDetailedLabels ? "Simple" : "Detailed"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="bg-white rounded-2xl shadow-lg p-6">
                {lastTracked && (
                  <Text className="text-xs text-gray-400 text-center mb-4">
                    Last tracked: {format(lastTracked, "MMM dd 'at' HH:mm")}
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

                <Text className="text-xs text-gray-400 text-center mt-4">
                  💡 Tip: Long press any mood to add a note
                </Text>
              </View>
            </View>

            {/* Mood History Section */}
            <View className="mx-4 mb-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-800">
                  📝 Recent Activity
                </Text>
                {quickStats && quickStats.withNotes > 0 && (
                  <Text className="text-sm text-gray-500">
                    {quickStats.withNotes} with notes
                  </Text>
                )}
              </View>

              {loading ? (
                <View className="bg-white rounded-xl p-8 shadow-sm">
                  <Text className="text-center text-gray-500">Loading...</Text>
                </View>
              ) : moods.length === 0 ? (
                <View className="bg-white rounded-xl p-8 shadow-sm">
                  <Text className="text-center text-6xl mb-4">🎯</Text>
                  <Text className="text-center text-lg font-semibold text-gray-500">
                    Ready to start tracking?
                  </Text>
                  <Text className="text-center text-gray-400 mt-2">
                    Track your first mood above to begin your journey!
                  </Text>
                </View>
              ) : (
                <View className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <ScrollView
                    style={{
                      maxHeight: Math.min(500, moods.length * 80 + 100),
                    }}
                    contentContainerStyle={{ padding: 16 }}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {moods.map((item) => (
                      <DisplayMoodItem
                        key={item.id}
                        mood={item}
                        onSwipeableWillOpen={onSwipeableWillOpen}
                        onLongPress={handleMoodItemLongPress}
                        swipeThreshold={SWIPE_THRESHOLD}
                      />
                    ))}
                  </ScrollView>
                  <View
                    className="border-t border-gray-100 p-2"
                    style={{
                      backgroundColor: "#F9FAFB",
                      borderTopWidth: 1,
                      borderTopColor: "#F3F4F6",
                    }}
                  >
                    <Text className="text-center text-xs text-gray-500">
                      {moods.length} total entries • Swipe left to edit, right
                      to delete
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Bottom padding for scroll */}
            <View className="pb-20" />
          </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
      {(modalVisible || showDateModal) && (
        <EditMoodModal
          visible={modalVisible || showDateModal}
          mood={selectedMood}
          noteText={noteText}
          setNoteText={setNoteText}
          onClose={handleCloseModal}
          onSaveNote={handleAddNote}
          onSaveTime={handleDateTimeSave}
        />
      )}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        }}
        pointerEvents="box-none"
      >
        <ToastManager
          config={toastConfig}
          style={{ pointerEvents: "box-none" }}
        />
      </View>
    </>
  );
}
