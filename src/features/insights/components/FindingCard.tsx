import React from "react";
import { Text } from "react-native";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Finding } from "../utils/findings";
import { ComparisonBars } from "./DriverRow";
export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <SurfaceCard
      tone={finding.effect === null ? "sand" : "sage"}
      style={{ marginBottom: 12 }}
    >
      <Text className="text-base font-semibold text-paper-800 dark:text-paper-200">
        {finding.text}
      </Text>
      <Text className="mt-2 text-sm text-paper-700 dark:text-sand-300">
        {finding.sample}
      </Text>
      {finding.means && (
        <>
          <ComparisonBars means={finding.means} />
          <Text className="mt-2 text-xs text-paper-700 dark:text-sand-300">
            Compared group above · remaining entries below. Lower is better.
          </Text>
        </>
      )}
    </SurfaceCard>
  );
}
