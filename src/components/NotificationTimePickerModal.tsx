import React, { useState } from "react";
import { View, Text, Modal, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  visible: boolean;
  initialHour: number;
  initialMinute: number;
  onClose: () => void;
  onSave: (hour: number, minute: number) => void;
}

export const NotificationTimePickerModal: React.FC<Props> = ({
  visible,
  initialHour,
  initialMinute,
  onClose,
  onSave,
}) => {
  const [selectedTime, setSelectedTime] = useState(() => {
    const date = new Date();
    date.setHours(initialHour);
    date.setMinutes(initialMinute);
    return date;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);

  React.useEffect(() => {
    const date = new Date();
    date.setHours(initialHour);
    date.setMinutes(initialMinute);
    setSelectedTime(date);
  }, [initialHour, initialMinute]);

  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (time) {
      setSelectedTime(time);
    }
  };

  const handleSave = () => {
    onSave(selectedTime.getHours(), selectedTime.getMinutes());
    onClose();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (!visible) return null;

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
              Set Notification Time
            </Text>

            <Text className="text-sm text-gray-600 dark:text-slate-300 mb-4 text-center">
              Choose when you'd like to receive daily mood reminders
            </Text>

            <View className="mb-6">
              <Text className="text-sm font-medium mb-2 text-slate-800 dark:text-slate-200">
                Time:
              </Text>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="border border-gray-300 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800"
              >
                <Text className="text-center text-lg text-slate-900 dark:text-slate-100">
                  {formatTime(selectedTime)}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row justify-between">
              <Pressable
                onPress={onClose}
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

            {showTimePicker && (
              <DateTimePicker
                value={selectedTime}
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
