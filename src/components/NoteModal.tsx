import React from "react";
import { View, Text, Modal, TextInput, Pressable } from "react-native";

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
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-2xl w-[90%] m-4 shadow-xl">
          <Text className="text-xl font-bold mb-4 text-blue-800">Add Note</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-4 mb-4 text-base"
            multiline
            numberOfLines={4}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Enter your note here..."
            autoFocus
          />
          <View className="flex-row justify-end space-x-3">
            <Pressable
              className="bg-gray-100 px-6 py-3 rounded-xl"
              onPress={onCancel}
            >
              <Text className="text-gray-600 font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              className="bg-blue-500 px-6 py-3 rounded-xl"
              onPress={onSave}
            >
              <Text className="text-white font-medium">Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
