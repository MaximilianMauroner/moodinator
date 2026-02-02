import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, Alert, ScrollView, Animated } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, colors } from "@/constants/colors";
import { haptics } from "@/lib/haptics";

interface VoiceMemoRecorderProps {
  memos: string[];
  onChange: (memos: string[]) => void;
  maxMemos?: number;
}

export const VoiceMemoRecorder: React.FC<VoiceMemoRecorderProps> = ({
  memos,
  onChange,
  maxMemos = 3,
}) => {
  const { isDark, get } = useThemeColors();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const startRecording = async () => {
    if (memos.length >= maxMemos) {
      Alert.alert("Maximum Memos", `You can only record up to ${maxMemos} voice memos.`);
      return;
    }

    haptics.light();

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your microphone to record voice memos."
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      haptics.error();
      Alert.alert("Error", "Unable to start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    haptics.success();
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      if (uri) {
        onChange([...memos, uri]);
      }

      setRecording(null);
    } catch (error) {
      haptics.error();
      Alert.alert("Error", "Unable to save recording. Please try again.");
    }
  };

  const playMemo = async (uri: string, index: number) => {
    haptics.light();

    try {
      // Stop any currently playing sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      if (playingIndex === index) {
        setPlayingIndex(null);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingIndex(index);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingIndex(null);
        }
      });
    } catch (error) {
      haptics.error();
      Alert.alert("Error", "Unable to play voice memo.");
    }
  };

  const removeMemo = (index: number) => {
    haptics.light();
    const newMemos = memos.filter((_, i) => i !== index);
    onChange(newMemos);
    if (playingIndex === index) {
      setPlayingIndex(null);
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    }
  };

  return (
    <View>
      {/* Section label */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View
            className="w-6 h-6 rounded-md items-center justify-center mr-2"
            style={{
              backgroundColor: isDark ? "rgba(105, 92, 120, 0.15)" : "rgba(105, 92, 120, 0.1)",
            }}
          >
            <Ionicons
              name="mic"
              size={12}
              color={isDark ? colors.neutral.text.dark : colors.neutral.text.light}
            />
          </View>
          <Text
            className="text-sm font-medium"
            style={{ color: get("text") }}
          >
            Voice Memos
          </Text>
        </View>
        <Text
          className="text-xs font-medium"
          style={{ color: get("textMuted") }}
        >
          {memos.length}/{maxMemos}
        </Text>
      </View>

      {/* Recorded memos */}
      {memos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {memos.map((uri, index) => {
            const isPlaying = playingIndex === index;
            return (
              <Pressable
                key={`${uri}-${index}`}
                onPress={() => playMemo(uri, index)}
                className="mr-3 flex-row items-center px-3 py-2.5 rounded-xl"
                style={{
                  backgroundColor: isPlaying
                    ? (isDark ? colors.neutral.bg.dark : colors.neutral.bg.light)
                    : (isDark ? "rgba(48, 42, 34, 0.6)" : "rgba(253, 252, 250, 0.9)"),
                  borderWidth: 1.5,
                  borderColor: isPlaying
                    ? (isDark ? colors.neutral.border.dark : colors.neutral.border.light)
                    : (isDark ? "rgba(61, 53, 42, 0.4)" : "rgba(229, 217, 191, 0.5)"),
                  shadowColor: isDark ? "#000" : colors.sand.text.light,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.15 : 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-2.5"
                  style={{
                    backgroundColor: isPlaying
                      ? get("primary")
                      : (isDark ? colors.neutral.bg.dark : colors.neutral.bg.light),
                  }}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={14}
                    color={isPlaying ? "#FFFFFF" : (isDark ? colors.neutral.text.dark : colors.neutral.text.light)}
                  />
                </View>
                <View className="mr-2">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: get("text") }}
                  >
                    Memo {index + 1}
                  </Text>
                  <Text
                    className="text-[10px]"
                    style={{ color: get("textMuted") }}
                  >
                    {isPlaying ? "Playing..." : "Tap to play"}
                  </Text>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    removeMemo(index);
                  }}
                  className="p-1.5 -mr-1"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={isDark ? colors.negative.text.dark : colors.negative.text.light}
                  />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Record button */}
      {memos.length < maxMemos && (
        <Pressable
          onPress={isRecording ? stopRecording : startRecording}
          className="flex-row items-center py-3 px-4 rounded-xl"
          style={{
            backgroundColor: isRecording
              ? (isDark ? colors.negative.bg.dark : colors.negative.bg.light)
              : (isDark ? "rgba(105, 92, 120, 0.08)" : "rgba(105, 92, 120, 0.06)"),
            borderWidth: 1.5,
            borderColor: isRecording
              ? (isDark ? colors.negative.text.dark : colors.negative.text.light)
              : (isDark ? "rgba(196, 187, 207, 0.25)" : "rgba(105, 92, 120, 0.2)"),
            borderStyle: isRecording ? "solid" : "dashed",
          }}
        >
          <Animated.View
            className="w-9 h-9 rounded-lg items-center justify-center mr-3"
            style={{
              backgroundColor: isRecording
                ? (isDark ? "rgba(224, 107, 85, 0.2)" : "rgba(224, 107, 85, 0.15)")
                : (isDark ? colors.neutral.bg.dark : colors.neutral.bg.light),
              transform: [{ scale: pulseAnim }],
            }}
          >
            <Ionicons
              name={isRecording ? "stop" : "mic"}
              size={18}
              color={isRecording
                ? (isDark ? colors.negative.text.dark : colors.negative.text.light)
                : (isDark ? colors.neutral.text.dark : colors.neutral.text.light)
              }
            />
          </Animated.View>
          <View className="flex-1">
            <Text
              className="text-sm font-semibold"
              style={{
                color: isRecording
                  ? (isDark ? colors.negative.text.dark : colors.negative.text.light)
                  : (isDark ? colors.neutral.text.dark : colors.neutral.text.light),
              }}
            >
              {isRecording ? "Stop Recording" : "Record Voice Memo"}
            </Text>
            <Text
              className="text-xs"
              style={{ color: get("textMuted") }}
            >
              {isRecording ? "Tap to save your recording" : "Capture your thoughts verbally"}
            </Text>
          </View>
          {isRecording && (
            <View
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: isDark ? colors.negative.text.dark : colors.negative.text.light }}
            />
          )}
        </Pressable>
      )}
    </View>
  );
};

export default VoiceMemoRecorder;
