import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  getAllNotifications,
  addNotification,
  updateNotification,
  NotificationConfig,
} from "@/hooks/useNotifications";
import { IconSymbol } from "@/components/ui/IconSymbol";

export default function NotificationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      loadNotification();
    }
  }, [id]);

  const loadNotification = async () => {
    try {
      setLoading(true);
      const notifications = await getAllNotifications();
      const notification = notifications.find((n) => n.id === id);
      if (notification) {
        setTitle(notification.title);
        setBody(notification.body);
        setHour(notification.hour);
        setMinute(notification.minute);
        setEnabled(notification.enabled);
      } else {
        Alert.alert("Error", "Notification not found");
        router.back();
      }
    } catch (error) {
      console.error("Failed to load notification:", error);
      Alert.alert("Error", "Failed to load notification");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setHour(selectedDate.getHours());
      setMinute(selectedDate.getMinutes());
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Validation Error", "Please enter a title");
      return;
    }
    if (!body.trim()) {
      Alert.alert("Validation Error", "Please enter a message");
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        await addNotification({
          title: title.trim(),
          body: body.trim(),
          hour,
          minute,
          enabled,
        });
      } else {
        await updateNotification(id, {
          title: title.trim(),
          body: body.trim(),
          hour,
          minute,
          enabled,
        });
      }
      router.back();
    } catch (error) {
      console.error("Failed to save notification:", error);
      Alert.alert("Error", "Failed to save notification");
    } finally {
      setSaving(false);
    }
  };

  const formatTime = () => {
    const date = new Date();
    date.setHours(hour);
    date.setMinutes(minute);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <IconSymbol name="chevron.left" size={24} color="#3B82F6" />
          </Pressable>
          <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {isNew ? "New Notification" : "Edit Notification"}
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1">
          <View className="p-4 space-y-6">
            {/* Title Input */}
            <View>
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Title
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., 👋 How are you feeling?"
                placeholderTextColor="#94A3B8"
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-slate-100"
              />
            </View>

            {/* Body Input */}
            <View>
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Message
              </Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="e.g., Don't forget to log your mood for today!"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-slate-100"
                textAlignVertical="top"
              />
            </View>

            {/* Time Picker */}
            <View>
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Time
              </Text>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3"
              >
                <Text className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  {formatTime()}
                </Text>
              </Pressable>
              {showTimePicker && (
                <View className="mt-2">
                  <DateTimePicker
                    value={new Date(new Date().setHours(hour, minute))}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                  />
                  {Platform.OS === "ios" && (
                    <Pressable
                      onPress={() => setShowTimePicker(false)}
                      className="mt-2 bg-blue-600 rounded-xl py-3 px-4 items-center"
                    >
                      <Text className="text-white font-semibold">Done</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* Enabled Toggle */}
            <View className="flex-row items-center justify-between bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Enabled
                </Text>
                <Text className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Turn this notification on or off
                </Text>
              </View>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View className="p-4 border-t border-slate-200 dark:border-slate-800">
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`rounded-xl py-4 px-4 items-center ${
              saving ? "bg-blue-400" : "bg-blue-600"
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {isNew ? "Create Notification" : "Save Changes"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

