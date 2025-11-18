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

export default function NotificationsScreen() {
  const router = useRouter();
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
      await updateNotification(id, { enabled });
      await loadNotifications();
    } catch (error) {
      console.error("Failed to update notification:", error);
      Alert.alert("Error", "Failed to update notification");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    Alert.alert(
      "Delete Notification",
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
          <Pressable
            onPress={() => router.back()}
            className="p-2 -ml-2"
          >
            <IconSymbol name="chevron.left" size={24} color="#3B82F6" />
          </Pressable>
          <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Notifications
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1">
          <View className="p-4">
            {/* Add New Button */}
            <Link href="/notifications/new" asChild>
              <Pressable className="bg-blue-600 rounded-xl py-4 px-4 items-center mb-6">
                <View className="flex-row items-center">
                  <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
                  <Text className="text-white font-semibold text-base ml-2">
                    Add New Notification
                  </Text>
                </View>
              </Pressable>
            </Link>

            {/* Notifications List */}
            {notifications.length === 0 ? (
              <View className="bg-slate-100 dark:bg-slate-900 rounded-xl p-8 items-center">
                <IconSymbol
                  name="bell.slash"
                  size={48}
                  color="#94A3B8"
                />
                <Text className="text-slate-600 dark:text-slate-400 text-center mt-4 text-base">
                  No notifications yet. Add one to get started!
                </Text>
              </View>
            ) : (
              <View className="space-y-3">
                {notifications.map((notification) => (
                  <View
                    key={notification.id}
                    className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1 pr-3">
                        <Text className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                          {notification.title}
                        </Text>
                        <Text className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          {notification.body}
                        </Text>
                        <View className="flex-row items-center mt-2">
                          <IconSymbol
                            name="clock"
                            size={16}
                            color="#64748B"
                          />
                          <Text className="text-sm text-slate-500 dark:text-slate-400 ml-1">
                            {formatTime(notification.hour, notification.minute)}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={notification.enabled}
                        onValueChange={(value) =>
                          handleToggleEnabled(notification.id, value)
                        }
                      />
                    </View>

                    <View className="flex-row gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <Link
                        href={`/notifications/${notification.id}`}
                        asChild
                        className="flex-1"
                      >
                        <Pressable className="bg-blue-50 dark:bg-slate-800 rounded-lg py-2 px-3 items-center">
                          <Text className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                            Edit
                          </Text>
                        </Pressable>
                      </Link>
                      <Pressable
                        onPress={() =>
                          handleDelete(notification.id, notification.title)
                        }
                        className="flex-1 bg-red-50 dark:bg-slate-800 rounded-lg py-2 px-3 items-center"
                      >
                        <Text className="text-red-600 dark:text-red-400 font-medium text-sm">
                          Delete
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

