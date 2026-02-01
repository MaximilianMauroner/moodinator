import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  SafeAreaView,
  Animated,
} from "react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { haptics } from "@/lib/haptics";

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
  const [isFocused, setIsFocused] = useState(false);

  const slideAnim = useRef(new Animated.Value(300)).current;

  const handleCancel = () => {
    haptics.light();
    onCancel();
  };

  const handleSave = () => {
    haptics.light();
    onSave();
  };

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible]);

  return (
    <SafeAreaView>
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={onCancel}
        statusBarTranslucent
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-4">
          <Animated.View
            style={{ transform: [{ translateY: slideAnim }], width: "100%" }}
          >
            <View className="bg-white dark:bg-slate-900 p-8 rounded-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700">
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-xl font-bold text-blue-800 dark:text-blue-200 flex-1 text-center">
                  Add Note
                </Text>
                <Pressable
                  onPress={handleCancel}
                  className="p-2 rounded-full active:bg-gray-100 dark:active:bg-slate-700"
                >
                  <IconSymbol name="xmark" size={20} color="#6b7280" />
                </Pressable>
              </View>
              <View className="mb-6">
                <TextInput
                  className={`border-2 rounded-2xl mb-2 text-base text-slate-900 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 ${
                    isFocused
                      ? "border-blue-500 dark:border-blue-400"
                      : "border-gray-300 dark:border-slate-600"
                  }`}
                  style={{
                    minHeight: 140,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                  }}
                  multiline
                  numberOfLines={6}
                  maxLength={300}
                  value={noteText}
                  onChangeText={setNoteText}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="What's on your mind?"
                  placeholderTextColor="#94a3b8"
                  autoFocus
                  textAlignVertical="top"
                />
                <Text className="text-xs text-gray-500 dark:text-slate-400 text-right mt-1">
                  {noteText.length}/300
                </Text>
              </View>
              <View className="flex-row justify-end">
                <Pressable
                  style={{
                    marginRight: 16,
                    minWidth: 88,
                    justifyContent: "center",
                  }}
                  className="flex-row items-center bg-gray-100 dark:bg-slate-800 px-4 py-3 rounded-xl active:bg-gray-200 dark:active:bg-slate-700"
                  onPress={handleCancel}
                >
                  <IconSymbol
                    name="xmark"
                    size={16}
                    color="#6b7280"
                    style={{ marginRight: 6 }}
                  />
                  <Text className="text-gray-700 dark:text-slate-200 font-medium">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={{ minWidth: 88, justifyContent: "center" }}
                  className="flex-row items-center bg-blue-600 px-4 py-3 rounded-xl active:bg-blue-700"
                  onPress={handleSave}
                >
                  <IconSymbol
                    name="checkmark"
                    size={16}
                    color="#ffffff"
                    style={{ marginRight: 6 }}
                  />
                  <Text className="text-white font-semibold">Save</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
