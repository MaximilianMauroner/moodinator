import React, { useState } from "react";
import { View, Text, Modal, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MoodEntry } from "@db/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { moodScale } from "@/constants/moodScale";
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
          <View className="bg-white dark:bg-slate-900 rounded-2xl p-6 mx-4 w-80 border border-slate-100 dark:border-slate-800">
            <Text className="text-lg font-bold text-center mb-4 text-slate-900 dark:text-slate-100">
              Edit Date & Time
            </Text>

            <Text className="text-sm text-gray-600 dark:text-slate-300 mb-4">
              Mood:{" "}
              <Text className={moodScale[mood.mood]?.color || "text-gray-600"}>
                {mood.mood}
              </Text>
              {mood.note && ` • ${mood.note}`}
            </Text>

            <View className="mb-4">
              <Text className="text-sm font-medium mb-2 text-slate-800 dark:text-slate-200">
                Date:
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="border border-gray-300 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800"
              >
                <Text className="text-slate-900 dark:text-slate-100">
                  {selectedDate.toLocaleDateString()}
                </Text>
              </Pressable>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium mb-2 text-slate-800 dark:text-slate-200">
                Time:
              </Text>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="border border-gray-300 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800"
              >
                <Text className="text-slate-900 dark:text-slate-100">
                  {selectedDate.toLocaleTimeString()}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row justify-between">
              <Pressable
                onPress={handleCancel}
                className="flex-1 mr-2 py-3 bg-gray-200 dark:bg-slate-800 rounded-lg"
              >
                <Text className="text-center font-medium text-slate-800 dark:text-slate-200">
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                className="flex-1 ml-2 py-3 bg-blue-600 rounded-lg"
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
