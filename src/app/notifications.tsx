import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter, useFocusEffect } from "expo-router";
import {
  getAllNotifications,
  deleteNotification,
  updateNotification,
  NotificationConfig,
} from "@/hooks/useNotifications";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createScreenErrorFallback } from "@/components/ScreenErrorFallback";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

const NotificationsErrorFallback = createScreenErrorFallback("Notifications");

function NotificationsScreenContent() {
  const router = useRouter();
  const { isDark, get } = useThemeColors();
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const all = await getAllNotifications();
      setNotifications(all);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [])
  );

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      haptics.selection();
      await updateNotification(id, { enabled });
      await loadNotifications();
    } catch (error) {
      console.error("Failed to update notification:", error);
      Alert.alert("Error", "Failed to update notification");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    haptics.warning();
    Alert.alert(
      "Delete Reminder",
      `Are you sure you want to delete "${title}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteNotification(id);
              await loadNotifications();
            } catch (error) {
              console.error("Failed to delete notification:", error);
              Alert.alert("Error", "Failed to delete notification");
            }
          },
        },
      ]
    );
  };

  const formatTime = (hour: number, minute: number) => {
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
      <SafeAreaView style={{ flex: 1, backgroundColor: get("background") }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={get("primary")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: get("background") }}>
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
              Stay on track
            </Text>
            <Text
              className="text-2xl font-bold tracking-tight"
              style={{ color: get("text") }}
            >
              Reminders
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Add New Button */}
          <Link href="/notifications/new" asChild>
            <Pressable
              onPress={() => haptics.light()}
              className="rounded-2xl py-4 px-5 mb-5 flex-row items-center justify-center"
              style={{
                backgroundColor: get("primary"),
                shadowColor: isDark ? "#000" : "#5B8A5B",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.4 : 0.25,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <View
                className="w-7 h-7 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <IconSymbol name="plus" size={16} color="#FFFFFF" />
              </View>
              <Text className="text-white font-semibold text-base">
                Add New Reminder
              </Text>
            </Pressable>
          </Link>

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <View
              className="rounded-3xl p-8 items-center"
              style={{
                backgroundColor: get("surface"),
                shadowColor: isDark ? "#000" : "#9D8660",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.2 : 0.08,
                shadowRadius: 16,
                elevation: 3,
              }}
            >
              <View
                className="w-20 h-20 rounded-2xl items-center justify-center mb-5"
                style={{ backgroundColor: get("primaryBg") }}
              >
                <Text className="text-4xl">🔔</Text>
              </View>
              <Text
                className="text-lg font-semibold text-center mb-2"
                style={{ color: get("text") }}
              >
                No reminders yet
              </Text>
              <Text
                className="text-sm text-center max-w-[240px] leading-5"
                style={{ color: get("textMuted") }}
              >
                Set up daily check-ins to build a consistent mood tracking habit
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {notifications.map((notification, index) => (
                <View
                  key={notification.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: get("surface"),
                    shadowColor: isDark ? "#000" : "#9D8660",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.15 : 0.06,
                    shadowRadius: 10,
                    elevation: 2,
                  }}
                >
                  {/* Time badge at top */}
                  <View
                    className="px-4 py-2.5 flex-row items-center justify-between"
                    style={{
                      backgroundColor: notification.enabled
                        ? get("primaryBg")
                        : get("surfaceAlt"),
                      borderBottomWidth: 1,
                      borderBottomColor: get("borderSubtle"),
                    }}
                  >
                    <View className="flex-row items-center">
                      <IconSymbol
                        name="clock.fill"
                        size={14}
                        color={notification.enabled ? get("primary") : get("textMuted")}
                      />
                      <Text
                        className="text-sm font-bold ml-1.5 tracking-wide"
                        style={{
                          color: notification.enabled ? get("primary") : get("textMuted"),
                        }}
                      >
                        {formatTime(notification.hour, notification.minute)}
                      </Text>
                    </View>
                    <Switch
                      value={notification.enabled}
                      onValueChange={(value) =>
                        handleToggleEnabled(notification.id, value)
                      }
                      trackColor={{
                        false: isDark ? "#3D352A" : "#E5D9BF",
                        true: isDark ? "#3D5D3D" : "#A8C5A8",
                      }}
                      thumbColor={notification.enabled ? get("primary") : (isDark ? "#6B5C4A" : "#BDA77D")}
                      ios_backgroundColor={isDark ? "#3D352A" : "#E5D9BF"}
                    />
                  </View>

                  {/* Content */}
                  <View className="p-4">
                    <Text
                      className="text-base font-semibold mb-1.5"
                      style={{
                        color: notification.enabled ? get("text") : get("textMuted"),
                      }}
                    >
                      {notification.title}
                    </Text>
                    <Text
                      className="text-sm leading-5"
                      style={{
                        color: notification.enabled ? get("textMuted") : get("textSubtle"),
                      }}
                      numberOfLines={2}
                    >
                      {notification.body}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View
                    className="flex-row px-3 pb-3 gap-2"
                  >
                    <Link
                      href={`/notifications/${notification.id}`}
                      asChild
                      className="flex-1"
                    >
                      <Pressable
                        onPress={() => haptics.light()}
                        className="flex-1 rounded-xl py-2.5 items-center flex-row justify-center"
                        style={{ backgroundColor: get("primaryBg") }}
                      >
                        <IconSymbol name="pencil" size={14} color={get("primary")} />
                        <Text
                          className="font-medium text-sm ml-1.5"
                          style={{ color: get("primary") }}
                        >
                          Edit
                        </Text>
                      </Pressable>
                    </Link>
                    <Pressable
                      onPress={() =>
                        handleDelete(notification.id, notification.title)
                      }
                      className="flex-1 rounded-xl py-2.5 items-center flex-row justify-center"
                      style={{ backgroundColor: isDark ? "#3D2822" : "#FDE8E4" }}
                    >
                      <IconSymbol
                        name="trash"
                        size={14}
                        color={isDark ? "#F5A899" : "#C75441"}
                      />
                      <Text
                        className="font-medium text-sm ml-1.5"
                        style={{ color: isDark ? "#F5A899" : "#C75441" }}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Tip section */}
          {notifications.length > 0 && (
            <View
              className="mt-6 rounded-2xl p-4 flex-row items-start"
              style={{ backgroundColor: get("surfaceAlt") }}
            >
              <Text className="text-lg mr-3">💡</Text>
              <View className="flex-1">
                <Text
                  className="text-sm font-medium mb-1"
                  style={{ color: get("text") }}
                >
                  Pro tip
                </Text>
                <Text
                  className="text-xs leading-4"
                  style={{ color: get("textMuted") }}
                >
                  Set reminders at times you naturally pause: after meals, before bed, or during commutes.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default function NotificationsScreen() {
  return (
    <ErrorBoundary FallbackComponent={NotificationsErrorFallback}>
      <NotificationsScreenContent />
    </ErrorBoundary>
  );
}
