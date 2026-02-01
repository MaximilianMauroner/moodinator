import React from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
import { SectionHeader } from "../components/SectionHeader";
import { SettingCard } from "../components/SettingCard";
import { SettingRow } from "../components/SettingRow";
import { formatBackupDate, formatBackupFolderPath } from "../utils/backupFormat";

export function DataSection({
  onExport,
  onImport,
  backupInfo,
  backupFolderUri,
  onSelectBackupFolder,
  onManualBackup,
  isBusy,
}: {
  onExport: () => void;
  onImport: () => void;
  backupInfo: { count: number; latestBackup: number | null } | null;
  backupFolderUri: string | null;
  onSelectBackupFolder: () => void;
  onManualBackup: () => void;
  isBusy: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <>
      <SectionHeader title="Data" icon="💾" />
      <SettingCard>
        <SettingRow
          label="Export Data"
          subLabel="Save your history as JSON"
          icon="download-outline"
          onPress={onExport}
        />
        <SettingRow
          label="Import Data"
          subLabel="Restore from JSON backup"
          icon="refresh-outline"
          onPress={onImport}
        />
        <SettingRow
          label="Therapy Export"
          subLabel="Create a report for your therapist"
          icon="document-text-outline"
          action={
            <Link href="/therapy-export" asChild>
              <TouchableOpacity>
                <View className="px-3 py-1.5 rounded-full bg-dusk-100 dark:bg-dusk-700">
                  <Text className="font-medium text-sm text-dusk-600 dark:text-dusk-300">
                    Create
                  </Text>
                </View>
              </TouchableOpacity>
            </Link>
          }
        />
        {Platform.OS === "android" ? (
          <>
            <SettingRow
              label="Backup Folder"
              subLabel={
                backupFolderUri !== null
                  ? `Location: ${formatBackupFolderPath(backupFolderUri)}`
                  : "Select a folder for automatic backups"
              }
              icon="folder-outline"
              onPress={onSelectBackupFolder}
              isLast={!backupFolderUri}
            />
            {backupFolderUri ? (
              <SettingRow
                label="Automatic Backups"
                subLabel={
                  backupInfo
                    ? `${backupInfo.count} backup(s), last: ${formatBackupDate(
                        backupInfo.latestBackup
                      )}`
                    : "Checking backup status..."
                }
                icon="cloud-done-outline"
                action={
                  <TouchableOpacity onPress={onManualBackup} disabled={isBusy}>
                    <View className="px-3 py-1.5 rounded-full bg-sage-100 dark:bg-sage-600/30">
                      {isBusy ? (
                        <ActivityIndicator size="small" color={isDark ? "#A8C5A8" : "#5B8A5B"} />
                      ) : (
                        <Text className="font-medium text-sm text-sage-500 dark:text-sage-300">
                          Backup Now
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                }
                isLast
              />
            ) : null}
          </>
        ) : (
          <SettingRow
            label="Automatic Backups"
            subLabel={
              backupInfo
                ? `${backupInfo.count} backup(s), last: ${formatBackupDate(
                    backupInfo.latestBackup
                  )}`
                : "Checking backup status..."
            }
            icon="cloud-done-outline"
            action={
              <TouchableOpacity onPress={onManualBackup} disabled={isBusy}>
                <View className="px-3 py-1.5 rounded-full bg-sage-100 dark:bg-sage-600/30">
                  {isBusy ? (
                    <ActivityIndicator size="small" color={isDark ? "#A8C5A8" : "#5B8A5B"} />
                  ) : (
                    <Text className="font-medium text-sm text-sage-500 dark:text-sage-300">
                      Backup Now
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            }
            isLast
          />
        )}
      </SettingCard>
    </>
  );
}
