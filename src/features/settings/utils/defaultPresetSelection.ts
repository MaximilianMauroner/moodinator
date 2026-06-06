import type { Emotion } from "@db/types";

export type PresetListModelInput<T> = {
  values: T[];
  defaults: T[];
  getLabel: (value: T) => string;
};

export type PresetListItem<T> = {
  value: T;
  label: string;
  key: string;
  isActive: boolean;
  isCustom: boolean;
};

export type PresetListMutation<T> =
  | { ok: true; values: T[] }
  | { ok: false; reason: "duplicate" | "empty"; values: T[] };

export type PresetListModel<T> = {
  values: T[];
  defaults: T[];
  defaultItems: PresetListItem<T>[];
  customItems: PresetListItem<T>[];
  counts: {
    activeDefaults: number;
    customCount: number;
    total: number;
  };
  hasDuplicate: (label: string, ignoreLabel?: string | null) => boolean;
  toggleDefault: (defaultValue: T) => T[];
  selectAllDefaults: (defaults?: T[]) => T[];
  clearDefaults: (defaults?: T[]) => T[];
  addCustom: (value: T) => PresetListMutation<T>;
  removeByLabel: (label: string) => T[];
};

export function normalizePresetKey(value: string): string {
  return value.trim().toLowerCase();
}

export function createPresetListModel<T>({
  values,
  defaults,
  getLabel,
}: PresetListModelInput<T>): PresetListModel<T> {
  const defaultKeys = new Set(
    defaults.map((value) => normalizePresetKey(getLabel(value)))
  );
  const activeKeys = new Set(
    values.map((value) => normalizePresetKey(getLabel(value)))
  );

  const hasDuplicate = (label: string, ignoreLabel?: string | null) => {
    const key = normalizePresetKey(label);
    const ignoreKey = ignoreLabel ? normalizePresetKey(ignoreLabel) : null;
    if (!key) return false;

    return values.some((value) => {
      const valueKey = normalizePresetKey(getLabel(value));
      return valueKey === key && valueKey !== ignoreKey;
    });
  };

  const defaultItems = defaults.map((value) => {
    const label = getLabel(value);
    const key = normalizePresetKey(label);
    return {
      value,
      label,
      key,
      isActive: activeKeys.has(key),
      isCustom: false,
    };
  });

  const customItems = values
    .filter((value) => !defaultKeys.has(normalizePresetKey(getLabel(value))))
    .map((value) => {
      const label = getLabel(value);
      return {
        value,
        label,
        key: normalizePresetKey(label),
        isActive: true,
        isCustom: true,
      };
    });

  const removeKeys = (keys: Set<string>) =>
    values.filter((value) => !keys.has(normalizePresetKey(getLabel(value))));

  return {
    values,
    defaults,
    defaultItems,
    customItems,
    counts: {
      activeDefaults: defaultItems.filter((item) => item.isActive).length,
      customCount: customItems.length,
      total: defaultItems.filter((item) => item.isActive).length + customItems.length,
    },
    hasDuplicate,
    toggleDefault(defaultValue) {
      const key = normalizePresetKey(getLabel(defaultValue));
      return activeKeys.has(key)
        ? removeKeys(new Set([key]))
        : [...values, defaultValue];
    },
    selectAllDefaults(defaultSubset = defaults) {
      const additions = defaultSubset.filter(
        (value) => !activeKeys.has(normalizePresetKey(getLabel(value)))
      );
      return additions.length > 0 ? [...values, ...additions] : values;
    },
    clearDefaults(defaultSubset = defaults) {
      return removeKeys(
        new Set(defaultSubset.map((value) => normalizePresetKey(getLabel(value))))
      );
    },
    addCustom(value) {
      const label = getLabel(value).trim();
      if (!label) {
        return { ok: false, reason: "empty", values };
      }
      if (hasDuplicate(label)) {
        return { ok: false, reason: "duplicate", values };
      }
      return { ok: true, values: [...values, value] };
    },
    removeByLabel(label) {
      return removeKeys(new Set([normalizePresetKey(label)]));
    },
  };
}

export function hasPresetValue(values: string[], candidate: string): boolean {
  return createPresetListModel({
    values,
    defaults: [],
    getLabel: (value) => value,
  }).hasDuplicate(candidate);
}

export function hasEmotionPreset(emotions: Emotion[], candidate: string): boolean {
  return createPresetListModel({
    values: emotions,
    defaults: [],
    getLabel: (emotion) => emotion.name,
  }).hasDuplicate(candidate);
}

export function toggleContextPreset(
  contexts: string[],
  defaultContext: string
): string[] {
  return createPresetListModel({
    values: contexts,
    defaults: [defaultContext],
    getLabel: (value) => value,
  }).toggleDefault(defaultContext);
}

export function toggleEmotionPreset(
  emotions: Emotion[],
  defaultEmotion: Emotion
): Emotion[] {
  return createPresetListModel({
    values: emotions,
    defaults: [defaultEmotion],
    getLabel: (emotion) => emotion.name,
  }).toggleDefault(defaultEmotion);
}
