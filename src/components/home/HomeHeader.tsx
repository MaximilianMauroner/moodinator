import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/useColorScheme";
import { typography } from "@/constants/typography";
import { colors, semanticToneColors } from "@/constants/colors";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { moodService } from "@/services/moodService";
import { calculateStreak } from "@/features/insights/utils/streaks";
import { SettingsGearButton } from "@/components/ui/SettingsGearButton";

/**
 * Today's title row: the day, a streak chip only when there is a streak, and
 * the settings gear.
 */
export function HomeHeader() {
	const isDark = useColorScheme() === "dark";

	const revision = useMoodsStore((s) => s.revision);
	const lastLoadedAt = useMoodsStore((s) => s.lastLoadedAt);
	const [streak, setStreak] = useState({ current: 0, longest: 0 });
	useEffect(() => {
		let cancelled = false;
		void moodService.getHistorySummary().then((summary) => {
			if (!cancelled) setStreak(calculateStreak(summary.days));
		}).catch(() => {
			if (!cancelled) setStreak({ current: 0, longest: 0 });
		});
		return () => { cancelled = true; };
	}, [revision, lastLoadedAt]);

	const dateLabel = new Date().toLocaleDateString([], {
		weekday: "long",
		month: "short",
		day: "numeric",
	});

	const titleColor = isDark ? colors.text.dark : colors.text.light;
	const captionColor = isDark ? colors.textSubtle.dark : colors.textMuted.light;
	const accent = isDark ? colors.primary.dark : colors.primary.light;
	const streakPalette = isDark
		? semanticToneColors.sage.dark
		: semanticToneColors.sage.light;

	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Text
					accessibilityRole="header"
					style={[typography.titleMd, { color: titleColor, fontSize: 24, lineHeight: 28 }]}
				>
					Today
				</Text>
				<Text
					numberOfLines={1}
					style={[typography.bodySm, { color: captionColor, marginTop: 2 }]}
				>
					{dateLabel}
				</Text>
			</View>

			{streak.current > 0 ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						paddingHorizontal: 10,
						paddingVertical: 6,
						borderRadius: 999,
						backgroundColor: streakPalette.bg,
						borderWidth: 1,
						borderColor: streakPalette.border,
						gap: 5,
						flexShrink: 0,
					}}
					accessibilityLabel={`Streak: ${streak.current} ${
						streak.current === 1 ? "day" : "days"
					}`}
				>
					<Ionicons name="leaf" size={11} color={accent} />
					<Text
						style={[
							typography.eyebrow,
							{
								fontSize: 12,
								letterSpacing: 0.6,
								color: streakPalette.fg,
								fontWeight: "700",
								textTransform: "none",
							},
						]}
					>
						{streak.current}
						{streak.current === 1 ? " day" : "d streak"}
					</Text>
				</View>
			) : null}
			<SettingsGearButton />
		</View>
	);
}

export default HomeHeader;
