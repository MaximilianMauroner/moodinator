import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export type TimePeriod = "week" | "month" | "all";

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const periods: { id: TimePeriod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "week", label: "Week", icon: "calendar-outline" },
  { id: "month", label: "Month", icon: "calendar-number-outline" },
  { id: "all", label: "All", icon: "infinite-outline" },
];

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <SegmentedControl
      value={value}
      items={periods}
      onChange={onChange}
      variant="surface"
      padding={6}
    />
  );
}
