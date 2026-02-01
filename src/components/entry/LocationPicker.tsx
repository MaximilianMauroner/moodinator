import React, { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import * as ExpoLocation from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, colors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";
import type { Location } from "@db/types";

interface LocationPickerProps {
  location: Location | null;
  onChange: (location: Location | null) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  location,
  onChange,
}) => {
  const { isDark, get } = useThemeColors();
  const [loading, setLoading] = useState(false);

  const captureLocation = async () => {
    haptics.light();
    setLoading(true);

    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your location to tag your mood entry."
        );
        setLoading(false);
        return;
      }

      const currentLocation = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });

      // Try to get a human-readable address
      let locationName: string | undefined;
      try {
        const [address] = await ExpoLocation.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        if (address) {
          const parts = [
            address.name,
            address.city,
            address.region,
          ].filter(Boolean);
          locationName = parts.join(", ") || undefined;
        }
      } catch {
        // If reverse geocoding fails, just use coordinates
      }

      haptics.success();
      onChange({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        name: locationName,
      });
    } catch (error) {
      haptics.error();
      Alert.alert("Error", "Unable to get your location. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearLocation = () => {
    haptics.light();
    onChange(null);
  };

  return (
    <View className="mb-6">
      <Text
        className="text-sm font-semibold mb-2"
        style={{ color: get("textSubtle") }}
      >
        Location
      </Text>

      {location ? (
        <View
          className="flex-row items-center justify-between p-3 rounded-2xl"
          style={{
            backgroundColor: get("surface"),
            borderWidth: 1.5,
            borderColor: isDark ? colors.sand.border.dark : colors.sand.border.light,
            shadowColor: isDark ? "#000" : colors.sand.text.light,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.15 : 0.08,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light }}
            >
              <Ionicons name="location" size={18} color={isDark ? colors.sand.text.dark : colors.sand.text.light} />
            </View>
            <View className="flex-1">
              {location.name ? (
                <Text
                  className="text-sm font-medium"
                  style={{ color: get("text") }}
                  numberOfLines={1}
                >
                  {location.name}
                </Text>
              ) : (
                <Text
                  className="text-xs"
                  style={{ color: get("textMuted") }}
                >
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
              )}
            </View>
          </View>
          <Pressable
            onPress={clearLocation}
            className="p-2"
          >
            <Ionicons name="close-circle" size={20} color={get("textMuted")} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={captureLocation}
          disabled={loading}
          className="flex-row items-center justify-center py-4 rounded-2xl"
          style={{
            backgroundColor: isDark ? "rgba(157, 134, 96, 0.08)" : "rgba(157, 134, 96, 0.06)",
            borderWidth: 1.5,
            borderColor: isDark ? "rgba(212, 196, 160, 0.3)" : "rgba(157, 134, 96, 0.25)",
            borderStyle: "dashed",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={get("textMuted")} />
          ) : (
            <>
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light }}
              >
                <Ionicons
                  name="location"
                  size={20}
                  color={isDark ? colors.sand.text.dark : colors.sand.text.light}
                />
              </View>
              <View>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
                >
                  Add Location
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: get("textMuted") }}
                >
                  Where are you right now?
                </Text>
              </View>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
};

export default LocationPicker;
