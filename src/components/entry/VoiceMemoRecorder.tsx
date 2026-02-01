import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
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

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

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
    <View className="mb-6">
      <View className="flex-row items-center justify-between mb-2">
        <Text
          className="text-sm font-semibold"
          style={{ color: get("textSubtle") }}
        >
          Voice Memos
        </Text>
        <Text
          className="text-xs"
          style={{ color: get("textMuted") }}
        >
          {memos.length}/{maxMemos}
        </Text>
      </View>

      {memos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {memos.map((uri, index) => (
            <View
              key={`${uri}-${index}`}
              className="mr-3 flex-row items-center px-4 py-3 rounded-2xl"
              style={{
                backgroundColor: playingIndex === index
                  ? (isDark ? colors.neutral.bg.dark : colors.neutral.bg.light)
                  : get("surface"),
                borderWidth: 1.5,
                borderColor: playingIndex === index
                  ? (isDark ? colors.neutral.border.dark : colors.neutral.border.light)
                  : get("border"),
                shadowColor: isDark ? "#000" : colors.sand.text.light,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.2 : 0.08,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <Pressable
                onPress={() => playMemo(uri, index)}
                className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                style={{
                  backgroundColor: playingIndex === index
                    ? get("primary")
                    : (isDark ? colors.neutral.bg.dark : colors.neutral.bg.light),
                }}
              >
                <Ionicons
                  name={playingIndex === index ? "pause" : "play"}
                  size={18}
                  color={playingIndex === index ? "#FFFFFF" : (isDark ? colors.neutral.text.dark : colors.neutral.text.light)}
                />
              </Pressable>
              <View className="mr-3">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: get("text") }}
                >
                  Memo {index + 1}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: get("textMuted") }}
                >
                  {playingIndex === index ? "Playing..." : "Tap to play"}
                </Text>
              </View>
              <Pressable
                onPress={() => removeMemo(index)}
                className="p-1"
              >
                <Ionicons name="trash-outline" size={18} color={isDark ? colors.negative.text.dark : colors.negative.text.light} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {memos.length < maxMemos && (
        <Pressable
          onPress={isRecording ? stopRecording : startRecording}
          className="flex-row items-center justify-center py-4 rounded-2xl"
          style={{
            backgroundColor: isRecording
              ? (isDark ? colors.negative.bg.dark : colors.negative.bg.light)
              : (isDark ? "rgba(105, 92, 120, 0.08)" : "rgba(105, 92, 120, 0.06)"),
            borderWidth: 1.5,
            borderColor: isRecording
              ? (isDark ? colors.negative.text.dark : colors.negative.text.light)
              : (isDark ? "rgba(196, 187, 207, 0.3)" : "rgba(105, 92, 120, 0.25)"),
            borderStyle: isRecording ? "solid" : "dashed",
          }}
        >
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{
              backgroundColor: isRecording
                ? (isDark ? "rgba(224, 107, 85, 0.2)" : "rgba(224, 107, 85, 0.15)")
                : (isDark ? colors.neutral.bg.dark : colors.neutral.bg.light),
            }}
          >
            <Ionicons
              name={isRecording ? "stop" : "mic"}
              size={20}
              color={isRecording
                ? (isDark ? colors.negative.text.dark : colors.negative.text.light)
                : (isDark ? colors.neutral.text.dark : colors.neutral.text.light)
              }
            />
          </View>
          <View>
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
              {isRecording ? "Tap to save your thoughts" : "Speak your mind freely"}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
};

export default VoiceMemoRecorder;
