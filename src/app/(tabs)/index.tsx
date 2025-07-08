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

// Header Component
const HeaderSection = ({ totalEntries }: { totalEntries: number }) => (
  <View className="pt-4 pb-2 flex flex-row justify-center items-center px-4">
    <Text className="text-3xl font-extrabold text-center text-sky-400">
      Moodinator
    </Text>
    {totalEntries > 0 && (
      <View className="justify-center">
        <Text className="font-semibold pl-2 text-purple-600">
          ({totalEntries})
        </Text>
      </View>
    )}
  </View>
);

// Quick Stats Component
const QuickStatsSection = ({ moods }: { moods: MoodEntry[] }) => {
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

    // Last 30 days for trend analysis
    const last30Days = moods.filter((mood) => {
      const moodDate = new Date(mood.timestamp);
      const daysDiff =
        (today.getTime() - moodDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 30;
    });

    // Last 7 days for weekly pattern
    const last7Days = moods.filter((mood) => {
      const moodDate = new Date(mood.timestamp);
      const daysDiff =
        (today.getTime() - moodDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 7;
    });

    // Calculate Mood Stability (consistency indicator)
    let stabilityScore = 0;
    let stabilityLabel = "Not enough data";
    let stabilityIcon = "📊";
    let stabilityColor = "text-gray-500";

    if (last7Days.length >= 5) {
      const moodValues = last7Days.map((m) => m.mood);
      const mean = moodValues.reduce((a, b) => a + b, 0) / moodValues.length;
      const variance =
        moodValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        moodValues.length;
      const standardDeviation = Math.sqrt(variance);

      // Convert to 0-100 stability score (lower deviation = higher stability)
      stabilityScore = Math.max(0, Math.min(100, 100 - standardDeviation * 20));

      if (stabilityScore >= 80) {
        stabilityLabel = "Very Stable";
        stabilityIcon = "🎯";
        stabilityColor = "text-green-600";
      } else if (stabilityScore >= 60) {
        stabilityLabel = "Stable";
        stabilityIcon = "✅";
        stabilityColor = "text-emerald-600";
      } else if (stabilityScore >= 40) {
        stabilityLabel = "Moderate";
        stabilityIcon = "📈";
        stabilityColor = "text-yellow-600";
      } else if (stabilityScore >= 20) {
        stabilityLabel = "Variable";
        stabilityIcon = "📊";
        stabilityColor = "text-orange-600";
      } else {
        stabilityLabel = "High Variance";
        stabilityIcon = "⚡";
        stabilityColor = "text-red-600";
      }
    }

    // Calculate Resilience Score (weighted by distance from neutral point)
    let resilienceScore = 50; // Start at neutral (50%)
    let resilienceLabel = "Building Strength";
    let resilienceIcon = "💪";
    let resilienceColor = "text-gray-600";

    if (last30Days.length >= 5) {
      // Calculate weighted scores based on distance from 5 (neutral point)
      let totalWeightedScore = 0;
      let totalWeight = 0;

      last30Days.forEach((mood) => {
        const distanceFrom5 = Math.abs(mood.mood - 5);
        const weight = distanceFrom5 + 1; // Weight by distance (closer to 5 = less weight)

        if (mood.mood < 5) {
          // Good mood: positive contribution
          totalWeightedScore += (5 - mood.mood) * weight;
        } else if (mood.mood > 5) {
          // Challenging mood: negative contribution
          totalWeightedScore -= (mood.mood - 5) * weight;
        }
        // mood.mood === 5 contributes 0 (neutral)

        totalWeight += weight;
      });

      // Convert to 0-100 scale with 50 as neutral
      if (totalWeight > 0) {
        const normalizedScore = totalWeightedScore / totalWeight;
        // Map the score to 0-100 range where 50 is neutral
        resilienceScore = Math.max(0, Math.min(100, 50 + normalizedScore * 10));
      }

      // Recent performance bonus/penalty (last 7 days)
      if (last7Days.length >= 3) {
        const recentGoodDays = last7Days.filter((m) => m.mood < 5).length;
        const recentBadDays = last7Days.filter((m) => m.mood > 5).length;
        const recentBonus = (recentGoodDays - recentBadDays) * 2;
        resilienceScore = Math.max(
          0,
          Math.min(100, resilienceScore + recentBonus)
        );
      }

      resilienceScore = Math.round(resilienceScore);

      if (resilienceScore >= 75) {
        resilienceLabel = "Exceptional";
        resilienceIcon = "🌟";
        resilienceColor = "text-purple-600";
      } else if (resilienceScore >= 65) {
        resilienceLabel = "Strong";
        resilienceIcon = "💎";
        resilienceColor = "text-green-600";
      } else if (resilienceScore >= 55) {
        resilienceLabel = "Resilient";
        resilienceIcon = "🛡️";
        resilienceColor = "text-blue-600";
      } else if (resilienceScore >= 45) {
        resilienceLabel = "Steady";
        resilienceIcon = "⚖️";
        resilienceColor = "text-gray-600";
      } else if (resilienceScore >= 35) {
        resilienceLabel = "Challenged";
        resilienceIcon = "⚡";
        resilienceColor = "text-orange-600";
      } else {
        resilienceLabel = "Vulnerable";
        resilienceIcon = "🤗";
        resilienceColor = "text-red-600";
      }
    }

    // Calculate self-awareness score based on notes
    const recentWithNotes = last7Days.filter(
      (m: MoodEntry) => m.note && m.note.trim().length > 0
    );
    const selfAwarenessPercent =
      last7Days.length > 0
        ? Math.round((recentWithNotes.length / last7Days.length) * 100)
        : 0;

    return {
      todayCount: todayMoods.length,
      totalEntries: moods.length,
      withNotes: moods.filter((m) => m.note && m.note.trim().length > 0).length,
      // Meaningful insights
      stability: {
        score: Math.round(stabilityScore),
        label: stabilityLabel,
        icon: stabilityIcon,
        color: stabilityColor,
      },
      resilience: {
        score: resilienceScore,
        label: resilienceLabel,
        icon: resilienceIcon,
        color: resilienceColor,
      },
      selfAwareness: selfAwarenessPercent,
    };
  }, [moods]);

  if (!quickStats) return null;

  return (
    <View className="mx-4 mb-6">
      <View className="flex-row">
        {/* Mood Stability Card */}
        <View className="flex-1 bg-white p-4 rounded-xl mr-2 shadow-sm">
          <View className="flex-row items-center mb-2">
            <Text className="text-lg mr-2">{quickStats.stability.icon}</Text>
            <Text className="text-sm font-semibold text-gray-700">
              Emotional Stability
            </Text>
          </View>
          <Text className={`text-2xl font-bold ${quickStats.stability.color}`}>
            {quickStats.stability.score}%
          </Text>
          <Text
            className={`text-sm font-medium ${quickStats.stability.color} mt-1`}
          >
            {quickStats.stability.label}
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            Last 7 days consistency
          </Text>
        </View>

        {/* Resilience Score Card */}
        <View className="flex-1 bg-white p-4 rounded-xl ml-2 shadow-sm">
          <View className="flex-row items-center mb-2">
            <Text className="text-lg mr-2">{quickStats.resilience.icon}</Text>
            <Text className="text-sm font-semibold text-gray-700">
              Resilience Score
            </Text>
          </View>
          <Text className={`text-2xl font-bold ${quickStats.resilience.color}`}>
            {quickStats.resilience.score}%
          </Text>
          <Text
            className={`text-sm font-medium ${quickStats.resilience.color} mt-1`}
          >
            {quickStats.resilience.label}
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            Good mental state frequency
          </Text>
          <Text className="text-xs text-gray-400">
            ({quickStats.withNotes} entries with notes)
          </Text>
        </View>
      </View>
    </View>
  );
};

