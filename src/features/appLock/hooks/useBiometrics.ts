import { useState, useEffect, useCallback } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { AppState, Platform } from "react-native";

export type BiometricType = "fingerprint" | "facial" | "iris" | "none";

export function isStrongBiometricLevel(
  platform: typeof Platform.OS,
  securityLevel: LocalAuthentication.SecurityLevel
): boolean {
  return platform !== "android"
    || securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
}

export function useBiometrics() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [isEnrolled, setIsEnrolled] = useState(false);

  const checkBiometrics = useCallback(async () => {
    setIsChecking(true);
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();

      if (!compatible) {
        setIsAvailable(false);
        setIsEnrolled(false);
        setBiometricType("none");
        return;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const securityLevel = enrolled
        ? await LocalAuthentication.getEnrolledLevelAsync()
        : LocalAuthentication.SecurityLevel.NONE;
      const strongEnough = isStrongBiometricLevel(Platform.OS, securityLevel);
      setIsAvailable(strongEnough);
      setIsEnrolled(enrolled && strongEnough);

      if (!enrolled || !strongEnough) {
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
    } finally {
      setIsChecking(false);
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
        biometricsSecurityLevel: "strong",
      });

      return result.success;
    } catch (error) {
      console.error("Biometric authentication error:", error);
      return false;
    }
  }, [isAvailable, isEnrolled]);

  const getBiometricLabel = (): string => {
    if (biometricType === "facial") {
      return Platform.OS === "ios" ? "Face ID" : "Face recognition";
    }
    if (biometricType === "fingerprint") return "Fingerprint";
    if (biometricType === "iris") return "Iris";
    return "Biometrics";
  };

  const getBiometricIcon = (): string => {
    if (biometricType === "facial") {
      return Platform.OS === "ios" ? "scan" : "happy-outline";
    }
    return "finger-print";
  };

  return {
    isChecking,
    isAvailable,
    isEnrolled,
    biometricType,
    authenticate,
    checkBiometrics,
    getBiometricLabel,
    getBiometricIcon,
  };
}
