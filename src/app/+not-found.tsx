import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 items-center justify-center bg-paper-100 dark:bg-paper-900 p-6">
        <View className="w-20 h-20 rounded-3xl items-center justify-center mb-4 bg-sand-100 dark:bg-sand-800">
          <Ionicons name="search-outline" size={40} color="#BDA77D" />
        </View>
        <Text className="text-xl font-semibold text-paper-800 dark:text-paper-100 mb-2">
          {"This screen doesn't exist."}
        </Text>
        <Link href="/">
          <Text className="text-sage-500 dark:text-sage-300 font-semibold mt-2">
            Go to home screen
          </Text>
        </Link>
      </View>
    </>
  );
}
