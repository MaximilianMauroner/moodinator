// Screens
export { InsightsScreen } from "./screens/InsightsScreen";

// Components
export { InsightCard } from "./components/InsightCard";
export { TimePeriodSelector } from "./components/TimePeriodSelector";
export { WeekNavigator } from "./components/WeekNavigator";
export { PatternCard } from "./components/PatternCard";
export { StreakBadge } from "./components/StreakBadge";
export { TrendIndicator, getTrendDirection } from "./components/TrendIndicator";

// Hooks
export { useInsightsData } from "./hooks/useInsightsData";

// Utils
export { detectPatterns, calculateStreak } from "./utils/patternDetection";

// Types
export type { TimePeriod } from "./components/TimePeriodSelector";
export type { TrendDirection } from "./components/TrendIndicator";
export type { Pattern } from "./utils/patternDetection";
export type { InsightsData, PeriodStats } from "./hooks/useInsightsData";
