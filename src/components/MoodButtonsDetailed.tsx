import React from "react";
import { View, Text, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HapticTab } from "./HapticTab";
import { getAllMoodRatingDisplays } from "@/constants/moodScaleInterpretation";
import {
	getMoodButtonLabel,
	getMoodButtonHint,
} from "@/constants/accessibility";
import { useThemeColors } from "@/constants/colors";
import { getMoodWeatherColor, getMoodWeatherIcon } from "@/constants/moodWeather";

interface MoodButtonsDetailedProps {
	onMoodPress: (mood: number) => void;
	onLongPress: (mood: number) => void;
}

export const MoodButtonsDetailed: React.FC<MoodButtonsDetailedProps> = ({
	onMoodPress,
	onLongPress,
}) => {
	const { isDark, get } = useThemeColors();

	const moodData = React.useMemo(() => {
		return getAllMoodRatingDisplays(isDark).map((mood) => ({
			value: mood.value,
			label: mood.label,
			description: mood.description,
		}));
	}, [isDark]);

	const renderMoodRow = (mood: (typeof moodData)[number]) => {
		const rowStyle: ViewStyle = {
			minHeight: 48,
			backgroundColor: get("background"),
			borderWidth: 1,
			borderColor: get("border"),
		};

		return (
		<HapticTab
			key={`${isDark ? "dark" : "light"}-${mood.value}`}
			className="flex-row items-center rounded-2xl px-3 py-1.5"
			style={rowStyle}
			onPress={() => onMoodPress(mood.value)}
			onLongPress={() => onLongPress(mood.value)}
			delayLongPress={500}
			accessibilityRole="button"
			accessibilityLabel={getMoodButtonLabel(mood.value, mood.label)}
			accessibilityHint={getMoodButtonHint()}
		>
			<View className="min-w-[56px] flex-row items-center">
				<Ionicons
					name={getMoodWeatherIcon(mood.value)}
					size={20}
					color={getMoodWeatherColor(mood.value, isDark)}
				/>
				<Text className="ml-1.5 text-[18px] font-bold" style={{ color: get("text") }}>
					{mood.value}
				</Text>
			</View>
			<View className="ml-2 flex-1">
				<Text className="text-sm font-semibold" style={{ color: get("text") }}>
					{mood.label}
				</Text>
				<Text className="text-sm leading-tight" style={{ color: get("textSubtle") }}>
					{mood.description}
				</Text>
			</View>
		</HapticTab>
		);
	};

	return (
		<View className="mb-2">
			<View style={{ rowGap: 4 }}>
				{moodData.map(renderMoodRow)}
			</View>
		</View>
	);
};
