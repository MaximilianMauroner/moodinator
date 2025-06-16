import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MoodEntry } from "@db/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { moodScale } from "@/constants/moodScale";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { format } from "date-fns";

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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  React.useEffect(() => {
    if (mood) {
      setSelectedDate(new Date(mood.timestamp));
    }
  }, [mood]);

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
    if (mood) {
      onSave(mood.id, selectedDate.getTime());
    }
    onClose();
  };

  if (!visible || !mood) return null;

  const screenWidth = Dimensions.get("window").width;
  const modalWidth = Math.min(screenWidth - 32, 380);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/60 justify-center items-center px-4">
        <View
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
          style={{ width: modalWidth }}
        >
          {/* Header */}
          <View className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 pb-4">
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-white text-xl font-bold mb-1">
                  Edit Date & Time
                </Text>
                <Text className="text-blue-100 text-sm">
                  Adjust when this mood was tracked
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="bg-white/20 rounded-full p-2"
              >
                <IconSymbol name="xmark" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <View className="p-6">
            {/* Mood Display */}
            <View className="bg-gray-50 rounded-2xl p-4 mb-6">
              <View className="flex-row items-center">
                <View className="bg-white rounded-full p-3 mr-3 shadow-sm">
                  <Text className="text-2xl font-bold text-blue-600">
                    {mood.mood}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-600 text-sm font-medium">
                    Mood Level
                  </Text>
                  <Text
                    className={`font-semibold ${
                      moodScale[mood.mood]?.color || "text-gray-600"
                    }`}
                  >
                    {moodScale[mood.mood]?.label || `Level ${mood.mood}`}
                  </Text>
                  {mood.note && (
                    <Text
                      className="text-gray-500 text-xs mt-1"
                      numberOfLines={2}
                    >
                      "{mood.note}"
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Date Section */}
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold mb-3 flex-row items-center">
                <IconSymbol name="calendar" size={16} color="#6B7280" /> Date
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 flex-row justify-between items-center"
              >
                <Text className="text-gray-800 font-medium">
                  {format(selectedDate, "EEEE, MMMM dd, yyyy")}
                </Text>
                <IconSymbol name="chevron.right" size={16} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Time Section */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 flex-row items-center">
                <IconSymbol name="clock" size={16} color="#6B7280" /> Time
              </Text>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 flex-row justify-between items-center"
              >
                <Text className="text-gray-800 font-medium">
                  {format(selectedDate, "HH:mm")}
                </Text>
                <IconSymbol name="chevron.right" size={16} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Action Buttons */}
            <View className="flex-row space-x-3">
              <Pressable
                onPress={onClose}
                className="flex-1 bg-gray-100 py-4 rounded-xl border border-gray-200"
              >
                <Text className="text-center font-semibold text-gray-700">
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                className="flex-1 bg-blue-600 py-4 rounded-xl shadow-sm"
              >
                <Text className="text-center font-semibold text-white">
                  Save Changes
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Date/Time Pickers */}
          {showDatePicker && (
            <View className="border-t border-gray-200 bg-gray-50">
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
                style={{ backgroundColor: "transparent" }}
              />
              {Platform.OS === "ios" && (
                <View className="flex-row justify-end p-4">
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    className="bg-blue-600 px-6 py-2 rounded-lg"
                  >
                    <Text className="text-white font-medium">Done</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {showTimePicker && (
            <View className="border-t border-gray-200 bg-gray-50">
              <DateTimePicker
                value={selectedDate}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleTimeChange}
                style={{ backgroundColor: "transparent" }}
              />
              {Platform.OS === "ios" && (
                <View className="flex-row justify-end p-4">
                  <Pressable
                    onPress={() => setShowTimePicker(false)}
                    className="bg-blue-600 px-6 py-2 rounded-lg"
                  >
                    <Text className="text-white font-medium">Done</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
