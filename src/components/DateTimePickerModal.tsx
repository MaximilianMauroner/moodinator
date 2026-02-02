import React, { useState, useMemo } from "react";
import { View, Text, Modal, Pressable, Platform, ScrollView } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { MoodEntry } from "@db/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { moodScale } from "@/constants/moodScale";
import { useThemeColors, colors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

interface Props {
  visible: boolean;
  mood: MoodEntry | null;
  onClose: () => void;
  onSave: (moodId: number, newTimestamp: number) => void;
}

export const DateTimePickerModal: React.FC<Props> = ({
  visible,
  mood,
  onClose,
  onSave,
}) => {
  const { isDark, get, getCategoryColors } = useThemeColors();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  React.useEffect(() => {
    if (mood) {
      setSelectedDate(new Date(mood.timestamp));
    }
  }, [mood]);

  const moodData = useMemo(() => {
    if (!mood) return null;
    const moodInfo = moodScale.find((m) => m.value === mood.mood);
    return {
      color: moodInfo?.color ?? "text-sand-600",
      textHex: isDark
        ? (moodInfo?.textHexDark ?? "#D4C4A0")
        : (moodInfo?.textHex ?? "#9D8660"),
      label: moodInfo?.label ?? `Mood ${mood.mood}`,
      bgHex: isDark
        ? (moodInfo?.bgHexDark ?? "#302A22")
        : (moodInfo?.bgHex ?? "#F9F5ED"),
    };
  }, [mood, isDark]);

  const sortedEmotions = useMemo(() => {
    return mood?.emotions
      ? [...mood.emotions].sort((a, b) => a.name.localeCompare(b.name))
      : [];
  }, [mood?.emotions]);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (time) {
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(time.getHours());
      newDateTime.setMinutes(time.getMinutes());
      setSelectedDate(newDateTime);
    }
  };

  const handleSave = () => {
    haptics.light();
    if (mood) {
      onSave(mood.id, selectedDate.getTime());
    }
    onClose();
  };

  const handleCancel = () => {
    haptics.light();
    onClose();
  };

  if (!visible || !mood || !moodData) return null;

  const hasChanged = selectedDate.getTime() !== mood.timestamp;
  const photoCount = mood.photos?.length ?? 0;
  const voiceMemoCount = mood.voiceMemos?.length ?? 0;

  return (
    <SafeAreaView>
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View
          className="flex-1 justify-center items-center px-4"
          style={{ backgroundColor: colors.overlay }}
        >
          <View
            className="rounded-3xl w-full max-w-sm overflow-hidden"
            style={{
              backgroundColor: get("surface"),
              shadowColor: isDark ? "#000" : colors.sand.text.light,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.4 : 0.15,
              shadowRadius: 24,
              elevation: 10,
            }}
          >
            {/* Header with mood accent */}
            <View
              className="px-5 pt-5 pb-4"
              style={{ backgroundColor: moodData.bgHex }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className="text-lg font-bold"
                  style={{ color: get("text") }}
                >
                  Entry Details
                </Text>
                <Pressable
                  onPress={handleCancel}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={get("textMuted")}
                  />
                </Pressable>
              </View>

              {/* Mood pill */}
              <View className="flex-row items-center">
                <View
                  className="flex-row items-center px-4 py-2 rounded-xl mr-3"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(0,0,0,0.2)"
                      : "rgba(255,255,255,0.7)",
                  }}
                >
                  <Text
                    className="text-2xl font-bold mr-2"
                    style={{ color: moodData.textHex, fontVariant: ["tabular-nums"] }}
                  >
                    {mood.mood}
                  </Text>
                  <Text
                    className="text-base font-semibold"
                    style={{ color: moodData.textHex }}
                  >
                    {moodData.label}
                  </Text>
                </View>

                {/* Energy badge */}
                {typeof mood.energy === "number" && (
                  <View
                    className="px-3 py-2 rounded-xl"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(0,0,0,0.2)"
                        : "rgba(255,255,255,0.7)",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
                    >
                      Energy {mood.energy}/10
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <ScrollView
              className="px-5"
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Note */}
              {mood.note && (
                <View className="mt-4">
                  <View
                    className="rounded-xl p-3"
                    style={{ backgroundColor: get("surfaceAlt") }}
                  >
                    <Text
                      className="text-sm leading-5"
                      style={{ color: get("textSubtle") }}
                    >
                      {mood.note}
                    </Text>
                  </View>
                </View>
              )}

              {/* Emotions */}
              {sortedEmotions.length > 0 && (
                <View className="mt-4">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="heart"
                      size={14}
                      color={get("textMuted")}
                    />
                    <Text
                      className="text-xs font-medium ml-1.5"
                      style={{ color: get("textMuted") }}
                    >
                      Emotions
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {sortedEmotions.map((emotion) => {
                      const catColors = getCategoryColors(emotion.category);
                      return (
                        <View
                          key={emotion.name}
                          className="px-2.5 py-1.5 rounded-lg"
                          style={{ backgroundColor: catColors.bg }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{ color: catColors.text }}
                          >
                            {emotion.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Context Tags */}
              {(mood.contextTags?.length ?? 0) > 0 && (
                <View className="mt-4">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="pricetag"
                      size={14}
                      color={get("textMuted")}
                    />
                    <Text
                      className="text-xs font-medium ml-1.5"
                      style={{ color: get("textMuted") }}
                    >
                      Context
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {mood.contextTags?.map((ctx) => {
                      const ctxColors = getCategoryColors("neutral");
                      return (
                        <View
                          key={ctx}
                          className="px-2.5 py-1.5 rounded-lg"
                          style={{ backgroundColor: ctxColors.bg }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{ color: ctxColors.text }}
                          >
                            #{ctx}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Location */}
              {mood.location && (
                <View className="mt-4">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="location"
                      size={14}
                      color={get("textMuted")}
                    />
                    <Text
                      className="text-xs font-medium ml-1.5"
                      style={{ color: get("textMuted") }}
                    >
                      Location
                    </Text>
                  </View>
                  <View
                    className="flex-row items-center p-3 rounded-xl"
                    style={{ backgroundColor: get("surfaceAlt") }}
                  >
                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                      style={{
                        backgroundColor: isDark
                          ? colors.positive.bg.dark
                          : colors.positive.bg.light,
                      }}
                    >
                      <Ionicons
                        name="navigate"
                        size={16}
                        color={isDark ? colors.positive.text.dark : colors.positive.text.light}
                      />
                    </View>
                    <View className="flex-1">
                      {mood.location.name ? (
                        <>
                          <Text
                            className="text-sm font-semibold"
                            style={{ color: get("text") }}
                            numberOfLines={1}
                          >
                            {mood.location.name}
                          </Text>
                          <Text
                            className="text-[10px]"
                            style={{ color: get("textMuted") }}
                          >
                            {mood.location.latitude.toFixed(4)}, {mood.location.longitude.toFixed(4)}
                          </Text>
                        </>
                      ) : (
                        <Text
                          className="text-sm font-medium"
                          style={{ color: get("text") }}
                        >
                          {mood.location.latitude.toFixed(4)}, {mood.location.longitude.toFixed(4)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Media attachments */}
              {(photoCount > 0 || voiceMemoCount > 0) && (
                <View className="mt-4">
                  <View className="flex-row items-center mb-2">
                    <Ionicons
                      name="attach"
                      size={14}
                      color={get("textMuted")}
                    />
                    <Text
                      className="text-xs font-medium ml-1.5"
                      style={{ color: get("textMuted") }}
                    >
                      Attachments
                    </Text>
                  </View>
                  <View className="flex-row gap-3">
                    {photoCount > 0 && (
                      <View
                        className="flex-row items-center px-3 py-2 rounded-xl"
                        style={{ backgroundColor: get("surfaceAlt") }}
                      >
                        <Ionicons
                          name="images"
                          size={16}
                          color={isDark ? colors.sand.text.dark : colors.sand.text.light}
                        />
                        <Text
                          className="text-xs font-medium ml-2"
                          style={{ color: get("textSubtle") }}
                        >
                          {photoCount} photo{photoCount !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                    {voiceMemoCount > 0 && (
                      <View
                        className="flex-row items-center px-3 py-2 rounded-xl"
                        style={{ backgroundColor: get("surfaceAlt") }}
                      >
                        <Ionicons
                          name="mic"
                          size={16}
                          color={isDark ? colors.sand.text.dark : colors.sand.text.light}
                        />
                        <Text
                          className="text-xs font-medium ml-2"
                          style={{ color: get("textSubtle") }}
                        >
                          {voiceMemoCount} voice memo{voiceMemoCount !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Divider */}
              <View
                className="h-px my-5"
                style={{ backgroundColor: get("border") }}
              />

              {/* Date & Time Section */}
              <View className="mb-4">
                <View className="flex-row items-center mb-3">
                  <Ionicons
                    name="calendar"
                    size={14}
                    color={get("textMuted")}
                  />
                  <Text
                    className="text-xs font-medium ml-1.5"
                    style={{ color: get("textMuted") }}
                  >
                    Date & Time
                  </Text>
                  {hasChanged && (
                    <View
                      className="ml-2 px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: isDark ? colors.primary.dark : colors.primaryBg.light }}
                    >
                      <Text
                        className="text-[10px] font-semibold"
                        style={{ color: isDark ? colors.primaryBg.light : colors.primary.light }}
                      >
                        Modified
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row gap-3">
                  {/* Date picker button */}
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    className="flex-1 flex-row items-center p-3 rounded-xl"
                    style={{
                      backgroundColor: get("surfaceAlt"),
                      borderWidth: 1.5,
                      borderColor: get("border"),
                    }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={isDark ? colors.sand.text.dark : colors.sand.text.light}
                    />
                    <Text
                      className="text-sm font-medium ml-2 flex-1"
                      style={{ color: get("text") }}
                    >
                      {selectedDate.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={get("textMuted")}
                    />
                  </Pressable>

                  {/* Time picker button */}
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    className="flex-row items-center p-3 rounded-xl"
                    style={{
                      backgroundColor: get("surfaceAlt"),
                      borderWidth: 1.5,
                      borderColor: get("border"),
                      minWidth: 110,
                    }}
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={isDark ? colors.sand.text.dark : colors.sand.text.light}
                    />
                    <Text
                      className="text-sm font-medium ml-2 flex-1"
                      style={{ color: get("text") }}
                    >
                      {selectedDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={get("textMuted")}
                    />
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            {/* Action buttons */}
            <View
              className="flex-row px-5 py-4 gap-3"
              style={{
                borderTopWidth: 1,
                borderTopColor: get("borderSubtle"),
              }}
            >
              <Pressable
                onPress={handleCancel}
                className="flex-1 py-3.5 rounded-xl items-center"
                style={{ backgroundColor: get("surfaceAlt") }}
              >
                <Text
                  className="font-semibold text-sm"
                  style={{ color: get("textSubtle") }}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={!hasChanged}
                className="flex-1 py-3.5 rounded-xl items-center"
                style={{
                  backgroundColor: hasChanged
                    ? (isDark ? colors.primary.dark : colors.primary.light)
                    : get("surfaceAlt"),
                  opacity: hasChanged ? 1 : 0.5,
                }}
              >
                <Text
                  className="font-semibold text-sm"
                  style={{
                    color: hasChanged ? "#FFFFFF" : get("textMuted"),
                  }}
                >
                  Save Changes
                </Text>
              </Pressable>
            </View>

            {/* Date picker */}
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
              />
            )}

            {/* Time picker */}
            {showTimePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleTimeChange}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
