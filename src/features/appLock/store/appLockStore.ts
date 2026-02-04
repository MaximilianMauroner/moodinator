import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import {
  APP_LOCK_ENABLED_KEY,
  APP_LOCK_BIOMETRICS_KEY,
  APP_LOCK_PIN_LENGTH_KEY,
} from "@/shared/storage/keys";
import { getBoolean, setBoolean, getString, setString } from "@/shared/storage/asyncStorage";

const PIN_HASH_KEY = "appLockPinHash";

async function hashPin(pin: string): Promise<string> {
  // Simple hash for PIN - in production you'd want a proper crypto hash
  // This provides basic obfuscation
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `pin_${Math.abs(hash).toString(36)}_${pin.length}`;
}

export type AppLockStore = {
  hydrated: boolean;
  isEnabled: boolean;
  biometricsEnabled: boolean;
  pinLength: 4 | 6;
  isLocked: boolean;
  failedAttempts: number;
  hasPinSet: boolean;

  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  setPinLength: (length: 4 | 6) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  clearPin: () => Promise<void>;
  lock: () => void;
  unlock: () => void;
  incrementFailedAttempts: () => void;
  resetFailedAttempts: () => void;
};

export const useAppLockStore = create<AppLockStore>((set, get) => ({
  hydrated: false,
  isEnabled: false,
  biometricsEnabled: true,
  pinLength: 4,
  isLocked: false,
  failedAttempts: 0,
  hasPinSet: false,

  hydrate: async () => {
    const [isEnabled, biometricsEnabled, pinLengthStr, storedHash] = await Promise.all([
      getBoolean(APP_LOCK_ENABLED_KEY),
      getBoolean(APP_LOCK_BIOMETRICS_KEY),
      getString(APP_LOCK_PIN_LENGTH_KEY),
      SecureStore.getItemAsync(PIN_HASH_KEY),
    ]);

    const pinLength = pinLengthStr === "6" ? 6 : 4;
    const hasPinSet = !!storedHash;
    const enabled = isEnabled ?? false;

    set({
      hydrated: true,
      isEnabled: enabled,
      biometricsEnabled: biometricsEnabled ?? true,
      pinLength,
      hasPinSet,
      // Auto-lock on app start if enabled
      isLocked: enabled && hasPinSet,
    });
  },

  setEnabled: async (enabled) => {
    await setBoolean(APP_LOCK_ENABLED_KEY, enabled);
    const { hasPinSet } = get();
    set({
      isEnabled: enabled,
      // Lock immediately if enabling and PIN is set
      isLocked: enabled && hasPinSet,
    });
  },

  setBiometricsEnabled: async (enabled) => {
    await setBoolean(APP_LOCK_BIOMETRICS_KEY, enabled);
    set({ biometricsEnabled: enabled });
  },

  setPinLength: async (length) => {
    await setString(APP_LOCK_PIN_LENGTH_KEY, String(length));
    set({ pinLength: length });
  },

  setPin: async (pin) => {
    const hash = await hashPin(pin);
    await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
    set({ hasPinSet: true });
  },

  verifyPin: async (pin) => {
    const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
    if (!storedHash) return false;

    const inputHash = await hashPin(pin);
    return inputHash === storedHash;
  },

  clearPin: async () => {
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
    set({ hasPinSet: false, isEnabled: false, isLocked: false });
    await setBoolean(APP_LOCK_ENABLED_KEY, false);
  },

  lock: () => {
    const { isEnabled, hasPinSet } = get();
    if (isEnabled && hasPinSet) {
      set({ isLocked: true, failedAttempts: 0 });
    }
  },

  unlock: () => {
    set({ isLocked: false, failedAttempts: 0 });
  },

  incrementFailedAttempts: () => {
    set((state) => ({ failedAttempts: state.failedAttempts + 1 }));
  },

  resetFailedAttempts: () => {
    set({ failedAttempts: 0 });
  },
}));
