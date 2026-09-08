export type OnboardingPage = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  accentColor: string;
  accentColorDark: string;
};

export const onboardingPages: OnboardingPage[] = [
  {
    id: "welcome",
    title: "Welcome to Moodinator",
    subtitle: "Your personal mood companion",
    description: "Keep a private record of how you feel, with emotions, context, and notes to help you reflect over time.",
    icon: "leaf",
    accentColor: "#476D47",
    accentColorDark: "#A6E39B",
  },
  {
    id: "track",
    title: "Track Your Mood",
    subtitle: "Simple and intuitive",
    description: "Tap the mood button for a quick entry, or long-press for a detailed log with emotions, context, energy, and notes. On the mood scale, 0 is best and 10 means you need the most support.",
    icon: "heart",
    accentColor: "#A84335",
    accentColorDark: "#F5A899",
  },
  {
    id: "discover",
    title: "Look Back",
    subtitle: "Insights at a glance",
    description: "Browse your moods on a color-coded calendar, review weekly and monthly summaries, and revisit the details of any entry.",
    icon: "calendar",
    accentColor: "#695C78",
    accentColorDark: "#D5CCDD",
  },
  {
    id: "privacy",
    title: "Your Data, Your Control",
    subtitle: "Private and secure",
    description: "All your data stays on your device. No accounts, no cloud sync, no tracking. Your thoughts remain yours alone.",
    icon: "lock-closed",
    accentColor: "#7A6545",
    accentColorDark: "#E0C993",
  },
];
