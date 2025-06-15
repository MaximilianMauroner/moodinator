import React, { useState } from "react";
import { View, Text, Modal, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MoodEntry } from "@db/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { moodScale } from "@/constants/moodScale";

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

  return (
    <SafeAreaView>
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-xl p-6 mx-4 w-80">
            <Text className="text-lg font-bold text-center mb-4">
              Edit Date & Time
            </Text>

            <Text className="text-sm text-gray-600 mb-4">
              Mood:{" "}
              <Text className={moodScale[mood.mood]?.color || "text-gray-600"}>
                {mood.mood}
              </Text>
              {mood.note && ` • ${mood.note}`}
            </Text>

            <View className="mb-4">
              <Text className="text-sm font-medium mb-2">Date:</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="border border-gray-300 rounded-lg p-3"
              >
                <Text>{selectedDate.toLocaleDateString()}</Text>
              </Pressable>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium mb-2">Time:</Text>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="border border-gray-300 rounded-lg p-3"
              >
                <Text>{selectedDate.toLocaleTimeString()}</Text>
              </Pressable>
            </View>

            <View className="flex-row justify-between">
              <Pressable
                onPress={onClose}
                className="flex-1 mr-2 py-3 bg-gray-200 rounded-lg"
              >
                <Text className="text-center font-medium">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                className="flex-1 ml-2 py-3 bg-blue-500 rounded-lg"
              >
                <Text className="text-center font-medium text-white">Save</Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
              />
            )}

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
