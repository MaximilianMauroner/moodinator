import React, { useMemo } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { typography } from "@/constants/typography";
import { useColorScheme } from "@/hooks/useColorScheme";
import { haptics } from "@/lib/haptics";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { describeFilters, removeFilter } from "./filterModel";
import { filterPalette } from "./HistoryFilterSheetParts";

/**
 * Shows what is filtering the history list right now. Each chip removes its own
 * filter, so narrowing a search does not mean reopening the sheet.
 */
export function ActiveFilterChips() {
  const isDark = useColorScheme() === "dark";
  const palette = filterPalette(isDark);
  const filters = useMoodsStore((state) => state.filters);
  const setFilters = useMoodsStore((state) => state.setFilters);
  const chips = useMemo(() => describeFilters(filters, new Date()), [filters]);

  if (!chips.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerStyle={{ alignItems: "center", gap: 8, paddingRight: 8 }}
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.id}
          accessibilityRole="button"
          accessibilityLabel={`Remove filter ${chip.label}`}
          onPress={() => {
            haptics.tick();
            void setFilters(removeFilter(filters, chip.id));
          }}
          className="flex-row items-center gap-1.5 rounded-full px-3"
          style={{
            backgroundColor: palette.band,
            borderColor: palette.accent,
            borderWidth: 1,
            minHeight: 32,
          }}
        >
          <Text
            style={[typography.bodySm, { color: palette.accent, fontWeight: "600" }]}
          >
            {chip.label}
          </Text>
          <Ionicons name="close" size={13} color={palette.accent} />
        </Pressable>
      ))}
      {chips.length > 1 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
          onPress={() => {
            haptics.tick();
            void setFilters({});
          }}
          className="justify-center px-2"
          style={{ minHeight: 32 }}
        >
          <Text style={[typography.bodySm, { color: palette.subtle }]}>
            Clear all
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export default ActiveFilterChips;
