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

const THREE_COLUMN_CARD_MIN_HEIGHT = 78;
const THREE_COLUMN_CARD_WIDTH = "31.5%";
const TWO_COLUMN_CARD_MIN_HEIGHT = 84;
const TWO_COLUMN_CARD_WIDTH = "48%";

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

	const topRowMoods = moodData.slice(0, 3);
	const remainingMoods = moodData.slice(3);

	const renderMoodCard = (
		mood: (typeof moodData)[number],
		width: ViewStyle["width"],
		minHeight: number,
	) => {
		const cardStyle: ViewStyle = {
			width,
			minHeight,
			backgroundColor: get("background"),
			borderWidth: 1,
			borderColor: get("border"),
		};

		return (
		<HapticTab
			key={`${isDark ? "dark" : "light"}-${mood.value}`}
			className="items-center justify-center rounded-2xl py-[8px]"
			style={cardStyle}
			onPress={() => onMoodPress(mood.value)}
			onLongPress={() => onLongPress(mood.value)}
			delayLongPress={500}
			accessibilityRole="button"
			accessibilityLabel={getMoodButtonLabel(mood.value, mood.label)}
			accessibilityHint={getMoodButtonHint()}
		>
			<View className="mb-0.5 flex-row items-center">
				<Ionicons
					name={getMoodWeatherIcon(mood.value)}
					size={20}
					color={getMoodWeatherColor(mood.value, isDark)}
				/>
				<Text className="ml-1.5 text-[18px] font-bold" style={{ color: get("text") }}>
					{mood.value}
				</Text>
			</View>
			<Text
				className="mb-0.5 self-stretch text-center text-xs font-semibold"
				style={{ color: get("textMuted") }}
			>
				{mood.label}
			</Text>
			<Text
				className="px-1.5 text-center text-xs leading-tight"
				style={{ color: get("textSubtle") }}
				numberOfLines={2}
			>
				{mood.description}
			</Text>
		</HapticTab>
		);
	};

	return (
		<View className="mb-2">
			<View
				className="flex-row flex-wrap justify-between"
				style={{ rowGap: 8 }}
			>
				{topRowMoods.map((mood) =>
					renderMoodCard(
						mood,
						THREE_COLUMN_CARD_WIDTH,
						THREE_COLUMN_CARD_MIN_HEIGHT,
					),
				)}
				{remainingMoods.map((mood) =>
					renderMoodCard(mood, TWO_COLUMN_CARD_WIDTH, TWO_COLUMN_CARD_MIN_HEIGHT),
				)}
			</View>

		</View>
	);
};
