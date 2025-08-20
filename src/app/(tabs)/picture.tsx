import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Alert,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateParts(date = new Date()) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const ymd = `${y}-${m}-${d}`;
  return { y, m, d, ymd };
}

function formatDateWithPattern(pattern: string, date = new Date()) {
  const { y, m, d } = formatDateParts(date);
  return pattern
    .replace(/YYYY/g, String(y))
    .replace(/MM/g, String(m))
    .replace(/DD/g, String(d));
}

// SAF helpers to derive relative paths between selected directories
function decodeSafDirPath(uri: string): string | null {
  try {
    const match = uri.match(/tree\/([^\/?#]+)/);
    if (!match) return null;
    const encoded = match[1]; // e.g. primary%3AVault%2FDaily
    const decoded = decodeURIComponent(encoded); // => primary:Vault/Daily
    return decoded;
  } catch {
    return null;
  }
}

function segmentsAfterColon(s: string): string[] {
  const afterColon = s.includes(":") ? s.split(":")[1] : s;
  return afterColon.split("/").filter(Boolean);
}

function relativePath(fromDir: string, toDir: string): string {
  const fromSeg = segmentsAfterColon(fromDir);
  const toSeg = segmentsAfterColon(toDir);
  let i = 0;
  while (i < fromSeg.length && i < toSeg.length && fromSeg[i] === toSeg[i]) i++;
  const up = new Array(fromSeg.length - i).fill("..");
  const down = toSeg.slice(i);
  const rel = [...up, ...down].join("/");
  return rel || ".";
}

function vaultRelativePath(
  dirA: string,
  dirB: string
): { aRel: string; bRel: string } | null {
  const a = segmentsAfterColon(dirA);
  const b = segmentsAfterColon(dirB);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === 0) return null; // no common root
  return { aRel: a.slice(i).join("/"), bRel: b.slice(i).join("/") };
}

// Settings persisted in AsyncStorage keys
const SETTINGS_KEYS = {
  androidAttachmentsDir: "obsidianAttachmentsDirUri", // SAF directoryUri for attachments
  androidDailyNotesDir: "obsidianDailyNotesDirUri", // SAF directoryUri for daily notes
  attachmentsSubfolder: "obsidianAttachmentsSubfolder", // fallback when derivation fails
  dailyNotesFolder: "obsidianDailyNotesFolder", // for relative path in YAML/links
  dailyNotePrefix: "obsidianDailyNotePrefix",
  dailyNoteSuffix: "obsidianDailyNoteSuffix",
  vaultName: "obsidianVaultName", // for obsidian:// links (optional)
  dailyNoteDatePattern: "obsidianDailyNoteDatePattern",
};

export default function PictureScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
  const [attachmentsSubfolder, setAttachmentsSubfolder] =
    useState("attachments_");
  const [dailyNotesFolder, setDailyNotesFolder] = useState("daily");
  const [dailyNotePrefix, setDailyNotePrefix] = useState("");
  const [dailyNoteSuffix, setDailyNoteSuffix] = useState("");
  const [androidAttachmentsDirUri, setAndroidAttachmentsDirUri] = useState<
    string | null
  >(null);
  const [androidDailyNotesDirUri, setAndroidDailyNotesDirUri] = useState<
    string | null
  >(null);
  const [vaultName, setVaultName] = useState("");
  const [noteDatePattern, setNoteDatePattern] = useState("YYYY-MM-DD");
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    // Load saved settings
    (async () => {
      try {
        const [attachDir, noteDir, attach, daily, pre, suf, vName, pat] =
          await Promise.all([
            AsyncStorage.getItem(SETTINGS_KEYS.androidAttachmentsDir),
            AsyncStorage.getItem(SETTINGS_KEYS.androidDailyNotesDir),
            AsyncStorage.getItem(SETTINGS_KEYS.attachmentsSubfolder),
            AsyncStorage.getItem(SETTINGS_KEYS.dailyNotesFolder),
            AsyncStorage.getItem(SETTINGS_KEYS.dailyNotePrefix),
            AsyncStorage.getItem(SETTINGS_KEYS.dailyNoteSuffix),
            AsyncStorage.getItem(SETTINGS_KEYS.vaultName),
            AsyncStorage.getItem(SETTINGS_KEYS.dailyNoteDatePattern),
          ]);
        if (attachDir) setAndroidAttachmentsDirUri(attachDir);
        if (noteDir) setAndroidDailyNotesDirUri(noteDir);
        if (attach) setAttachmentsSubfolder(attach);
        if (daily) setDailyNotesFolder(daily);
        if (pre) setDailyNotePrefix(pre);
        if (suf) setDailyNoteSuffix(suf);
        if (vName) setVaultName(vName);
        if (pat) setNoteDatePattern(pat);
      } catch (e) {
        console.warn("Failed to load Obsidian settings", e);
      }
    })();
  }, []);

  const requestCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Camera access is required to take a photo."
      );
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      exif: false,
    });
    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setImageUri(uri);
      setLastSavedPath(null);
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Photo library access is required to pick an image."
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: false,
      allowsEditing: false,
      quality: 1,
      exif: false,
    });
    if (!res.canceled) {
      const uri = res.assets[0].uri;
      setImageUri(uri);
      setLastSavedPath(null);
    }
  }, []);

  const computeFilenames = useCallback(() => {
    const { ymd } = formatDateParts();
    const fileName = `${ymd}.jpg`;
    let coverRelPath: string;
    if (
      Platform.OS === "android" &&
      androidAttachmentsDirUri &&
      androidDailyNotesDirUri
    ) {
      const a = decodeSafDirPath(androidAttachmentsDirUri);
      const d = decodeSafDirPath(androidDailyNotesDirUri);
      if (a && d) {
        const rel = relativePath(d, a); // from daily note dir to attachments dir
        coverRelPath = `${rel}/${fileName}`.replace(/\\/g, "/");
      } else {
        coverRelPath = `${attachmentsSubfolder}/${fileName}`.replace(
          /\\/g,
          "/"
        );
      }
    } else {
      coverRelPath = `${attachmentsSubfolder}/${fileName}`.replace(/\\/g, "/");
    }

    const dateStr = formatDateWithPattern(noteDatePattern);
    const dailyNoteName = `${dailyNotePrefix}${dateStr}${dailyNoteSuffix}`;
    let dailyNotePath = `${dailyNotesFolder}/${dailyNoteName}.md`.replace(
      /\\/g,
      "/"
    );
    if (
      Platform.OS === "android" &&
      androidAttachmentsDirUri &&
      androidDailyNotesDirUri
    ) {
      const a = decodeSafDirPath(androidAttachmentsDirUri);
      const d = decodeSafDirPath(androidDailyNotesDirUri);
      if (a && d) {
        const vr = vaultRelativePath(a, d);
        if (vr) {
          dailyNotePath = `${vr.bRel}/${dailyNoteName}.md`.replace(/\\/g, "/");
        }
      }
    }

    return { fileName, coverRelPath, dailyNoteName, dailyNotePath };
  }, [
    attachmentsSubfolder,
    dailyNotesFolder,
    dailyNotePrefix,
    dailyNoteSuffix,
    noteDatePattern,
    androidAttachmentsDirUri,
    androidDailyNotesDirUri,
  ]);

  const yamlSnippet = useMemo(() => {
    const { coverRelPath } = computeFilenames();
    return `cover: ${coverRelPath}`;
  }, [computeFilenames]);

  const pickAndroidAttachmentsDirectory = useCallback(async () => {
    try {
      const res =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!res.granted) return;
      setAndroidAttachmentsDirUri(res.directoryUri);
      await AsyncStorage.setItem(
        SETTINGS_KEYS.androidAttachmentsDir,
        res.directoryUri
      );
      Alert.alert("Saved", "Selected attachments folder.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Couldn't select folder.");
    }
  }, []);

  const pickAndroidDailyNotesDirectory = useCallback(async () => {
    try {
      const res =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!res.granted) return;
      setAndroidDailyNotesDirUri(res.directoryUri);
      await AsyncStorage.setItem(
        SETTINGS_KEYS.androidDailyNotesDir,
        res.directoryUri
      );
      Alert.alert("Saved", "Selected daily notes folder.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Couldn't select folder.");
    }
  }, []);

  const saveSettings = useCallback(async () => {
    await Promise.all([
      AsyncStorage.setItem(
        SETTINGS_KEYS.attachmentsSubfolder,
        attachmentsSubfolder
      ),
      AsyncStorage.setItem(SETTINGS_KEYS.dailyNotesFolder, dailyNotesFolder),
      AsyncStorage.setItem(SETTINGS_KEYS.dailyNotePrefix, dailyNotePrefix),
      AsyncStorage.setItem(SETTINGS_KEYS.dailyNoteSuffix, dailyNoteSuffix),
      AsyncStorage.setItem(SETTINGS_KEYS.vaultName, vaultName),
      AsyncStorage.setItem(SETTINGS_KEYS.dailyNoteDatePattern, noteDatePattern),
    ]);
    Alert.alert("Saved", "Obsidian save settings updated.");
  }, [
    attachmentsSubfolder,
    dailyNotesFolder,
    dailyNotePrefix,
    dailyNoteSuffix,
    vaultName,
    noteDatePattern,
  ]);

  // Update (or create) the daily note file with YAML cover line; Android only via SAF.
  const ensureDailyNoteHasCoverAndroid = useCallback(
    async (
      dailyNotesDirUri: string,
      coverRelativePath: string,
      dailyNoteFileName: string
    ) => {
      const displayName = dailyNoteFileName;
      const mime = "text/markdown";
      try {
        const children =
          await FileSystem.StorageAccessFramework.readDirectoryAsync(
            dailyNotesDirUri
          );
        let existingUri: string | null = null;
        for (const child of children) {
          const decoded = decodeURIComponent(child);
          if (
            decoded.endsWith(`/${displayName}`) ||
            decoded.includes(`%2F${displayName}`)
          ) {
            existingUri = child;
            break;
          }
        }

        let content = `---\ncover: ${coverRelativePath}\n---\n`;
        if (existingUri) {
          try {
            const prev = await FileSystem.readAsStringAsync(existingUri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            const yamlRegex = /^---\n([\s\S]*?)\n---\n?/;
            const m = prev.match(yamlRegex);
            if (m) {
              const yaml = m[1];
              const rest = prev.slice(m[0].length);
              let newYaml: string;
              if (/^\s*cover\s*:\s*.*$/m.test(yaml)) {
                newYaml = yaml.replace(
                  /^\s*cover\s*:\s*.*$/m,
                  `cover: ${coverRelativePath}`
                );
              } else {
                newYaml = `cover: ${coverRelativePath}\n${yaml}`;
              }
              content = `---\n${newYaml}\n---\n${rest}`;
            } else {
              content = `---\ncover: ${coverRelativePath}\n---\n${prev}`;
            }
            await FileSystem.writeAsStringAsync(existingUri, content, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            return true;
          } catch (e) {
            console.warn(
              "Couldn't read existing daily note, creating new one",
              e
            );
          }
        }

        const createdUri =
          await FileSystem.StorageAccessFramework.createFileAsync(
            dailyNotesDirUri,
            displayName,
            mime
          );
        await FileSystem.writeAsStringAsync(createdUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        return true;
      } catch (e) {
        console.error("Failed to update daily note via SAF", e);
        return false;
      }
    },
    []
  );

  const generateDailyNotePreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewContent(null);
    try {
      const { coverRelPath, dailyNoteName } = computeFilenames();
      let content = `---\ncover: ${coverRelPath}\n---\n`;
      if (Platform.OS === "android" && androidDailyNotesDirUri) {
        try {
          const children =
            await FileSystem.StorageAccessFramework.readDirectoryAsync(
              androidDailyNotesDirUri
            );
          let existingUri: string | null = null;
          const displayName = `${dailyNoteName}.md`;
          for (const child of children) {
            const decoded = decodeURIComponent(child);
            if (
              decoded.endsWith(`/${displayName}`) ||
              decoded.includes(`%2F${displayName}`)
            ) {
              existingUri = child;
              break;
            }
          }
          if (existingUri) {
            const prev = await FileSystem.readAsStringAsync(existingUri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            const yamlRegex = /^---\n([\s\S]*?)\n---\n?/;
            const m = prev.match(yamlRegex);
            if (m) {
              const yaml = m[1];
              const rest = prev.slice(m[0].length);
              let newYaml: string;
              if (/^\s*cover\s*:\s*.*$/m.test(yaml)) {
                newYaml = yaml.replace(
                  /^\s*cover\s*:\s*.*$/m,
                  `cover: ${coverRelPath}`
                );
              } else {
                newYaml = `cover: ${coverRelPath}\n${yaml}`;
              }
              content = `---\n${newYaml}\n---\n${rest}`;
            } else {
              content = `---\ncover: ${coverRelPath}\n---\n${prev}`;
            }
          }
        } catch {
          // ignore, use base content
        }
      }
      setPreviewContent(content);
    } finally {
      setPreviewLoading(false);
    }
  }, [computeFilenames, androidDailyNotesDirUri]);

  const saveToObsidian = useCallback(async () => {
    if (!imageUri) {
      Alert.alert("No image", "Take a picture first.");
      return;
    }
    setSaving(true);
    const { fileName, coverRelPath, dailyNoteName } = computeFilenames();
    try {
      const imgData = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === "android") {
        if (!androidAttachmentsDirUri) {
          Alert.alert(
            "Select Attachments Folder",
            "Pick your Obsidian attachments directory once, so we can save images.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Pick Folder", onPress: pickAndroidAttachmentsDirectory },
            ]
          );
          return;
        }

        // If a file with same name exists, delete it so we can save a fresh one
        try {
          const children =
            await FileSystem.StorageAccessFramework.readDirectoryAsync(
              androidAttachmentsDirUri
            );
          for (const child of children) {
            const decoded = decodeURIComponent(child);
            if (
              decoded.endsWith(`/${fileName}`) ||
              decoded.includes(`%2F${fileName}`)
            ) {
              await FileSystem.StorageAccessFramework.deleteAsync(child);
              break;
            }
          }
        } catch {}

        // Create attachments file through SAF (displayName cannot include subfolders)
        const targetUri =
          await FileSystem.StorageAccessFramework.createFileAsync(
            androidAttachmentsDirUri,
            fileName,
            "image/jpeg"
          );
        await FileSystem.writeAsStringAsync(targetUri, imgData, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Prefer showing the note-relative path for clarity if we can derive it
        let displayPath = `${attachmentsSubfolder}/${fileName}`;
        const a = androidAttachmentsDirUri
          ? decodeSafDirPath(androidAttachmentsDirUri)
          : null;
        const d = androidDailyNotesDirUri
          ? decodeSafDirPath(androidDailyNotesDirUri)
          : null;
        if (a && d) {
          const rel = relativePath(d, a);
          if (rel) displayPath = `${rel}/${fileName}`;
        }
        setLastSavedPath(displayPath);

        // Try to update daily note YAML
        if (androidDailyNotesDirUri) {
          await ensureDailyNoteHasCoverAndroid(
            androidDailyNotesDirUri,
            coverRelPath,
            `${dailyNoteName}.md`
          );
        }

        Alert.alert(
          "Saved",
          `Image saved and YAML snippet prepared${
            androidDailyNotesDirUri ? " (daily note created/updated)." : "."
          }`
        );
      } else {
        // iOS: share/export and provide YAML snippet.
        const tmpPath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(tmpPath, imgData, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tmpPath, {
            dialogTitle: "Save to Obsidian",
          });
        }
        setLastSavedPath(fileName);
        Alert.alert(
          "Manual Step",
          "On iOS, share the image to Obsidian and add the YAML line shown below to today's note."
        );
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save image.");
    } finally {
      setSaving(false);
    }
  }, [
    imageUri,
    computeFilenames,
    androidAttachmentsDirUri,
    androidDailyNotesDirUri,
    attachmentsSubfolder,
    ensureDailyNoteHasCoverAndroid,
    pickAndroidAttachmentsDirectory,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
        <View className="mt-1 flex flex-row justify-center items-center p-4">
          <Text className="text-3xl font-extrabold text-center text-sky-600 dark:text-sky-400">
            Daily Picture
          </Text>
        </View>
        <ScrollView className="flex-1">
          <View className="p-4 space-y-4">
            <View className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-2">
                Capture
              </Text>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-64 rounded-lg mb-3"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-64 rounded-lg mb-3 bg-gray-100 dark:bg-slate-800 items-center justify-center">
                  <Text className="text-gray-500 dark:text-slate-400">
                    No image yet
                  </Text>
                </View>
              )}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={requestCamera}
                  className="bg-blue-600 py-3 px-4 rounded-lg flex-1"
                >
                  <Text className="text-white font-semibold text-center">
                    Take Picture
                  </Text>
                </Pressable>
                <Pressable
                  onPress={pickFromGallery}
                  className="bg-indigo-600 py-3 px-4 rounded-lg flex-1"
                >
                  <Text className="text-white font-semibold text-center">
                    Pick from Gallery
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-2">
                Obsidian Settings
              </Text>
              {Platform.OS === "android" && (
                <>
                  <Pressable
                    onPress={pickAndroidAttachmentsDirectory}
                    className="bg-gray-700 py-2 px-3 rounded-lg mb-3"
                  >
                    <Text className="text-white text-center">
                      Select Attachments Folder (Android)
                    </Text>
                  </Pressable>
                  <Text className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                    {androidAttachmentsDirUri ??
                      "No attachments folder selected"}
                  </Text>
                  <Pressable
                    onPress={pickAndroidDailyNotesDirectory}
                    className="bg-gray-700 py-2 px-3 rounded-lg mb-3"
                  >
                    <Text className="text-white text-center">
                      Select Daily Notes Folder (Android)
                    </Text>
                  </Pressable>
                  <Text className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                    {androidDailyNotesDirUri ??
                      "No daily notes folder selected"}
                  </Text>
                </>
              )}

              <Text className="text-sm text-gray-600 dark:text-slate-300 mb-1">
                Daily note date pattern (YYYY, MM, DD)
              </Text>
              <TextInput
                value={noteDatePattern}
                onChangeText={(t) => setNoteDatePattern(t.toUpperCase())}
                className="border border-gray-300 dark:border-slate-700 rounded-lg p-2 mb-2 text-slate-900 dark:text-slate-100"
                placeholder="YYYY-MM-DD"
                autoCapitalize="characters"
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-sm text-gray-600 dark:text-slate-300 mb-1">
                    Daily note prefix
                  </Text>
                  <TextInput
                    value={dailyNotePrefix}
                    onChangeText={setDailyNotePrefix}
                    className="border border-gray-300 dark:border-slate-700 rounded-lg p-2 mb-2 text-slate-900 dark:text-slate-100"
                    placeholder=""
                    autoCapitalize="none"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-gray-600 dark:text-slate-300 mb-1">
                    Daily note suffix
                  </Text>
                  <TextInput
                    value={dailyNoteSuffix}
                    onChangeText={setDailyNoteSuffix}
                    className="border border-gray-300 dark:border-slate-700 rounded-lg p-2 mb-2 text-slate-900 dark:text-slate-100"
                    placeholder=""
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Pressable
                onPress={saveSettings}
                className="bg-gray-700 py-2 px-3 rounded-lg"
              >
                <Text className="text-white text-center">Save Settings</Text>
              </Pressable>
            </View>

            <View className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <Text className="text-base font-medium text-gray-800 dark:text-slate-100 mb-2">
                Save & Attach
              </Text>
              <View className="flex-row gap-2 mb-3">
                <Pressable
                  onPress={generateDailyNotePreview}
                  className="bg-gray-700 py-3 px-4 rounded-lg flex-1"
                >
                  <Text className="text-white font-semibold text-center">
                    Preview Note Update
                  </Text>
                </Pressable>
                <Pressable
                  disabled={!imageUri || saving}
                  onPress={saveToObsidian}
                  className={`py-3 px-4 rounded-lg flex-1 ${
                    imageUri ? "bg-green-600" : "bg-gray-400"
                  }`}
                >
                  <Text className="text-white font-semibold text-center">
                    Save Photo and Update Cover
                  </Text>
                </Pressable>
              </View>
              {lastSavedPath && (
                <Text className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                  Saved: {lastSavedPath}
                </Text>
              )}
              <View className="mt-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <Text className="text-sm text-gray-700 dark:text-slate-200 font-mono">
                  {yamlSnippet}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Add this to today's note YAML if needed.
                </Text>
              </View>
              <View className="mt-3">
                <Text className="text-sm font-medium text-gray-800 dark:text-slate-100 mb-1">
                  Preview
                </Text>
                <View className="h-48 bg-gray-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                  {previewLoading ? (
                    <Text className="text-gray-500 dark:text-slate-400">
                      Loading preview…
                    </Text>
                  ) : previewContent ? (
                    <ScrollView>
                      <Text className="text-xs text-gray-700 dark:text-slate-200 font-mono whitespace-pre-wrap">
                        {previewContent}
                      </Text>
                    </ScrollView>
                  ) : (
                    <Text className="text-gray-500 dark:text-slate-400">
                      Tap Preview to see the daily note content update.
                    </Text>
                  )}
                </View>
              </View>
              {vaultName ? (
                <Pressable
                  onPress={() => {
                    const dateStr = formatDateWithPattern(noteDatePattern);
                    let file = `${dailyNotesFolder}/${dailyNotePrefix}${dateStr}${dailyNoteSuffix}.md`;
                    if (
                      Platform.OS === "android" &&
                      androidAttachmentsDirUri &&
                      androidDailyNotesDirUri
                    ) {
                      const a = decodeSafDirPath(androidAttachmentsDirUri);
                      const d = decodeSafDirPath(androidDailyNotesDirUri);
                      if (a && d) {
                        const vr = vaultRelativePath(a, d);
                        if (vr)
                          file = `${vr.bRel}/${dailyNotePrefix}${dateStr}${dailyNoteSuffix}.md`;
                      }
                    }
                    const url = `obsidian://open?vault=${encodeURIComponent(
                      vaultName
                    )}&file=${encodeURIComponent(file)}`;
                    Linking.openURL(url);
                  }}
                  className="bg-purple-600 py-3 px-4 rounded-lg mt-3"
                >
                  <Text className="text-white font-semibold text-center">
                    Open Today's Note in Obsidian
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
