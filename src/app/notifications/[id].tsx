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
  KeyboardAvoidingView,
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
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

export default function NotificationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDark, get } = useThemeColors();
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
      haptics.selection();
      setHour(selectedDate.getHours());
      setMinute(selectedDate.getMinutes());
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      haptics.warning();
      Alert.alert("Missing Title", "Please enter a title for your reminder");
      return;
    }
    if (!body.trim()) {
      haptics.warning();
      Alert.alert("Missing Message", "Please enter a message for your reminder");
      return;
    }

    try {
      setSaving(true);
      haptics.success();
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
      Alert.alert("Error", "Failed to save reminder");
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

  const getTimeOfDayEmoji = () => {
    if (hour >= 5 && hour < 12) return "🌅";
    if (hour >= 12 && hour < 17) return "☀️";
    if (hour >= 17 && hour < 21) return "🌆";
    return "🌙";
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: get("background") }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={get("primary")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: get("background") }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1">
          {/* Header */}
          <View
            className="flex-row items-center px-5 pt-2 pb-4"
            style={{ backgroundColor: get("background") }}
          >
            <Pressable
              onPress={() => {
                haptics.light();
                router.back();
              }}
              className="p-2 -ml-2 rounded-xl"
              style={{ backgroundColor: get("primaryBg") }}
            >
              <IconSymbol name="chevron.left" size={20} color={get("primary")} />
            </Pressable>
            <View className="flex-1 ml-4">
              <Text
                className="text-xs font-medium mb-0.5"
                style={{ color: get("primary") }}
              >
                {isNew ? "Create new" : "Edit"}
              </Text>
              <Text
                className="text-2xl font-bold tracking-tight"
                style={{ color: get("text") }}
              >
                {isNew ? "New Reminder" : "Edit Reminder"}
              </Text>
            </View>
          </View>

          <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Preview Card */}
            <View
              className="rounded-2xl p-4 mb-6"
              style={{
                backgroundColor: get("surface"),
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.2 : 0.08,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <Text
                className="text-xs font-medium mb-3 uppercase tracking-wider"
                style={{ color: get("textMuted") }}
              >
                Preview
              </Text>
              <View
                className="rounded-xl p-4"
                style={{
                  backgroundColor: get("surfaceAlt"),
                  borderWidth: 1,
                  borderColor: get("borderSubtle"),
                }}
              >
                <View className="flex-row items-start">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: get("primaryBg") }}
                  >
                    <Text className="text-lg">🔔</Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-semibold mb-0.5"
                      style={{ color: get("text") }}
                      numberOfLines={1}
                    >
                      {title || "Your reminder title"}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: get("textMuted") }}
                      numberOfLines={2}
                    >
                      {body || "Your reminder message will appear here"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Title Input */}
            <View className="mb-5">
              <Text
                className="text-sm font-semibold mb-2.5"
                style={{ color: get("text") }}
              >
                Title
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Time to check in!"
                placeholderTextColor={get("textSubtle")}
                className="rounded-xl px-4 py-3.5 text-base"
                style={{
                  backgroundColor: get("surface"),
                  color: get("text"),
                  borderWidth: 1,
                  borderColor: get("border"),
                }}
              />
            </View>

            {/* Body Input */}
            <View className="mb-5">
              <Text
                className="text-sm font-semibold mb-2.5"
                style={{ color: get("text") }}
              >
                Message
              </Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="e.g., How are you feeling right now?"
                placeholderTextColor={get("textSubtle")}
                multiline
                numberOfLines={3}
                className="rounded-xl px-4 py-3.5 text-base"
                style={{
                  backgroundColor: get("surface"),
                  color: get("text"),
                  borderWidth: 1,
                  borderColor: get("border"),
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
              />
            </View>

            {/* Time Picker */}
            <View className="mb-5">
              <Text
                className="text-sm font-semibold mb-2.5"
                style={{ color: get("text") }}
              >
                Reminder Time
              </Text>
              <Pressable
                onPress={() => {
                  haptics.light();
                  setShowTimePicker(true);
                }}
                className="rounded-xl px-4 py-4 flex-row items-center justify-between"
                style={{
                  backgroundColor: get("surface"),
                  borderWidth: 1,
                  borderColor: get("border"),
                }}
              >
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">{getTimeOfDayEmoji()}</Text>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: get("text") }}
                  >
                    {formatTime()}
                  </Text>
                </View>
                <View
                  className="rounded-lg px-3 py-1.5"
                  style={{ backgroundColor: get("primaryBg") }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: get("primary") }}
                  >
                    Change
                  </Text>
                </View>
              </Pressable>
              {showTimePicker && (
                <View
                  className="mt-3 rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: get("surface"),
                    borderWidth: 1,
                    borderColor: get("border"),
                  }}
                >
                  <DateTimePicker
                    value={new Date(new Date().setHours(hour, minute))}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                    textColor={get("text")}
                  />
                  {Platform.OS === "ios" && (
                    <Pressable
                      onPress={() => {
                        haptics.light();
                        setShowTimePicker(false);
                      }}
                      className="py-3 items-center border-t"
                      style={{
                        backgroundColor: get("primaryBg"),
                        borderTopColor: get("border"),
                      }}
                    >
                      <Text
                        className="font-semibold"
                        style={{ color: get("primary") }}
                      >
                        Done
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* Enabled Toggle */}
            <View
              className="rounded-xl px-4 py-4 flex-row items-center justify-between"
              style={{
                backgroundColor: get("surface"),
                borderWidth: 1,
                borderColor: get("border"),
              }}
            >
              <View className="flex-1 pr-4">
                <View className="flex-row items-center mb-1">
                  <IconSymbol
                    name={enabled ? "bell.fill" : "bell.slash.fill"}
                    size={16}
                    color={enabled ? get("primary") : get("textMuted")}
                  />
                  <Text
                    className="text-base font-semibold ml-2"
                    style={{ color: get("text") }}
                  >
                    Active
                  </Text>
                </View>
                <Text
                  className="text-xs"
                  style={{ color: get("textMuted") }}
                >
                  {enabled
                    ? "You'll receive this reminder daily"
                    : "This reminder is paused"}
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(value) => {
                  haptics.selection();
                  setEnabled(value);
                }}
                trackColor={{
                  false: isDark ? "#3D352A" : "#E5D9BF",
                  true: isDark ? "#3D5D3D" : "#A8C5A8",
                }}
                thumbColor={enabled ? get("primary") : (isDark ? "#6B5C4A" : "#BDA77D")}
                ios_backgroundColor={isDark ? "#3D352A" : "#E5D9BF"}
              />
            </View>
          </ScrollView>

          {/* Save Button */}
          <View
            className="px-4 py-4"
            style={{
              backgroundColor: get("background"),
              borderTopWidth: 1,
              borderTopColor: get("borderSubtle"),
            }}
          >
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="rounded-2xl py-4 px-4 items-center flex-row justify-center"
              style={{
                backgroundColor: saving ? get("primaryMuted") : get("primary"),
                shadowColor: isDark ? "#000" : "#5B8A5B",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.3 : 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    name={isNew ? "plus.circle.fill" : "checkmark.circle.fill"}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text className="text-white font-semibold text-base ml-2">
                    {isNew ? "Create Reminder" : "Save Changes"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

