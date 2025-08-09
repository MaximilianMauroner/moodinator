import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-950 p-6">
        <Text className="text-6xl mb-4">🔎</Text>
        <Text className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
          This screen doesn't exist.
        </Text>
        <Link href="/">
          <Text className="text-blue-600 dark:text-blue-400 font-semibold mt-2">
            Go to home screen
          </Text>
        </Link>
      </View>
    </>
  );
}
