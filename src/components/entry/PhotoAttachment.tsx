import React from "react";
import { View, Text, Pressable, Image, ScrollView, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, colors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

interface PhotoAttachmentProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export const PhotoAttachment: React.FC<PhotoAttachmentProps> = ({
  photos,
  onChange,
  maxPhotos = 3,
}) => {
  const { isDark, get } = useThemeColors();

  const pickImage = async () => {
    haptics.light();

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to attach photos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (photos.length >= maxPhotos) {
        Alert.alert("Maximum Photos", `You can only attach up to ${maxPhotos} photos.`);
        return;
      }
      haptics.success();
      onChange([...photos, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    haptics.light();

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (photos.length >= maxPhotos) {
        Alert.alert("Maximum Photos", `You can only attach up to ${maxPhotos} photos.`);
        return;
      }
      haptics.success();
      onChange([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    haptics.light();
    const newPhotos = photos.filter((_, i) => i !== index);
    onChange(newPhotos);
  };

  const showOptions = () => {
    Alert.alert(
      "Add Photo",
      "Choose an option",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Library", onPress: pickImage },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between mb-2">
        <Text
          className="text-sm font-semibold"
          style={{ color: get("textSubtle") }}
        >
          Photos
        </Text>
        <Text
          className="text-xs"
          style={{ color: get("textMuted") }}
        >
          {photos.length}/{maxPhotos}
        </Text>
      </View>

      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {photos.map((uri, index) => (
            <View
              key={`${uri}-${index}`}
              className="mr-3 relative"
              style={{
                shadowColor: isDark ? "#000" : colors.sand.text.light,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.3 : 0.15,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Image
                source={{ uri }}
                className="w-24 h-24 rounded-2xl"
                resizeMode="cover"
                style={{
                  borderWidth: 2,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.8)",
                }}
              />
              <Pressable
                onPress={() => removePhoto(index)}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full items-center justify-center"
                style={{
                  backgroundColor: isDark ? colors.negative.bgSelected.dark : colors.negative.bgSelected.light,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {photos.length < maxPhotos && (
        <Pressable
          onPress={showOptions}
          className="flex-row items-center justify-center py-4 rounded-2xl"
          style={{
            backgroundColor: isDark ? "rgba(91, 138, 91, 0.08)" : "rgba(91, 138, 91, 0.06)",
            borderWidth: 1.5,
            borderColor: isDark ? "rgba(168, 197, 168, 0.3)" : "rgba(91, 138, 91, 0.25)",
            borderStyle: "dashed",
          }}
        >
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: get("primaryBg") }}
          >
            <Ionicons
              name="camera"
              size={20}
              color={get("primary")}
            />
          </View>
          <View>
            <Text
              className="text-sm font-semibold"
              style={{ color: get("primary") }}
            >
              Add Photo
            </Text>
            <Text
              className="text-xs"
              style={{ color: get("textMuted") }}
            >
              Capture this moment
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
};

export default PhotoAttachment;
