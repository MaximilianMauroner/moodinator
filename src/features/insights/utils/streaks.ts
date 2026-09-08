import type { MoodEntry } from "@db/types";
import { format, subDays } from "date-fns";

/**
 * Calculate current streak (consecutive days with entries)
 */
export function calculateStreak(moods: MoodEntry[], todayDate = new Date()): { current: number; longest: number } {
  if (moods.length === 0) return { current: 0, longest: 0 };

  // Group by date
  const dateSet = new Set<string>();
  moods.forEach((mood) => {
    const dateKey = format(new Date(mood.timestamp), "yyyy-MM-dd");
    dateSet.add(dateKey);
  });

  const dates = Array.from(dateSet).sort().reverse(); // Most recent first

  if (dates.length === 0) return { current: 0, longest: 0 };

  // Calculate current streak
  let currentStreak = 0;
  const today = format(todayDate, "yyyy-MM-dd");
  const yesterday = format(subDays(todayDate, 1), "yyyy-MM-dd");

  // Current streak must include today or yesterday
  if (dates[0] === today || dates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 1;
  let tempStreak = 1;

  const sortedDatesAsc = [...dates].reverse(); // Oldest first
  for (let i = 1; i < sortedDatesAsc.length; i++) {
    const prevDate = new Date(sortedDatesAsc[i - 1]);
    const currDate = new Date(sortedDatesAsc[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}
