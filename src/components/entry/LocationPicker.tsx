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
    <View>
      {/* Section label */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View
            className="w-6 h-6 rounded-md items-center justify-center mr-2"
            style={{
              backgroundColor: isDark ? "rgba(157, 134, 96, 0.15)" : "rgba(157, 134, 96, 0.1)",
            }}
          >
            <Ionicons
              name="location"
              size={12}
              color={isDark ? colors.sand.text.dark : colors.sand.text.light}
            />
          </View>
          <Text
            className="text-sm font-medium"
            style={{ color: get("text") }}
          >
            Location
          </Text>
        </View>
        {location && (
          <Pressable
            onPress={clearLocation}
            className="flex-row items-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              className="text-xs font-medium mr-1"
              style={{ color: get("textMuted") }}
            >
              Clear
            </Text>
            <Ionicons name="close-circle" size={14} color={get("textMuted")} />
          </Pressable>
        )}
      </View>

      {location ? (
        // Location captured - show the result
        <View
          className="flex-row items-center p-3 rounded-xl"
          style={{
            backgroundColor: isDark ? "rgba(48, 42, 34, 0.6)" : "rgba(253, 252, 250, 0.9)",
            borderWidth: 1.5,
            borderColor: isDark ? colors.sand.border.dark : colors.sand.border.light,
          }}
        >
          <View
            className="w-9 h-9 rounded-lg items-center justify-center mr-3"
            style={{ backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light }}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={isDark ? colors.positive.text.dark : colors.positive.text.light}
            />
          </View>
          <View className="flex-1">
            {location.name ? (
              <>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: get("text") }}
                  numberOfLines={1}
                >
                  {location.name}
                </Text>
                <Text
                  className="text-[10px]"
                  style={{ color: get("textMuted") }}
                >
                  Location captured
                </Text>
              </>
            ) : (
              <>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: get("text") }}
                >
                  Location captured
                </Text>
                <Text
                  className="text-[10px]"
                  style={{ color: get("textMuted") }}
                >
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
              </>
            )}
          </View>
        </View>
      ) : (
        // No location - show capture button
        <Pressable
          onPress={captureLocation}
          disabled={loading}
          className="flex-row items-center py-3 px-4 rounded-xl"
          style={{
            backgroundColor: isDark ? "rgba(157, 134, 96, 0.08)" : "rgba(157, 134, 96, 0.06)",
            borderWidth: 1.5,
            borderColor: isDark ? "rgba(212, 196, 160, 0.25)" : "rgba(157, 134, 96, 0.2)",
            borderStyle: "dashed",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <>
              <View className="w-9 h-9 items-center justify-center mr-3">
                <ActivityIndicator
                  size="small"
                  color={isDark ? colors.sand.text.dark : colors.sand.text.light}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: isDark ? colors.sand.text.dark : colors.sand.text.light }}
                >
                  Getting Location...
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: get("textMuted") }}
                >
                  Please wait
                </Text>
              </View>
            </>
          ) : (
            <>
              <View
                className="w-9 h-9 rounded-lg items-center justify-center mr-3"
                style={{ backgroundColor: isDark ? colors.sand.bgHover.dark : colors.sand.bg.light }}
              >
                <Ionicons
                  name="navigate"
                  size={18}
                  color={isDark ? colors.sand.text.dark : colors.sand.text.light}
                />
              </View>
              <View className="flex-1">
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
                  Tag where you are right now
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={get("textMuted")}
              />
            </>
          )}
        </Pressable>
      )}
    </View>
  );
};

export default LocationPicker;
