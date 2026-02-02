import React from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createScreenErrorFallback } from "@/components/ScreenErrorFallback";
import { InsightsScreen } from "@/features/insights";

const ChartsErrorFallback = createScreenErrorFallback("Insights");

export default function ChartsScreen() {
  return (
    <ErrorBoundary FallbackComponent={ChartsErrorFallback}>
      <InsightsScreen />
    </ErrorBoundary>
  );
}
