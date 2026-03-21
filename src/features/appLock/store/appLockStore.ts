import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {
  APP_LOCK_ENABLED_KEY,
  APP_LOCK_BIOMETRICS_KEY,
  APP_LOCK_PIN_LENGTH_KEY,
} from "@/shared/storage/keys";
import { getBoolean, setBoolean, getString, setString } from "@/shared/storage/asyncStorage";

const PIN_HASH_KEY = "appLockPinHash";
const PIN_FAILED_ATTEMPTS_KEY = "appLockFailedAttempts";
const PIN_LOCKOUT_UNTIL_KEY = "appLockLockoutUntil";
const PIN_HASH_VERSION = "v2";

function hashPinLegacy(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `pin_${Math.abs(hash).toString(36)}_${pin.length}`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hashPin(pin: string): Promise<string> {
  const salt = Crypto.getRandomBytes(16);
  const saltHex = toHex(salt);
  // Salted cryptographic hash stored in SecureStore. The PIN lockout/backoff is the primary
  // brute-force mitigation for low-entropy PINs.
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PIN_HASH_VERSION}:${saltHex}:${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return `${PIN_HASH_VERSION}$${saltHex}$${digest}`;
}

async function verifyPinHash(pin: string, storedHash: string): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!storedHash.startsWith(`${PIN_HASH_VERSION}$`)) {
    return {
      valid: constantTimeEqual(hashPinLegacy(pin), storedHash),
      needsUpgrade: true,
    };
  }

  const [, saltHex, expectedDigest] = storedHash.split("$");
  if (!saltHex || !expectedDigest) {
    return { valid: false, needsUpgrade: false };
  }

  const actualDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PIN_HASH_VERSION}:${saltHex}:${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return {
    valid: constantTimeEqual(actualDigest, expectedDigest),
    needsUpgrade: false,
  };
}

function getLockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  const exponent = Math.min(failedAttempts - 5, 6);
  const durationMs = 30_000 * (2 ** exponent);
  return Math.min(durationMs, 30 * 60 * 1000);
}

async function persistAttemptState(failedAttempts: number, lockoutUntil: number | null): Promise<void> {
  await Promise.all([
    setString(PIN_FAILED_ATTEMPTS_KEY, String(failedAttempts)),
    setString(PIN_LOCKOUT_UNTIL_KEY, lockoutUntil ? String(lockoutUntil) : "0"),
  ]);
}

async function clearAttemptState(): Promise<void> {
  await persistAttemptState(0, null);
}

export type AppLockStore = {
  hydrated: boolean;
  isEnabled: boolean;
  biometricsEnabled: boolean;
  pinLength: 4 | 6;
  isLocked: boolean;
  failedAttempts: number;
  lockoutUntil: number | null;
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
  incrementFailedAttempts: () => Promise<void>;
  resetFailedAttempts: () => Promise<void>;
};

export const useAppLockStore = create<AppLockStore>((set, get) => ({
  hydrated: false,
  isEnabled: false,
  biometricsEnabled: true,
  pinLength: 4,
  isLocked: false,
  failedAttempts: 0,
  lockoutUntil: null,
  hasPinSet: false,

  hydrate: async () => {
    const [isEnabled, biometricsEnabled, pinLengthStr, storedHash, failedAttemptsStr, lockoutUntilStr] = await Promise.all([
      getBoolean(APP_LOCK_ENABLED_KEY),
      getBoolean(APP_LOCK_BIOMETRICS_KEY),
      getString(APP_LOCK_PIN_LENGTH_KEY),
      SecureStore.getItemAsync(PIN_HASH_KEY),
      getString(PIN_FAILED_ATTEMPTS_KEY),
      getString(PIN_LOCKOUT_UNTIL_KEY),
    ]);

    const pinLength = pinLengthStr === "6" ? 6 : 4;
    const hasPinSet = !!storedHash;
    const enabled = (isEnabled ?? false) && hasPinSet;
    const failedAttempts = Math.max(0, Number.parseInt(failedAttemptsStr ?? "0", 10) || 0);
    const parsedLockoutUntil = Number.parseInt(lockoutUntilStr ?? "0", 10) || 0;
    const lockoutUntil = parsedLockoutUntil > Date.now() ? parsedLockoutUntil : null;

    set({
      hydrated: true,
      isEnabled: enabled,
      biometricsEnabled: biometricsEnabled ?? true,
      pinLength,
      hasPinSet,
      failedAttempts,
      lockoutUntil,
      // Auto-lock on app start if enabled
      isLocked: enabled && hasPinSet,
    });

    // Keep persisted state consistent if app lock is enabled without a valid PIN.
    if ((isEnabled ?? false) && !hasPinSet) {
      await setBoolean(APP_LOCK_ENABLED_KEY, false);
    }

    if (!lockoutUntil && (failedAttempts > 0 || parsedLockoutUntil > 0)) {
      await persistAttemptState(failedAttempts, null);
    }
  },

  setEnabled: async (enabled) => {
    const { hasPinSet } = get();
    if (enabled && !hasPinSet) {
      set({ isEnabled: false, isLocked: false, failedAttempts: 0, lockoutUntil: null });
      await setBoolean(APP_LOCK_ENABLED_KEY, false);
      await clearAttemptState();
      return;
    }

    set({
      isEnabled: enabled,
      // Keep current session unlocked when enabling from settings.
      isLocked: enabled ? get().isLocked : false,
      failedAttempts: enabled ? get().failedAttempts : 0,
      lockoutUntil: enabled ? get().lockoutUntil : null,
    });
    await setBoolean(APP_LOCK_ENABLED_KEY, enabled);
    if (!enabled) {
      await clearAttemptState();
    }
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
    await clearAttemptState();
    set({ hasPinSet: true, failedAttempts: 0, lockoutUntil: null });
  },

  verifyPin: async (pin) => {
    const { lockoutUntil } = get();
    if (lockoutUntil && lockoutUntil > Date.now()) {
      return false;
    }

    const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
    if (!storedHash) return false;

    const result = await verifyPinHash(pin, storedHash);

    if (result.valid && result.needsUpgrade) {
      const upgradedHash = await hashPin(pin);
      await SecureStore.setItemAsync(PIN_HASH_KEY, upgradedHash);
    }

    return result.valid;
  },

  clearPin: async () => {
    // Disable lock state immediately before async storage operations.
    set({ hasPinSet: false, isEnabled: false, isLocked: false, failedAttempts: 0, lockoutUntil: null });
    await setBoolean(APP_LOCK_ENABLED_KEY, false);
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
    await clearAttemptState();
  },

  lock: () => {
    const { isEnabled, hasPinSet } = get();
    if (isEnabled && hasPinSet) {
      set({ isLocked: true });
    }
  },

  unlock: () => {
    set({ isLocked: false });
  },

  incrementFailedAttempts: async () => {
    const now = Date.now();
    const nextFailedAttempts = get().failedAttempts + 1;
    const lockoutDurationMs = getLockoutDurationMs(nextFailedAttempts);
    const nextLockoutUntil = lockoutDurationMs > 0 ? now + lockoutDurationMs : null;

    set({
      failedAttempts: nextFailedAttempts,
      lockoutUntil: nextLockoutUntil,
    });

    await persistAttemptState(nextFailedAttempts, nextLockoutUntil);
  },

  resetFailedAttempts: async () => {
    set({ failedAttempts: 0, lockoutUntil: null });
    await clearAttemptState();
  },
}));