// Mood Input Component
const MoodInputSection = ({
  lastTracked,
  onMoodPress,
  onLongPress,
}: {
  lastTracked: Date | null;
  onMoodPress: (mood: number) => void;
  onLongPress: (mood: number) => void;
}) => {
  const [showDetailedLabels, setShowDetailedLabels] = useState(false);

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

  const toggleLabelsView = useCallback(async () => {
    const newValue = !showDetailedLabels;
    setShowDetailedLabels(newValue);
    try {
      await AsyncStorage.setItem(SHOW_LABELS_KEY, newValue.toString());
    } catch (error) {
      console.error("Failed to save label preference:", error);
    }
  }, [showDetailedLabels]);

  useEffect(() => {
    loadShowLabelsPreference();
  }, [loadShowLabelsPreference]);

  useFocusEffect(
    useCallback(() => {
      loadShowLabelsPreference();
    }, [loadShowLabelsPreference])
  );

  return (
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
            onMoodPress={onMoodPress}
            onLongPress={onLongPress}
          />
        ) : (
          <MoodButtonsCompact
            onMoodPress={onMoodPress}
            onLongPress={onLongPress}
          />
        )}

        <Text className="text-xs text-gray-400 text-center mt-4">
          💡 Tip: Long press any mood to add a note
        </Text>
      </View>
    </View>
  );
};

