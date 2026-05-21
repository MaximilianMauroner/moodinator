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
          width: "calc(100vw - 32px)",
          maxWidth: 520,
          borderRadius: 18,
          border: `1px solid ${isDark ? colors.border.dark : colors.border.light}`,
          background: isDark ? colors.surface.dark : colors.surface.light,
          color: isDark ? colors.text.dark : colors.text.light,
          boxShadow: isDark
            ? "0 6px 18px rgba(20, 30, 26, 0.26)"
            : "0 6px 18px rgba(157, 134, 96, 0.09)",
        },
      }}
    />
  );
}

export default AppToaster;
