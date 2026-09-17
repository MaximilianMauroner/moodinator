import { useCallback, useState } from "react";

import { Alert } from "@/components/ui/AppAlert";
import { haptics } from "@/lib/haptics";
import { presetSyncService } from "@/services/presetSyncService";

/**
 * "Add from History" for a preset list.
 *
 * The emotions and contexts screens ran the same preview, confirm, apply and
 * report sequence, differing only in which nouns the copy used. Keeping one
 * copy means a change to the flow, such as the loading state around the
 * confirmation, cannot be applied to one screen and forgotten on the other.
 */
export type PresetKind = "emotions" | "contexts";

const NOUNS: Record<PresetKind, { one: string; many: string; list: string }> = {
  emotions: { one: "emotion", many: "emotions", list: "Emotion List" },
  contexts: {
    one: "context tag",
    many: "context tags",
    list: "Context Tag List",
  },
};

function plural(kind: PresetKind, count: number): string {
  return count === 1 ? NOUNS[kind].one : NOUNS[kind].many;
}

export function usePresetHistorySync(kind: PresetKind) {
  const [loading, setLoading] = useState(false);
  const nouns = NOUNS[kind];

  const addFromHistory = useCallback(async () => {
    haptics.tap();

    try {
      setLoading(true);
      const diff = await presetSyncService.previewMissingFromHistory(kind);
      setLoading(false);
      const missing = diff[kind];

      if (missing.length === 0) {
        Alert.alert(
          "Nothing to Add",
          `Every ${nouns.one} in your Mood Entry history is already in your ${nouns.list}.`
        );
        return;
      }

      Alert.alert(
        "Add from History",
        `Add ${missing.length} ${plural(kind, missing.length)} from past Mood Entries to your ${nouns.list}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Add",
            onPress: async () => {
              try {
                setLoading(true);
                const result =
                  await presetSyncService.addMissingFromHistory(kind);
                const added =
                  kind === "emotions"
                    ? result.addedEmotions
                    : result.addedContexts;
                haptics.commit();
                Alert.alert(
                  "Added from History",
                  added.length > 0
                    ? `Added ${added.length} ${plural(kind, added.length)}.`
                    : `No new ${nouns.many} were found.`
                );
              } catch {
                haptics.reject();
                Alert.alert("Error", `Could not add ${nouns.many} from history.`);
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch {
      haptics.reject();
      setLoading(false);
      Alert.alert("Error", "Could not check your Mood Entry history.");
    }
  }, [kind, nouns]);

  return { loading, addFromHistory };
}
