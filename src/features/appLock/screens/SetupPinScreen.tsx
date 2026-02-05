import React, { useState, useCallback } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useThemeColors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import { useAppLockStore } from "../store/appLockStore";
import { PinDots } from "../components/PinDots";
import { PinPad } from "../components/PinPad";

type SetupStep = "create" | "confirm";

export function SetupPinScreen() {
  const { isDark, get } = useThemeColors();
  const [step, setStep] = useState<SetupStep>("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState(false);

  const { pinLength, setPin: savePin, setEnabled } = useAppLockStore();

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (step === "create") {
        if (pin.length < pinLength) {
          const newPin = pin + digit;
          setPin(newPin);
          if (newPin.length === pinLength) {
            // Move to confirm step
            setTimeout(() => {
              setStep("confirm");
            }, 300);
          }
        }
      } else {
        if (confirmPin.length < pinLength) {
          const newConfirmPin = confirmPin + digit;
          setConfirmPin(newConfirmPin);
          if (newConfirmPin.length === pinLength) {
            // Verify pins match
            if (newConfirmPin === pin) {
              void (async () => {
                haptics.success();
                await savePin(pin);
                await setEnabled(true);
                Alert.alert(
                  "PIN Set",
                  "Your app is now protected with a PIN.",
                  [{ text: "OK", onPress: () => router.back() }]
                );
              })();
            } else {
              haptics.pinError();
              setError(true);
              setTimeout(() => {
                setError(false);
                setConfirmPin("");
              }, 500);
            }
          }
        }
      }
    },
    [step, pin, confirmPin, pinLength, savePin, setEnabled]
  );

  const handleDeletePress = useCallback(() => {
    if (step === "create") {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  }, [step]);

  const handleBack = () => {
    if (step === "confirm") {
      setStep("create");
      setPin("");
      setConfirmPin("");
    } else {
      router.back();
    }
  };

  const currentPin = step === "create" ? pin : confirmPin;

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: get("background") }}
      edges={["top"]}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={handleBack}
          className="p-2 rounded-xl"
          style={{
            backgroundColor: isDark ? "rgba(42, 37, 32, 0.8)" : "rgba(245, 241, 232, 0.9)",
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={get("text")} />
        </Pressable>
      </View>

      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-8">
          <View
            className="w-16 h-16 rounded-2xl items-center justify-center mb-6"
            style={{
              backgroundColor: isDark ? "rgba(91, 138, 91, 0.15)" : "rgba(91, 138, 91, 0.1)",
            }}
          >
            <Ionicons
              name={step === "create" ? "key-outline" : "checkmark-circle-outline"}
              size={32}
              color={get("primary")}
            />
          </View>

          <Text
            className="text-xl font-bold mb-2"
            style={{ color: get("text") }}
          >
            {step === "create" ? "Create PIN" : "Confirm PIN"}
          </Text>
          <Text
            className="text-sm text-center"
            style={{ color: get("textMuted") }}
          >
            {step === "create"
              ? `Enter a ${pinLength}-digit PIN`
              : "Enter your PIN again to confirm"}
          </Text>
          {error && step === "confirm" && (
            <Text
              className="text-sm mt-2"
              style={{ color: isDark ? "#ED8370" : "#E06B55" }}
            >
              PINs don&apos;t match. Try again.
            </Text>
          )}
        </View>

        <PinDots pinLength={pinLength} enteredLength={currentPin.length} error={error} />

        <PinPad
          onDigitPress={handleDigitPress}
          onDeletePress={handleDeletePress}
          disabled={error}
        />

        {/* Step indicator */}
        <View className="flex-row justify-center mt-8 gap-2">
          <View
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: get("primary"),
            }}
          />
          <View
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: step === "confirm" ? get("primary") : get("border"),
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
