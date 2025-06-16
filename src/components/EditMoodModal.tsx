import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";
import { getColorFromTailwind } from "@/components/charts/ChartComponents";

interface Props {
  visible: boolean;
  mood: MoodEntry | null;
  noteText: string;
  setNoteText: (text: string) => void;
  onClose: () => void;
  onSaveNote: () => void;
  onSaveTime: (moodId: number, newTimestamp: number) => void;
}

export const EditMoodModal: React.FC<Props> = ({
  visible,
  mood,
  noteText,
  setNoteText,
  onClose,
  onSaveNote,
  onSaveTime,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"note" | "time">("note");

  useEffect(() => {
    if (mood) {
      setSelectedDate(new Date(mood.timestamp));
    }
  }, [mood]);

  const handleDateChange = (event: any, date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    if (time) {
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(time.getHours());
      newDateTime.setMinutes(time.getMinutes());
      setSelectedDate(newDateTime);
    }
  };

  const handleSaveTime = () => {
    if (mood && mood.id !== -1) {
      onSaveTime(mood.id, selectedDate.getTime());
    }
  };

  const handleSaveNote = () => {
    onSaveNote();
  };

  if (!visible) return null;

  if (!mood) {
    return (
      <Modal transparent visible={visible} animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{ backgroundColor: "white", padding: 20, borderRadius: 10 }}
          >
            <Text style={{ color: "black", fontSize: 16 }}>
              No mood data available
            </Text>
            <Pressable
              onPress={onClose}
              style={{
                marginTop: 10,
                backgroundColor: "#4F46E5",
                padding: 10,
                borderRadius: 5,
              }}
            >
              <Text style={{ color: "white", textAlign: "center" }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 24,
            padding: 0,
            width: "100%",
            maxWidth: 420,
            maxHeight: "85%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 25,
          }}
        >
          {/* Header */}
          <View
            style={{
              backgroundColor: "#4F46E5",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: "white",
                    marginBottom: 4,
                  }}
                >
                  Edit Mood Entry
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "rgba(255, 255, 255, 0.9)",
                  }}
                >
                  Modify your note and timing
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  borderRadius: 20,
                  padding: 8,
                  marginLeft: 16,
                }}
              >
                <Text
                  style={{ fontSize: 16, color: "white", fontWeight: "bold" }}
                >
                  ✕
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Tab Navigation */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#F8FAFC",
              marginHorizontal: 20,
              marginTop: 20,
              borderRadius: 12,
              padding: 4,
            }}
          >
            <Pressable
              onPress={() => setActiveTab("note")}
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor:
                  activeTab === "note" ? "#4F46E5" : "transparent",
                borderRadius: 8,
                shadowColor: activeTab === "note" ? "#4F46E5" : "transparent",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: activeTab === "note" ? 3 : 0,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "600",
                  fontSize: 15,
                  color: activeTab === "note" ? "white" : "#64748B",
                }}
              >
                📝 Note
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("time")}
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor:
                  activeTab === "time" ? "#4F46E5" : "transparent",
                borderRadius: 8,
                shadowColor: activeTab === "time" ? "#4F46E5" : "transparent",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: activeTab === "time" ? 3 : 0,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "600",
                  fontSize: 15,
                  color: activeTab === "time" ? "white" : "#64748B",
                }}
              >
                🕒 Time
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
            {activeTab === "note" ? (
              <View>
                {/* Mood Display Card */}
                <View
                  style={{
                    backgroundColor: "#F8FAFC",
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          mood?.mood !== undefined
                            ? getColorFromTailwind(
                                moodScale.find((m) => m.value === mood.mood)
                                  ?.color || "text-gray-500"
                              )
                            : getColorFromTailwind("text-gray-500"),
                        marginRight: 12,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Mood Entry
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 24,
                        marginRight: 12,
                      }}
                    >
                      {mood?.mood !== undefined
                        ? mood.mood === 0
                          ? "🤩"
                          : mood.mood <= 2
                          ? "�"
                          : mood.mood <= 4
                          ? "🙂"
                          : mood.mood === 5
                          ? "�"
                          : mood.mood <= 7
                          ? "😔"
                          : "😢"
                        : "❓"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "bold",
                        color: "#1F2937",
                      }}
                    >
                      Mood:
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "bold",
                        color:
                          mood?.mood !== undefined
                            ? getColorFromTailwind(
                                moodScale.find((m) => m.value === mood.mood)
                                  ?.color || "text-gray-500"
                              )
                            : getColorFromTailwind("text-gray-500"),
                        marginLeft: 4,
                      }}
                    >
                      {mood?.mood !== undefined
                        ? moodScale.find((m) => m.value === mood.mood)?.label ||
                          "Unknown"
                        : "Unknown"}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                    }}
                  >
                    {new Date(mood?.timestamp || Date.now()).toLocaleString()}
                  </Text>
                </View>

                {/* Note Section Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                      marginLeft: 4,
                    }}
                  >
                    📝 Your Note
                  </Text>
                </View>

                <TextInput
                  multiline
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="What's on your mind? Share your thoughts, what triggered this mood, or anything you'd like to remember..."
                  placeholderTextColor="#9CA3AF"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderWidth: 2,
                    borderColor: "#E5E7EB",
                    borderRadius: 12,
                    padding: 16,
                    minHeight: 120,
                    maxHeight: 200,
                    fontSize: 15,
                    lineHeight: 22,
                    color: "#1F2937",
                    textAlignVertical: "top",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                  onFocus={(e) => {
                    e.target.setNativeProps({
                      style: { borderColor: "#4F46E5", borderWidth: 2 },
                    });
                  }}
                  onBlur={(e) => {
                    e.target.setNativeProps({
                      style: { borderColor: "#E2E8F0", borderWidth: 2 },
                    });
                  }}
                />

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  <Text style={{ color: "#64748B", fontSize: 13 }}>
                    💡 Notes help you track patterns over time
                  </Text>
                  <Text style={{ color: "#94A3B8", fontSize: 13 }}>
                    {noteText.length}/500
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                {/* Mood Display Card */}
                <View
                  style={{
                    backgroundColor: "#F8FAFC",
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          mood?.mood !== undefined
                            ? getColorFromTailwind(
                                moodScale.find((m) => m.value === mood.mood)
                                  ?.color || "text-gray-500"
                              )
                            : getColorFromTailwind("text-gray-500"),
                        marginRight: 12,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Current Date & Time
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color: "#1F2937",
                    }}
                  >
                    {selectedDate.toLocaleString()}
                  </Text>
                </View>

                {/* Date & Time Section Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#374151",
                      marginLeft: 4,
                    }}
                  >
                    🕒 Adjust Time
                  </Text>
                </View>

                {/* Date Picker */}
                <View
                  style={{
                    marginBottom: 20,
                    borderRadius: 20,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 2,
                    borderColor: "#4F46E5",
                    overflow: "hidden",
                    shadowColor: "#4F46E5",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "#4F46E5",
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      📅 Select Date
                    </Text>
                  </View>
                  <View style={{ backgroundColor: "#FAFBFC", padding: 8 }}>
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="default"
                      onChange={handleDateChange}
                    />
                  </View>
                </View>

                {/* Time Picker */}
                <View
                  style={{
                    marginBottom: 20,
                    borderRadius: 20,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 2,
                    borderColor: "#4F46E5",
                    overflow: "hidden",
                    shadowColor: "#4F46E5",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "#4F46E5",
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      🕒 Select Time
                    </Text>
                  </View>
                  <View style={{ backgroundColor: "#FAFBFC", padding: 8 }}>
                    <DateTimePicker
                      value={selectedDate}
                      mode="time"
                      display="default"
                      onChange={handleTimeChange}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingBottom: 24,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: "#F1F5F9",
            }}
          >
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  backgroundColor: "#F8FAFC",
                  paddingVertical: 16,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: "#E2E8F0",
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontWeight: "600",
                    color: "#64748B",
                    fontSize: 16,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (activeTab === "note") {
                    handleSaveNote();
                  } else {
                    handleSaveTime();
                  }
                  onClose();
                }}
                disabled={activeTab === "note" && !noteText.trim()}
                style={{
                  flex: 1,
                  backgroundColor:
                    activeTab === "note" && !noteText.trim()
                      ? "#CBD5E1"
                      : "#4F46E5",
                  paddingVertical: 16,
                  borderRadius: 14,
                  shadowColor: "#4F46E5",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontWeight: "600",
                    color: "white",
                    fontSize: 16,
                  }}
                >
                  {activeTab === "note" ? "💾 Save Note" : "⏰ Save Time"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
