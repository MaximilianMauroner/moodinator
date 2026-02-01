import React, { useState } from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, colors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { moodService } from "@/services/moodService";
import type { MoodEntry } from "@db/types";

interface SameAsYesterdayButtonProps {
  onCopy: (entry: MoodEntry) => void;
}

export const SameAsYesterdayButton: React.FC<SameAsYesterdayButtonProps> = ({
  onCopy,
}) => {
  const { isDark, get } = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [noYesterday, setNoYesterday] = useState(false);

  const handlePress = async () => {
    haptics.light();
    setLoading(true);
    setNoYesterday(false);

    try {
      const yesterdayEntry = await moodService.getYesterday();

      if (yesterdayEntry) {
        haptics.success();
        onCopy(yesterdayEntry);
      } else {
        setNoYesterday(true);
        haptics.warning();
        // Reset the "no yesterday" state after 3 seconds
        setTimeout(() => setNoYesterday(false), 3000);
      }
    } catch (error) {
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  if (noYesterday) {
    return (
      <Pressable
        disabled
        className="flex-row items-center px-3 py-2 rounded-xl"
        style={{
          backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light,
          opacity: 0.5,
        }}
      >
        <Ionicons
          name="calendar-outline"
          size={14}
          color={get("textMuted")}
          style={{ marginRight: 5 }}
        />
        <Text
          className="text-[11px] font-medium"
          style={{ color: get("textMuted") }}
        >
          No entry yesterday
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={loading}
      className="flex-row items-center px-3.5 py-2.5 rounded-xl"
      style={{
        backgroundColor: isDark ? colors.primaryBg.dark : colors.primaryBg.light,
        borderWidth: 1,
        borderColor: isDark ? "rgba(91, 138, 91, 0.3)" : "rgba(91, 138, 91, 0.2)",
        opacity: loading ? 0.6 : 1,
        shadowColor: colors.primary.light,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.15 : 0.1,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={get("primary")} />
      ) : (
        <>
          <Ionicons
            name="repeat"
            size={14}
            color={get("primary")}
            style={{ marginRight: 5 }}
          />
          <Text
            className="text-[11px] font-bold tracking-wide"
            style={{ color: get("primary") }}
          >
            YESTERDAY
          </Text>
        </>
      )}
    </Pressable>
  );
};

export default SameAsYesterdayButton;
