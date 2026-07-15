import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {
  APP_LOCK_ENABLED_KEY,
  APP_LOCK_BIOMETRICS_KEY,
  APP_LOCK_PIN_LENGTH_KEY,
} from "@/shared/storage/keys";
import { getStringStrict, setBoolean, setString } from "@/shared/storage/asyncStorage";

const PIN_HASH_KEY = "appLockPinHash";
const PIN_FAILED_ATTEMPTS_KEY = "appLockFailedAttempts";
const PIN_LOCKOUT_UNTIL_KEY = "appLockLockoutUntil";
const PIN_ATTEMPT_STATE_KEY = "appLockAttemptState";
const PIN_HASH_VERSION = "v3";
const PIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type PinLength = 4 | 6;
type AttemptState = { failedAttempts: number; lockoutUntil: number | null };

export type PinAttemptResult =
  | { status: "success" }
  | { status: "invalid"; failedAttempts: number; lockoutUntil: number | null }
  | { status: "locked"; lockoutUntil: number }
  | { status: "busy" }
  | { status: "error"; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "App lock storage is unavailable.";
}

function assertPinLength(length: number): asserts length is PinLength {
  if (length !== 4 && length !== 6) {
    throw new Error("PIN length must be 4 or 6 digits.");
  }
}

function assertPin(pin: string, expectedLength?: PinLength): void {
  if (!/^\d{4}$|^\d{6}$/.test(pin) || (expectedLength !== undefined && pin.length !== expectedLength)) {
    throw new Error(`PIN must be exactly ${expectedLength ?? "4 or 6"} digits.`);
  }
}

function parseBoolean(value: string | null, key: string): boolean | null {
  if (value === null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Stored app lock value "${key}" is invalid.`);
}

function parseNonNegativeInteger(value: string | null, key: string): number {
  if (value === null) return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Stored app lock value "${key}" is invalid.`);
  }
  return parsed;
}

function parseAttemptState(value: string): AttemptState {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Stored app lock attempt state is invalid.");
  }
  const { failedAttempts, lockoutUntil } = parsed as Record<string, unknown>;
  if (
    typeof failedAttempts !== "number" ||
    !Number.isSafeInteger(failedAttempts) ||
    failedAttempts < 0 ||
    (lockoutUntil !== null &&
      (typeof lockoutUntil !== "number" || !Number.isSafeInteger(lockoutUntil) || lockoutUntil < 0))
  ) {
    throw new Error("Stored app lock attempt state is invalid.");
  }
  return {
    failedAttempts,
    lockoutUntil: lockoutUntil as number | null,
  };
}

function hashPinLegacy(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i);
    hash &= hash;
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
  assertPin(pin);
  const length = pin.length as PinLength;
  const saltHex = toHex(Crypto.getRandomBytes(16));
  // SecureStore prevents ordinary hash extraction; attempt backoff handles online guessing.
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PIN_HASH_VERSION}:${length}:${saltHex}:${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return `${PIN_HASH_VERSION}$${length}$${saltHex}$${digest}`;
}

function storedPinLength(storedHash: string, pinLengthValue: string | null): PinLength {
  if (storedHash.startsWith(`${PIN_HASH_VERSION}$`)) {
    const [, lengthValue] = storedHash.split("$");
    const length = Number(lengthValue);
    assertPinLength(length);
    return length;
  }

  const legacyLength = storedHash.match(/_(4|6)$/)?.[1];
  if (legacyLength) return Number(legacyLength) as PinLength;

  if (storedHash.startsWith("v2$")) {
    if (pinLengthValue === null) return 4;
    const length = Number(pinLengthValue);
    assertPinLength(length);
    return length;
  }

  throw new Error("Stored app lock PIN is invalid.");
}

