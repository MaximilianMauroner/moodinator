import React from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";

interface Props {
  visible: boolean;
  noteText: string;
  setNoteText: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export const NoteModal: React.FC<Props> = ({
  visible,
  noteText,
  setNoteText,
  onCancel,
  onSave,
}) => {
  const screenWidth = Dimensions.get("window").width;
  const modalWidth = Math.min(screenWidth - 32, 380);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-4">
          <View
            className="bg-white rounded-3xl shadow-2xl overflow-hidden"
            style={{ width: modalWidth }}
          >
            {/* Header */}
            <View className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 pb-4">
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-white text-xl font-bold mb-1">
                    Add Note
                  </Text>
                  <Text className="text-purple-100 text-sm">
                    Capture your thoughts and feelings
                  </Text>
                </View>
                <Pressable
                  onPress={onCancel}
                  className="bg-white/20 rounded-full p-2"
                >
                  <IconSymbol name="xmark" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* Content */}
            <View className="p-6">
              {/* Note Input Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <IconSymbol name="note.text" size={16} color="#6B7280" />
                  <Text className="text-gray-700 font-semibold ml-2">
                    Your Note
                  </Text>
                </View>

                <View className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 min-h-[120px]">
                  <TextInput
                    className="text-gray-800 text-base leading-6"
                    multiline
                    numberOfLines={6}
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="What's on your mind? Share your thoughts, what triggered this mood, or anything you'd like to remember..."
                    placeholderTextColor="#9CA3AF"
                    autoFocus
                    textAlignVertical="top"
                    style={{
                      minHeight: 100,
                      fontSize: 16,
                      lineHeight: 24,
                    }}
                  />
                </View>

                <View className="flex-row justify-between items-center mt-2">
                  <Text className="text-gray-400 text-xs">
                    💡 Tip: Notes help you track patterns over time
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {noteText.length}/500
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row space-x-3">
                <Pressable
                  onPress={onCancel}
                  className="flex-1 bg-gray-100 py-4 rounded-xl border border-gray-200"
                >
                  <Text className="text-center font-semibold text-gray-700">
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onSave}
                  className="flex-1 bg-purple-600 py-4 rounded-xl shadow-sm"
                  disabled={!noteText.trim()}
                  style={{
                    opacity: noteText.trim() ? 1 : 0.6,
                  }}
                >
                  <Text className="text-center font-semibold text-white">
                    Save Note
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
