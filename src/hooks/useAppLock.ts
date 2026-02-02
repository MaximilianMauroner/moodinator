/**
 * useAppLock Hook
 * Manages app lock state and authentication flow
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { useSettingsStore } from "@/shared/state/settingsStore";

export interface UseAppLockReturn {
  isLocked: boolean;
  isLoading: boolean;
  unlock: () => void;
}

/**
 * Hook to manage app lock state
 * - Locks app on cold start if enabled
 * - Locks app when returning from background if enabled
 */
export function useAppLock(): UseAppLockReturn {
  const appLockEnabled = useSettingsStore((state) => state.appLockEnabled);
  const hydrated = useSettingsStore((state) => state.hydrated);

  const [isLocked, setIsLocked] = useState(true); // Start locked
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const hasAuthenticatedOnce = useRef(false);

  // Check if biometrics are available
  const checkBiometricAvailability = useCallback(async (): Promise<boolean> => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return false;

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled;
    } catch {
      return false;
    }
  }, []);

  // Initial setup
  useEffect(() => {
    const initialize = async () => {
      if (!hydrated) return;

      // If app lock is not enabled, unlock immediately
      if (!appLockEnabled) {
        setIsLocked(false);
        setIsLoading(false);
        return;
      }

      // Check if biometrics are available
      const biometricsAvailable = await checkBiometricAvailability();

      if (!biometricsAvailable) {
        // If biometrics aren't available but lock is enabled,
        // we still show as locked (user needs to fix in settings)
        setIsLoading(false);
        return;
      }

      // App lock is enabled and biometrics available - stay locked
      setIsLoading(false);
    };

    initialize();
  }, [hydrated, appLockEnabled, checkBiometricAvailability]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      // App coming to foreground from background
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // Lock if enabled and has authenticated at least once
        if (appLockEnabled && hasAuthenticatedOnce.current) {
          setIsLocked(true);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [appLockEnabled]);

  // Unlock handler
  const unlock = useCallback(() => {
    hasAuthenticatedOnce.current = true;
    setIsLocked(false);
  }, []);

  // If not hydrated yet, show as loading
  if (!hydrated) {
    return {
      isLocked: true,
      isLoading: true,
      unlock,
    };
  }

  // If app lock is disabled, never show locked
  if (!appLockEnabled) {
    return {
      isLocked: false,
      isLoading: false,
      unlock,
    };
  }

  return {
    isLocked,
    isLoading,
    unlock,
  };
}

export default useAppLock;
