import { Stack } from "expo-router";

import "./global.css";
import { useNotifications } from "@/hooks/useNotifications";

export default function Layout() {
  useNotifications();
  return <Stack screenOptions={{ headerShown: false }} />;
}