// Mood History Component
const MoodHistorySection = ({
  loading,
  moods,
  onDeleteMood,
  onEditMood,
}: {
  loading: boolean;
  moods: MoodEntry[];
  onDeleteMood: (mood: MoodEntry) => void;
  onEditMood: (mood: MoodEntry) => void;
}) => {
  const SWIPE_THRESHOLD = 100;

  const quickStats = useMemo(() => {
    const withNotes = moods.filter((m) => m.note && m.note.trim().length > 0);
    return {
      withNotes: withNotes.length,
    };
  }, [moods]);

  const onSwipeableWillOpen = useCallback(
    (direction: SwipeDirection, mood: MoodEntry) => {
      if (direction === "right") {
        onDeleteMood(mood);
      } else if (direction === "left") {
        onEditMood(mood);
      }
    },
    [onDeleteMood, onEditMood]
  );

  const handleMoodItemLongPress = useCallback(
    (mood: MoodEntry) => {
      onEditMood(mood);
    },
    [onEditMood]
  );

  return (
    <View className="mx-4 mb-6">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-xl font-bold text-gray-800">
          📝 Recent Activity
        </Text>
        {quickStats.withNotes > 0 && (
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
              {moods.length} total entries • Swipe left to edit, right to delete
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// Modal Manager Component
const ModalManager = ({
  fetchMoods,
  onMoodAdded,
}: {
  fetchMoods: () => Promise<void>;
  onMoodAdded: (mood: MoodEntry) => void;
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedMoodId, setSelectedMoodId] = useState<number | null>(null);
  const [currentMoodPressed, setCurrentMoodPressed] = useState<number | null>(
    null
  );
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodEntry | null>(null);

  const handleLongPress = useCallback((mood: number) => {
    setCurrentMoodPressed(mood);
    setSelectedMoodId(null);
    setSelectedMood({
      id: -1,
      mood: mood,
      timestamp: new Date().toISOString(),
      note: null,
    });
    setNoteText("");
    setModalVisible(true);
  }, []);

  const handleEditMood = useCallback((mood: MoodEntry) => {
    setSelectedMoodId(mood.id);
    setSelectedMood(mood);
    setNoteText(mood.note || "");
    setCurrentMoodPressed(null);
    setShowDateModal(false);
    setModalVisible(true);
  }, []);

  const handleAddNote = useCallback(async () => {
    try {
      if (selectedMoodId !== null) {
        const updatedMood = await updateMoodNote(selectedMoodId, noteText);
        if (updatedMood) {
          await fetchMoods();
        }
      } else if (currentMoodPressed !== null) {
        const newMood = await insertMood(currentMoodPressed, noteText);
        onMoodAdded(newMood);
      }
    } catch (error) {
      console.error("Error saving note:", error);
    }

    handleCloseModal();
  }, [selectedMoodId, noteText, currentMoodPressed, fetchMoods, onMoodAdded]);

  const handleDateTimeSave = useCallback(
    async (moodId: number, newTimestamp: number) => {
      try {
        await updateMoodTimestamp(moodId, newTimestamp);
        await fetchMoods();
        setShowDateModal(false);
      } catch (error) {
        console.error("Error updating timestamp:", error);
      }
    },
    [fetchMoods]
  );

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setShowDateModal(false);
    setCurrentMoodPressed(null);
    setSelectedMoodId(null);
    setSelectedMood(null);
    setNoteText("");
  }, []);

  return {
    modalVisible: modalVisible || showDateModal,
    selectedMood,
    noteText,
    setNoteText,
    handleCloseModal,
    handleAddNote,
    handleDateTimeSave,
    handleLongPress,
    handleEditMood,
    ModalComponent: (modalVisible || showDateModal) && (
      <EditMoodModal
        visible={modalVisible || showDateModal}
        mood={selectedMood}
        noteText={noteText}
        setNoteText={setNoteText}
        onClose={handleCloseModal}
        onSaveNote={handleAddNote}
        onSaveTime={handleDateTimeSave}
      />
    ),
  };
};

// Toast Configuration Component
const ToastProvider = () => {
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
  };

  return (
    <ToastManager config={toastConfig} style={{ pointerEvents: "box-none" }} />
  );
};

export default function HomeScreen() {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastTracked, setLastTracked] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      setRefreshing(false);
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

  const handleMoodAdded = useCallback((newMood: MoodEntry) => {
    setMoods((prev) => [newMood, ...prev]);
    setLastTracked(new Date());
  }, []);

  const modalManager = ModalManager({
    fetchMoods,
    onMoodAdded: handleMoodAdded,
  });

  const totalEntries = moods.length;

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          className="flex-1 bg-gradient-to-b from-blue-50 to-white"
          style={{ paddingTop: 0 }}
        >
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentInsetAdjustmentBehavior="automatic"
          >
            <HeaderSection totalEntries={totalEntries} />
            <QuickStatsSection moods={moods} />
            <MoodInputSection
              lastTracked={lastTracked}
              onMoodPress={handleMoodPress}
              onLongPress={modalManager.handleLongPress}
            />
            <MoodHistorySection
              loading={loading}
              moods={moods}
              onDeleteMood={handleDeleteMood}
              onEditMood={modalManager.handleEditMood}
            />

            <View className="pb-20" />
          </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>

      {modalManager.ModalComponent}

      <ToastProvider />
    </>
  );
}
