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
import { getMoodRatingDisplay } from "@/constants/moodScaleInterpretation";
import { getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";
import { getEntryLocalTimeLabel } from "@/lib/entryTimezone";
import type { MoodEntry } from "@db/types";

function getGreeting(date: Date): string {
	const h = date.getHours();
	if (h < 5) return "Still up";
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	if (h < 22) return "Good evening";
	return "Late night";
}

const WEATHER_ICON_SIZE = 44;

type HomeHeaderProps = {
	/** Today's newest entry. Its weather leads the header. */
	latest?: MoodEntry;
};

/**
 * The inner weather now: today's newest entry as its weather sign, word, and
 * number. Before the first entry of the day, a greeting and the date. A
 * streak chip sits in the trailing slot only when there is a streak.
 */
export function HomeHeader({ latest }: HomeHeaderProps) {
	const isDark = useColorScheme() === "dark";

	const revision = useMoodsStore((s) => s.revision);
	const [streak, setStreak] = useState({ current: 0, longest: 0 });
	useEffect(() => {
		let cancelled = false;
		void moodService.getHistorySummary().then((summary) => {
			if (!cancelled) setStreak(calculateStreak(summary.days));
		}).catch(() => {
			if (!cancelled) setStreak({ current: 0, longest: 0 });
		});
		return () => { cancelled = true; };
	}, [revision]);

	const now = new Date();
	const greeting = getGreeting(now);
	const dateLabel = now.toLocaleDateString([], {
		weekday: "long",
		month: "short",
		day: "numeric",
	});

	const titleColor = isDark ? colors.text.dark : colors.text.light;
	const captionColor = isDark ? colors.textSubtle.dark : colors.textMuted.light;
	const accent = isDark ? colors.primary.dark : colors.primary.light;
	const latestLabel = latest ? getMoodRatingDisplay(latest.mood, isDark).label : null;
	const latestTime = latest ? getEntryLocalTimeLabel(latest) : null;

	const streakPalette = isDark
		? semanticToneColors.sage.dark
		: semanticToneColors.sage.light;

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				paddingVertical: 4,
				marginBottom: 4,
			}}
		>
			<View
				accessible
				accessibilityLabel={
					latest ? `Last check-in: ${latestLabel} ${latest.mood} at ${latestTime}` : `${greeting}, ${dateLabel}`
				}
				style={{
					flexDirection: "row",
					alignItems: "center",
					flex: 1,
					minWidth: 0,
					paddingRight: 12,
				}}
			>
				<Ionicons
					name={latest ? getMoodWeatherIcon(latest.mood) : "partly-sunny-outline"}
					size={WEATHER_ICON_SIZE}
					color={latest ? getMoodWeatherColor(latest.mood, isDark) : captionColor}
					style={{ marginRight: 14 }}
				/>

				<View style={{ flex: 1, minWidth: 0 }}>
					<Text
						numberOfLines={1}
						adjustsFontSizeToFit
						minimumFontScale={0.82}
						style={[
							typography.titleMd,
							{
								color: titleColor,
								fontSize: 24,
								lineHeight: 28,
								flexShrink: 1,
							},
						]}
					>
						{latest ? (
							<>
								{latestLabel} <Text style={{ color: captionColor }}>{latest.mood}</Text>
							</>
						) : (
							greeting
						)}
					</Text>
					<Text
						numberOfLines={1}
						adjustsFontSizeToFit
						minimumFontScale={0.9}
						style={[
							typography.bodySm,
							{
								color: captionColor,
								marginTop: 2,
								letterSpacing: 0.1,
								flexShrink: 1,
							},
						]}
					>
						{latest ? `Last check-in at ${latestTime}` : dateLabel}
					</Text>
				</View>
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
