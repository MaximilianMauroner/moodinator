import React from "react";
import { Toaster } from "sonner";

import { colors } from "@/constants/colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export function AppToaster() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Toaster
      theme={isDark ? "dark" : "light"}
      position="top-center"
      offset="calc(env(safe-area-inset-top, 0px) + 12px)"
      gap={8}
      visibleToasts={3}
      expand={false}
      swipeDirections={["top", "left"]}
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: 22,
          border: `1px solid ${isDark ? colors.border.dark : colors.border.light}`,
          background: isDark ? colors.surface.dark : colors.surface.light,
          color: isDark ? colors.text.dark : colors.text.light,
          boxShadow: isDark
            ? "0 8px 20px rgba(0, 0, 0, 0.24)"
            : "0 8px 20px rgba(157, 134, 96, 0.1)",
        },
      }}
    />
  );
}

export default AppToaster;
