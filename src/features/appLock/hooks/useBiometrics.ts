import { useState, useEffect, useCallback } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { AppState, Platform } from "react-native";

export type BiometricType = "fingerprint" | "facial" | "iris" | "none";

export function useBiometrics() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [isEnrolled, setIsEnrolled] = useState(false);

  const checkBiometrics = useCallback(async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsAvailable(compatible);

      if (!compatible) {
        setIsEnrolled(false);
        setBiometricType("none");
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsEnrolled(enrolled);

      if (!enrolled) {
        setBiometricType("none");
        return;
      }

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType("facial");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("fingerprint");
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricType("iris");
      } else {
        setBiometricType("none");
      }
    } catch (error) {
      console.error("Error checking biometrics:", error);
      setIsAvailable(false);
      setIsEnrolled(false);
      setBiometricType("none");
    }
  }, []);

  useEffect(() => {
    void checkBiometrics();
  }, [checkBiometrics]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        void checkBiometrics();
      }
    });

    return () => subscription.remove();
  }, [checkBiometrics]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isAvailable || !isEnrolled) {
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Moodinator",
        cancelLabel: "Use PIN",
        disableDeviceFallback: true,
        fallbackLabel: "Use PIN",
      });

      return result.success;
    } catch (error) {
      console.error("Biometric authentication error:", error);
      return false;
    }
  }, [isAvailable, isEnrolled]);

  const getBiometricLabel = (): string => {
    return "Biometrics";
  };

  const getBiometricIcon = (): string => {
    if (biometricType === "facial") {
      return Platform.OS === "ios" ? "scan" : "happy-outline";
    }
    return "finger-print";
  };

  return {
    isAvailable,
    isEnrolled,
    biometricType,
    authenticate,
    checkBiometrics,
    getBiometricLabel,
    getBiometricIcon,
  };
}
