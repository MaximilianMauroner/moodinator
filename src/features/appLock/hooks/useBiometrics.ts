import { useState, useEffect, useCallback } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export type BiometricType = "fingerprint" | "facial" | "iris" | "none";

export function useBiometrics() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsAvailable(compatible);

      if (compatible) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsEnrolled(enrolled);

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("facial");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType("fingerprint");
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType("iris");
        }
      }
    } catch (error) {
      console.error("Error checking biometrics:", error);
    }
  };

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
    if (Platform.OS === "ios") {
      return biometricType === "facial" ? "Face ID" : "Touch ID";
    }
    return biometricType === "facial" ? "Face Unlock" : "Fingerprint";
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
    getBiometricLabel,
    getBiometricIcon,
  };
}
