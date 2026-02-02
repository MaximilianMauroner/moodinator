import React, { useState, useRef } from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, colors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { moodService } from "@/services/moodService";
import { moodScale } from "@/constants/moodScale";
import type { MoodEntry } from "@db/types";

interface SameAsYesterdayButtonProps {
  onCopy: (entry: MoodEntry) => void;
}

// Get readable time ago string
const getTimeAgo = (timestamp: number | null): string => {
  if (!timestamp) return "";

  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const SameAsYesterdayButton: React.FC<SameAsYesterdayButtonProps> = ({
  onCopy,
}) => {
  const { isDark, get } = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [noEntry, setNoEntry] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<MoodEntry | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchLastEntry = async (): Promise<MoodEntry | null> => {
    try {
      return await moodService.getLastEntry();
    } catch {
      return null;
    }
  };

  const handlePress = async () => {
    haptics.light();
    setLoading(true);
    setNoEntry(false);

    try {
      const lastEntry = await fetchLastEntry();

      if (lastEntry) {
        haptics.success();
        onCopy(lastEntry);
      } else {
        setNoEntry(true);
        haptics.warning();
        setTimeout(() => setNoEntry(false), 3000);
      }
    } catch (error) {
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleLongPress = async () => {
    haptics.light();
    setLoading(true);

    try {
      const lastEntry = await fetchLastEntry();

      if (lastEntry) {
        setPreviewEntry(lastEntry);
        setShowPreview(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        setNoEntry(true);
        haptics.warning();
        setTimeout(() => setNoEntry(false), 3000);
      }
    } catch {
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleClosePreview = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowPreview(false);
      setPreviewEntry(null);
    });
  };

  const handleUseEntry = () => {
    if (previewEntry) {
      haptics.success();
      onCopy(previewEntry);
      handleClosePreview();
    }
  };

  const getMoodData = (moodValue: number) => {
    const moodItem = moodScale.find((m) => m.value === moodValue);
    return moodItem || moodScale[5];
  };

  if (noEntry) {
    return (
      <Pressable
        disabled
        className="flex-row items-center px-3 py-2 rounded-xl"
        style={{
          backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light,
          opacity: 0.5,
        }}
      >
        <Ionicons
          name="document-outline"
          size={14}
          color={get("textMuted")}
          style={{ marginRight: 5 }}
        />
        <Text
          className="text-[11px] font-medium"
          style={{ color: get("textMuted") }}
        >
          No previous entry
        </Text>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        disabled={loading}
        className="flex-row items-center px-3.5 py-2.5 rounded-xl"
        style={{
          backgroundColor: isDark ? colors.primaryBg.dark : colors.primaryBg.light,
          borderWidth: 1,
          borderColor: isDark ? "rgba(91, 138, 91, 0.3)" : "rgba(91, 138, 91, 0.2)",
          opacity: loading ? 0.6 : 1,
          shadowColor: colors.primary.light,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.15 : 0.1,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={get("primary")} />
        ) : (
          <>
            <Ionicons
              name="copy-outline"
              size={14}
              color={get("primary")}
              style={{ marginRight: 5 }}
            />
            <Text
              className="text-[11px] font-bold tracking-wide"
              style={{ color: get("primary") }}
            >
              LAST ENTRY
            </Text>
          </>
        )}
      </Pressable>

      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        transparent
        animationType="none"
        onRequestClose={handleClosePreview}
      >
        <Pressable
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={handleClosePreview}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
              width: Dimensions.get("window").width - 48,
              maxWidth: 360,
            }}
          >
            <Pressable
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: get("background"),
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 10,
              }}
              onPress={(e) => e.stopPropagation()}
            >
              {previewEntry && (
                <>
                  {/* Header with mood indicator */}
                  <View
                    className="p-4"
                    style={{
                      backgroundColor: isDark
                        ? getMoodData(previewEntry.mood).bgHexDark
                        : getMoodData(previewEntry.mood).bgHex,
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? "rgba(61, 53, 42, 0.3)" : "rgba(229, 217, 191, 0.5)",
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View
                          className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                          style={{
                            backgroundColor: isDark ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.6)",
                          }}
                        >
                          <Text
                            className="text-2xl font-bold"
                            style={{
                              color: isDark
                                ? getMoodData(previewEntry.mood).textHexDark
                                : getMoodData(previewEntry.mood).textHex,
                            }}
                          >
                            {previewEntry.mood}
                          </Text>
                        </View>
                        <View>
                          <Text
                            className="text-lg font-bold"
                            style={{
                              color: isDark
                                ? getMoodData(previewEntry.mood).textHexDark
                                : getMoodData(previewEntry.mood).textHex,
                            }}
                          >
                            {getMoodData(previewEntry.mood).label}
                          </Text>
                          <Text
                            className="text-xs"
                            style={{
                              color: isDark
                                ? getMoodData(previewEntry.mood).textHexDark
                                : getMoodData(previewEntry.mood).textHex,
                              opacity: 0.7,
                            }}
                          >
                            {getTimeAgo(previewEntry.timestamp)}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={handleClosePreview}
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.5)" }}
                      >
                        <Ionicons
                          name="close"
                          size={18}
                          color={isDark
                            ? getMoodData(previewEntry.mood).textHexDark
                            : getMoodData(previewEntry.mood).textHex
                          }
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* Content */}
                  <ScrollView
                    className="p-4"
                    style={{ maxHeight: 280 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Emotions */}
                    {previewEntry.emotions.length > 0 && (
                      <View className="mb-4">
                        <Text
                          className="text-xs font-semibold mb-2 uppercase tracking-wider"
                          style={{ color: get("textMuted") }}
                        >
                          Emotions
                        </Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {previewEntry.emotions.map((emotion) => (
                            <View
                              key={emotion.name}
                              className="px-2.5 py-1.5 rounded-lg"
                              style={{
                                backgroundColor: emotion.category === "positive"
                                  ? (isDark ? colors.positive.bg.dark : colors.positive.bg.light)
                                  : emotion.category === "negative"
                                    ? (isDark ? colors.negative.bg.dark : colors.negative.bg.light)
                                    : (isDark ? colors.neutral.bg.dark : colors.neutral.bg.light),
                              }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{
                                  color: emotion.category === "positive"
                                    ? (isDark ? colors.positive.text.dark : colors.positive.text.light)
                                    : emotion.category === "negative"
                                      ? (isDark ? colors.negative.text.dark : colors.negative.text.light)
                                      : (isDark ? colors.neutral.text.dark : colors.neutral.text.light),
                                }}
                              >
                                {emotion.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Context Tags */}
                    {previewEntry.contextTags.length > 0 && (
                      <View className="mb-4">
                        <Text
                          className="text-xs font-semibold mb-2 uppercase tracking-wider"
                          style={{ color: get("textMuted") }}
                        >
                          Context
                        </Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {previewEntry.contextTags.map((tag) => (
                            <View
                              key={tag}
                              className="px-2.5 py-1.5 rounded-lg"
                              style={{
                                backgroundColor: isDark ? colors.dusk.bg.dark : colors.dusk.bg.light,
                              }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{ color: isDark ? colors.dusk.text.dark : colors.dusk.text.light }}
                              >
                                {tag}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Energy */}
                    {previewEntry.energy !== null && (
                      <View className="mb-4">
                        <Text
                          className="text-xs font-semibold mb-2 uppercase tracking-wider"
                          style={{ color: get("textMuted") }}
                        >
                          Energy
                        </Text>
                        <View className="flex-row items-center">
                          <Ionicons
                            name="flash"
                            size={14}
                            color={isDark ? colors.sand.text.dark : colors.sand.text.light}
                          />
                          <Text
                            className="text-sm font-semibold ml-1.5"
                            style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
                          >
                            {previewEntry.energy}/10
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Note */}
                    {previewEntry.note && (
                      <View className="mb-2">
                        <Text
                          className="text-xs font-semibold mb-2 uppercase tracking-wider"
                          style={{ color: get("textMuted") }}
                        >
                          Note
                        </Text>
                        <Text
                          className="text-sm"
                          style={{ color: get("text"), lineHeight: 20 }}
                          numberOfLines={4}
                        >
                          {previewEntry.note}
                        </Text>
                      </View>
                    )}

                    {/* Media indicators */}
                    {(previewEntry.photos.length > 0 || previewEntry.voiceMemos.length > 0 || previewEntry.location) && (
                      <View className="flex-row gap-3 pt-2 border-t mt-2" style={{ borderTopColor: get("border") }}>
                        {previewEntry.photos.length > 0 && (
                          <View className="flex-row items-center">
                            <Ionicons name="image" size={12} color={get("textMuted")} />
                            <Text className="text-xs ml-1" style={{ color: get("textMuted") }}>
                              {previewEntry.photos.length}
                            </Text>
                          </View>
                        )}
                        {previewEntry.voiceMemos.length > 0 && (
                          <View className="flex-row items-center">
                            <Ionicons name="mic" size={12} color={get("textMuted")} />
                            <Text className="text-xs ml-1" style={{ color: get("textMuted") }}>
                              {previewEntry.voiceMemos.length}
                            </Text>
                          </View>
                        )}
                        {previewEntry.location && (
                          <View className="flex-row items-center">
                            <Ionicons name="location" size={12} color={get("textMuted")} />
                            <Text className="text-xs ml-1" style={{ color: get("textMuted") }} numberOfLines={1}>
                              {previewEntry.location.name || "Tagged"}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </ScrollView>

                  {/* Footer actions */}
                  <View
                    className="flex-row p-4 gap-3"
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: isDark ? "rgba(61, 53, 42, 0.3)" : "rgba(229, 217, 191, 0.5)",
                    }}
                  >
                    <Pressable
                      onPress={handleClosePreview}
                      className="flex-1 py-3 rounded-xl items-center"
                      style={{
                        backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(61, 53, 42, 0.5)" : "rgba(229, 217, 191, 0.6)",
                      }}
                    >
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: get("textMuted") }}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleUseEntry}
                      className="flex-1 py-3 rounded-xl items-center flex-row justify-center"
                      style={{
                        backgroundColor: get("primary"),
                        shadowColor: isDark ? "#000" : colors.primary.light,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      <Ionicons name="copy" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text className="text-sm font-semibold text-white">
                        Use This
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

export default SameAsYesterdayButton;