async function verifyPinHash(
  pin: string,
  storedHash: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (storedHash.startsWith(`${PIN_HASH_VERSION}$`)) {
    const [, lengthValue, saltHex, expectedDigest] = storedHash.split("$");
    const length = Number(lengthValue);
    if ((length !== 4 && length !== 6) || !saltHex || !expectedDigest || pin.length !== length) {
      return { valid: false, needsUpgrade: false };
    }
    const actualDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${PIN_HASH_VERSION}:${length}:${saltHex}:${pin}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return { valid: constantTimeEqual(actualDigest, expectedDigest), needsUpgrade: false };
  }

  if (storedHash.startsWith("v2$")) {
    const [, saltHex, expectedDigest] = storedHash.split("$");
    if (!saltHex || !expectedDigest) return { valid: false, needsUpgrade: false };
    const actualDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `v2:${saltHex}:${pin}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return { valid: constantTimeEqual(actualDigest, expectedDigest), needsUpgrade: true };
  }

  return {
    valid: constantTimeEqual(hashPinLegacy(pin), storedHash),
    needsUpgrade: true,
  };
}

function getLockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  const exponent = Math.min(failedAttempts - 5, 6);
  return Math.min(30_000 * (2 ** exponent), 30 * 60 * 1000);
}

async function writeAttemptState(failedAttempts: number, lockoutUntil: number | null): Promise<void> {
  await setString(PIN_ATTEMPT_STATE_KEY, JSON.stringify({ failedAttempts, lockoutUntil }));
}

async function persistAttemptState(
  failedAttempts: number,
  lockoutUntil: number | null,
  previous: { failedAttempts: number; lockoutUntil: number | null }
): Promise<void> {
  try {
    await writeAttemptState(failedAttempts, lockoutUntil);
  } catch (error) {
    await writeAttemptState(previous.failedAttempts, previous.lockoutUntil).catch(() => undefined);
    throw error;
  }
}

async function restorePinHash(storedHash: string | null): Promise<void> {
  if (storedHash === null) {
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  } else {
    await SecureStore.setItemAsync(PIN_HASH_KEY, storedHash, PIN_OPTIONS);
  }
}

let pinAttemptInFlight = false;

export type AppLockStore = {
  hydrated: boolean;
  hydrationError: string | null;
  isEnabled: boolean;
  biometricsEnabled: boolean;
  pinLength: PinLength;
  isLocked: boolean;
  failedAttempts: number;
  lockoutUntil: number | null;
  hasPinSet: boolean;

  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  setPinLength: (length: PinLength) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  attemptPin: (pin: string) => Promise<PinAttemptResult>;
  clearPin: () => Promise<void>;
  lock: () => void;
  unlock: () => void;
  resetFailedAttempts: () => Promise<void>;
};

export const useAppLockStore = create<AppLockStore>((set, get) => ({
  hydrated: false,
  hydrationError: null,
  isEnabled: false,
  biometricsEnabled: false,
  pinLength: 4,
  isLocked: false,
  failedAttempts: 0,
  lockoutUntil: null,
  hasPinSet: false,

  hydrate: async () => {
    set({ hydrated: false, hydrationError: null });
    try {
      const [
        enabledValue,
        biometricsValue,
        pinLengthValue,
        storedHash,
        attemptStateValue,
        legacyAttemptsValue,
        legacyLockoutValue,
      ] =
        await Promise.all([
          getStringStrict(APP_LOCK_ENABLED_KEY),
          getStringStrict(APP_LOCK_BIOMETRICS_KEY),
          getStringStrict(APP_LOCK_PIN_LENGTH_KEY),
          SecureStore.getItemAsync(PIN_HASH_KEY),
          getStringStrict(PIN_ATTEMPT_STATE_KEY),
          getStringStrict(PIN_FAILED_ATTEMPTS_KEY),
          getStringStrict(PIN_LOCKOUT_UNTIL_KEY),
        ]);

      const enabledPreference = parseBoolean(enabledValue, APP_LOCK_ENABLED_KEY) ?? false;
      const biometricsEnabled = parseBoolean(biometricsValue, APP_LOCK_BIOMETRICS_KEY) ?? false;
      // SecureStore may survive an iOS uninstall while AsyncStorage is removed.
      const effectiveHash = enabledValue === null ? null : storedHash;
      if (storedHash && effectiveHash === null) {
        await SecureStore.deleteItemAsync(PIN_HASH_KEY);
      }
      const hasPinSet = effectiveHash !== null;
      if (enabledPreference && !effectiveHash) {
        throw new Error("App lock is enabled, but its PIN is unavailable.");
      }
      const pinLength = effectiveHash ? storedPinLength(effectiveHash, pinLengthValue) : 4;
      const attemptState = attemptStateValue
        ? parseAttemptState(attemptStateValue)
        : {
            failedAttempts: parseNonNegativeInteger(legacyAttemptsValue, PIN_FAILED_ATTEMPTS_KEY),
            lockoutUntil: parseNonNegativeInteger(legacyLockoutValue, PIN_LOCKOUT_UNTIL_KEY) || null,
          };
      if (!attemptStateValue && (legacyAttemptsValue !== null || legacyLockoutValue !== null)) {
        await writeAttemptState(attemptState.failedAttempts, attemptState.lockoutUntil);
      }
      const { failedAttempts } = attemptState;
      const parsedLockoutUntil = attemptState.lockoutUntil ?? 0;
      const lockoutUntil = parsedLockoutUntil > Date.now() ? parsedLockoutUntil : null;

      set({
        hydrated: true,
        hydrationError: null,
        isEnabled: enabledPreference,
        biometricsEnabled,
        pinLength,
        hasPinSet,
        failedAttempts,
        lockoutUntil,
        isLocked: enabledPreference,
      });

      if (!lockoutUntil && parsedLockoutUntil > 0) {
        void persistAttemptState(failedAttempts, null, { failedAttempts, lockoutUntil: parsedLockoutUntil })
          .catch((error: unknown) => console.warn("Failed to clear expired PIN lockout:", error));
      }
    } catch (error) {
      set({
        hydrated: true,
        hydrationError: errorMessage(error),
        isEnabled: true,
        isLocked: true,
        hasPinSet: true,
      });
    }
  },

  setEnabled: async (enabled) => {
    const previous = get();
    if (enabled && !previous.hasPinSet) {
      throw new Error("Set a PIN before enabling app lock.");
    }
    try {
      await setBoolean(APP_LOCK_ENABLED_KEY, enabled);
      if (!enabled) {
        await persistAttemptState(0, null, previous);
      }
    } catch (error) {
      await Promise.allSettled([
        setBoolean(APP_LOCK_ENABLED_KEY, previous.isEnabled),
        writeAttemptState(previous.failedAttempts, previous.lockoutUntil),
      ]);
      throw error;
    }
    set({
      isEnabled: enabled,
      isLocked: enabled ? previous.isLocked : false,
      failedAttempts: enabled ? previous.failedAttempts : 0,
      lockoutUntil: enabled ? previous.lockoutUntil : null,
    });
  },

  setBiometricsEnabled: async (enabled) => {
    await setBoolean(APP_LOCK_BIOMETRICS_KEY, enabled);
    set({ biometricsEnabled: enabled });
  },

  setPinLength: async (length) => {
    assertPinLength(length);
    if (get().hasPinSet && length !== get().pinLength) {
      throw new Error("Change the PIN to use a different PIN length.");
    }
    await setString(APP_LOCK_PIN_LENGTH_KEY, String(length));
    set({ pinLength: length });
  },

  setPin: async (pin) => {
    const previous = get();
    assertPin(pin, previous.pinLength);
    const [storedHash, previousPinLength] = await Promise.all([
      SecureStore.getItemAsync(PIN_HASH_KEY),
      getStringStrict(APP_LOCK_PIN_LENGTH_KEY),
    ]);
    const nextHash = await hashPin(pin);
    try {
      await SecureStore.setItemAsync(PIN_HASH_KEY, nextHash, PIN_OPTIONS);
      await persistAttemptState(0, null, previous);
      await setString(APP_LOCK_PIN_LENGTH_KEY, String(pin.length));
    } catch (error) {
      await Promise.allSettled([
        restorePinHash(storedHash),
        writeAttemptState(previous.failedAttempts, previous.lockoutUntil),
        previousPinLength === null
          ? Promise.resolve()
          : setString(APP_LOCK_PIN_LENGTH_KEY, previousPinLength),
      ]);
      throw error;
    }
    set({ hasPinSet: true, pinLength: pin.length as PinLength, failedAttempts: 0, lockoutUntil: null });
  },

  attemptPin: async (pin) => {
    if (pinAttemptInFlight) return { status: "busy" };
    try {
      assertPin(pin, get().pinLength);
    } catch (error) {
      return { status: "error", message: errorMessage(error) };
    }

    const activeLockout = get().lockoutUntil;
    if (activeLockout && activeLockout > Date.now()) {
      return { status: "locked", lockoutUntil: activeLockout };
    }

    pinAttemptInFlight = true;
    try {
      const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
      if (!storedHash) return { status: "error", message: "App lock PIN is unavailable." };
      const result = await verifyPinHash(pin, storedHash);

      if (result.valid) {
        if (result.needsUpgrade) {
          const upgradedHash = await hashPin(pin);
          try {
            await SecureStore.setItemAsync(PIN_HASH_KEY, upgradedHash, PIN_OPTIONS);
            await setString(APP_LOCK_PIN_LENGTH_KEY, String(pin.length));
          } catch (error) {
            console.warn("Failed to upgrade app lock PIN metadata:", error);
          }
        }
        const previous = get();
        try {
          await persistAttemptState(0, null, previous);
        } catch (error) {
          console.warn("Failed to reset PIN attempt state after successful auth:", error);
        }
        set({ failedAttempts: 0, lockoutUntil: null, pinLength: pin.length as PinLength });
        return { status: "success" };
      }

      const previous = get();
      const failedAttempts = previous.failedAttempts + 1;
      const duration = getLockoutDurationMs(failedAttempts);
      const lockoutUntil = duration > 0 ? Date.now() + duration : null;
      try {
        await persistAttemptState(failedAttempts, lockoutUntil, previous);
      } catch (error) {
        set({
          failedAttempts,
          lockoutUntil: lockoutUntil ?? Date.now() + 30_000,
        });
        return { status: "error", message: errorMessage(error) };
      }
      set({ failedAttempts, lockoutUntil });
      return { status: "invalid", failedAttempts, lockoutUntil };
    } catch (error) {
      return { status: "error", message: errorMessage(error) };
    } finally {
      pinAttemptInFlight = false;
    }
  },

  clearPin: async () => {
    const previous = get();
    const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
    try {
      await setBoolean(APP_LOCK_ENABLED_KEY, false);
      await SecureStore.deleteItemAsync(PIN_HASH_KEY);
      await persistAttemptState(0, null, previous);
    } catch (error) {
      await Promise.allSettled([
        setBoolean(APP_LOCK_ENABLED_KEY, previous.isEnabled),
        restorePinHash(storedHash),
        writeAttemptState(previous.failedAttempts, previous.lockoutUntil),
      ]);
      throw error;
    }
    set({ hasPinSet: false, isEnabled: false, isLocked: false, failedAttempts: 0, lockoutUntil: null });
  },

  lock: () => {
    const { isEnabled, hasPinSet } = get();
    if (isEnabled && hasPinSet) set({ isLocked: true });
  },

  unlock: () => set({ isLocked: false }),

  resetFailedAttempts: async () => {
    const previous = get();
    await persistAttemptState(0, null, previous);
    set({ failedAttempts: 0, lockoutUntil: null });
  },
}));
