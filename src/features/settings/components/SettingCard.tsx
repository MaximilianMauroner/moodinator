import React from "react";
import { View } from "react-native";
import { styles } from "../styles";

export function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
      style={styles.cardShadow}
    >
      {children}
    </View>
  );
}

