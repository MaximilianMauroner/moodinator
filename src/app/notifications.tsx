import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter, useFocusEffect } from "expo-router";
import {
  getAllNotifications,
  deleteNotification,
  updateNotification,
  ensureMoodReminderScheduled,
  NotificationConfig,
} from "@/hooks/useNotifications";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Ionicons } from "@expo/vector-icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Alert } from "@/components/ui/AppAlert";
import { createScreenErrorFallback } from "@/components/ScreenErrorFallback";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import {
  getReminderScheduleResultWarning,
  getReminderScheduleWarning,
} from "@/lib/reminderSchedulePresentation";
import { formatReminderTime } from "@/lib/reminderTimePresentation";
import { useCalendars, useLocales } from "expo-localization";

const NotificationsErrorFallback = createScreenErrorFallback("Notifications");

function NotificationsScreenContent() {
  const router = useRouter();
  const { isDark, get } = useThemeColors();
  const [{ languageTag }] = useLocales();
  const [{ uses24hourClock }] = useCalendars();
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = React.useCallback(async () => {
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
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadNotifications();
    }, [loadNotifications])
  );

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void ensureMoodReminderScheduled()
          .then(() => loadNotifications())
          .catch((error) => {
            console.error("Failed to refresh notification status:", error);
          });
      }
    });
    return () => subscription.remove();
  }, [loadNotifications]);

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    if (enabled) {
      Alert.alert(
        "Enable Reminder?",
        "Your device may ask for notification permission. Moodinator uses it only for local check-in reminders.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable",
            onPress: () => {
              void (async () => {
                try {
                  haptics.selection();
                  const result = await updateNotification(id, { enabled: true });
                  await loadNotifications();
                  const warning = getReminderScheduleResultWarning(result);
                  if (warning) {
                    Alert.alert(warning.title, warning.message);
                  }
                } catch (error) {
                  console.error("Failed to update notification:", error);
                  Alert.alert("Error", "Failed to update notification");
                }
              })();
            },
          },
        ]
      );
      return;
    }

    try {
      haptics.selection();
      const result = await updateNotification(id, { enabled });
      await loadNotifications();
      const warning = getReminderScheduleResultWarning(result);
      if (warning) {
        Alert.alert(warning.title, warning.message);
      }
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
              const result = await deleteNotification(id);
              await loadNotifications();
              const warning = getReminderScheduleResultWarning(result);
              if (warning) {
                Alert.alert(warning.title, warning.message);
              }
            } catch (error) {
              console.error("Failed to delete notification:", error);
              Alert.alert("Error", "Failed to delete notification");
            }
          },
        },
      ]
    );
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
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="chevron.left" size={20} color={get("primary")} />
          </Pressable>
          <View className="flex-1 ml-4">
            <Text
              className="text-xs font-medium mb-0.5"
              style={{ color: isDark ? get("primary") : "#476D47" }}
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
          contentInsetAdjustmentBehavior="automatic"
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
              accessibilityRole="button"
              accessibilityLabel="Add new reminder"
            >
              <View
                className="w-7 h-7 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <IconSymbol name="plus" size={16} color={get("onPrimary")} />
              </View>
              <Text className="font-semibold text-base" style={{ color: get("onPrimary") }}>
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
                <Ionicons name="notifications-outline" size={36} color={get("primary")} />
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
              {notifications.map((notification) => {
                const scheduleWarning = getReminderScheduleWarning(notification);

                return (
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
                        {formatReminderTime(
                          notification.hour,
                          notification.minute,
                          languageTag,
                          uses24hourClock
                        )}
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
                      thumbColor={notification.enabled ? get("primary") : (isDark ? "#8AAE98" : "#BDA77D")}
                      ios_backgroundColor={isDark ? "#3D352A" : "#E5D9BF"}
                      accessibilityLabel={`${notification.title} reminder`}
                      accessibilityHint={notification.enabled ? "Double tap to pause" : "Double tap to enable"}
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
                    {scheduleWarning && (
                      <View
                        className="mt-3 rounded-xl p-3 flex-row items-start"
                        style={{
                          backgroundColor: isDark ? "rgba(60, 26, 20, 0.45)" : "#FDE8E4",
                          borderWidth: 1,
                          borderColor: isDark ? "rgba(245, 168, 153, 0.25)" : "#F5A899",
                        }}
                      >
                        <Ionicons
                          name="alert-circle-outline"
                          size={16}
                          color={isDark ? "#F5A899" : "#C75441"}
                          style={{ marginRight: 8, marginTop: 1 }}
                        />
                        <View className="flex-1">
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: isDark ? "#F5A899" : "#C75441" }}
                          >
                            Not scheduled
                          </Text>
                          <Text
                            className="text-xs leading-4 mt-0.5"
                            style={{ color: isDark ? "#F7C1B7" : "#8E3D31" }}
                          >
                            {scheduleWarning.message}
                          </Text>
                        </View>
                      </View>
                    )}
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
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${notification.title} reminder`}
                      >
                        <IconSymbol name="pencil" size={14} color={get("primary")} />
                        <Text
                          className="font-medium text-sm ml-1.5"
                          style={{ color: isDark ? get("primary") : "#476D47" }}
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
                      style={{ backgroundColor: isDark ? "#3C1A14" : "#FDE8E4" }}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${notification.title} reminder`}
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
                );
              })}
            </View>
          )}

          {/* Tip section */}
          {notifications.length > 0 && (
            <View
              className="mt-6 rounded-2xl p-4 flex-row items-start"
              style={{ backgroundColor: get("surfaceAlt") }}
            >
              <Ionicons name="bulb-outline" size={20} color={get("primary")} style={{ marginRight: 12 }} />
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
