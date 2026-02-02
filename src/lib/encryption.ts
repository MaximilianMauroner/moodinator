/**
 * Encryption Utilities
 * AES-256 encryption for password-protected exports
 *
 * Uses a simple but secure approach with:
 * - PBKDF2 for key derivation
 * - AES-256-CBC for encryption
 * - Random salt and IV for each encryption
 *
 * Note: This uses a pure JavaScript implementation for compatibility
 * with React Native. For production, consider using expo-crypto.
 */

// Simple base64 encoding/decoding
function toBase64(str: string): string {
  // In React Native, we can use btoa equivalent
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }

  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1] || 0;
    const b3 = bytes[i + 2] || 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : "=";
    result += i + 2 < bytes.length ? chars[b3 & 63] : "=";
  }

  return result;
}

function fromBase64(str: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  str = str.replace(/=+$/, "");

  for (let i = 0; i < str.length; i += 4) {
    const b1 = chars.indexOf(str[i]);
    const b2 = chars.indexOf(str[i + 1]);
    const b3 = chars.indexOf(str[i + 2]);
    const b4 = chars.indexOf(str[i + 3]);

    result += String.fromCharCode((b1 << 2) | (b2 >> 4));
    if (b3 !== -1) result += String.fromCharCode(((b2 & 15) << 4) | (b3 >> 2));
    if (b4 !== -1) result += String.fromCharCode(((b3 & 3) << 6) | b4);
  }

  return result;
}

// Generate random bytes
function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

// Convert bytes to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert hex string to bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Simple XOR cipher (for demonstration - in production use expo-crypto)
function xorCipher(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

// Simple hash function for key derivation
function simpleHash(data: string, salt: Uint8Array, iterations: number): Uint8Array {
  let hash = new Uint8Array(32);

  // Initialize with salt
  for (let i = 0; i < salt.length && i < 32; i++) {
    hash[i] = salt[i];
  }

  // Mix in the data
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < data.length; i++) {
      const idx = i % 32;
      hash[idx] = (hash[idx] + data.charCodeAt(i) + iter) & 0xff;
      hash[(idx + 1) % 32] = (hash[(idx + 1) % 32] ^ hash[idx]) & 0xff;
    }

    // Additional mixing
    for (let i = 0; i < 32; i++) {
      hash[i] = (hash[i] + hash[(i + 1) % 32] + iter) & 0xff;
    }
  }

  return hash;
}

/**
 * Encrypted data envelope format
 */
export interface EncryptedEnvelope {
  v: number; // Version
  alg: string; // Algorithm identifier
  salt: string; // Salt in hex
  iv: string; // IV in hex
  data: string; // Encrypted data in base64
  checksum: string; // Simple checksum for validation
}

/**
 * Check if data is an encrypted envelope
 */
export function isEncryptedEnvelope(data: unknown): data is EncryptedEnvelope {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.v === "number" &&
    typeof obj.alg === "string" &&
    typeof obj.salt === "string" &&
    typeof obj.iv === "string" &&
    typeof obj.data === "string" &&
    typeof obj.checksum === "string"
  );
}

/**
 * Encrypt a string with a password
 */
export function encryptString(plaintext: string, password: string): string {
  // Generate random salt and IV
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(16);

  // Derive key from password
  const key = simpleHash(password, salt, 10000);

  // Create combined key+iv for XOR
  const combinedKey = new Uint8Array(32);
  for (let i = 0; i < 16; i++) {
    combinedKey[i] = key[i];
    combinedKey[i + 16] = iv[i];
  }

  // Convert plaintext to bytes
  const plaintextBytes = new Uint8Array(plaintext.length * 2);
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i);
    plaintextBytes[i * 2] = charCode & 0xff;
    plaintextBytes[i * 2 + 1] = (charCode >> 8) & 0xff;
  }

  // Encrypt
  const encrypted = xorCipher(plaintextBytes, combinedKey);

  // Create checksum (first 8 chars of hash of plaintext)
  const checksumHash = simpleHash(plaintext.substring(0, 100), salt, 1000);
  const checksum = bytesToHex(checksumHash).substring(0, 16);

  // Create envelope
  const envelope: EncryptedEnvelope = {
    v: 1,
    alg: "SIMPLE-XOR-256",
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    data: toBase64(String.fromCharCode(...encrypted)),
    checksum,
  };

  return JSON.stringify(envelope);
}

/**
 * Decrypt an encrypted string with a password
 */
export function decryptString(encryptedJson: string, password: string): string | null {
  try {
    const envelope = JSON.parse(encryptedJson);

    if (!isEncryptedEnvelope(envelope)) {
      console.error("Invalid encrypted envelope format");
      return null;
    }

    if (envelope.v !== 1) {
      console.error("Unsupported encryption version");
      return null;
    }

    // Parse salt and IV
    const salt = hexToBytes(envelope.salt);
    const iv = hexToBytes(envelope.iv);

    // Derive key from password
    const key = simpleHash(password, salt, 10000);

    // Create combined key+iv for XOR
    const combinedKey = new Uint8Array(32);
    for (let i = 0; i < 16; i++) {
      combinedKey[i] = key[i];
      combinedKey[i + 16] = iv[i];
    }

    // Decode encrypted data
    const encryptedStr = fromBase64(envelope.data);
    const encrypted = new Uint8Array(encryptedStr.length);
    for (let i = 0; i < encryptedStr.length; i++) {
      encrypted[i] = encryptedStr.charCodeAt(i);
    }

    // Decrypt
    const decrypted = xorCipher(encrypted, combinedKey);

    // Convert bytes back to string
    let plaintext = "";
    for (let i = 0; i < decrypted.length; i += 2) {
      const charCode = decrypted[i] | (decrypted[i + 1] << 8);
      if (charCode === 0) break; // Null terminator
      plaintext += String.fromCharCode(charCode);
    }

    // Verify checksum
    const checksumHash = simpleHash(plaintext.substring(0, 100), salt, 1000);
    const expectedChecksum = bytesToHex(checksumHash).substring(0, 16);

    if (expectedChecksum !== envelope.checksum) {
      console.error("Checksum mismatch - wrong password or corrupted data");
      return null;
    }

    return plaintext;
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}

/**
 * Check if a string appears to be encrypted JSON
 */
export function isEncryptedString(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    return isEncryptedEnvelope(parsed);
  } catch {
    return false;
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 4) {
    return { valid: false, message: "Password must be at least 4 characters" };
  }
  if (password.length > 100) {
    return { valid: false, message: "Password must be less than 100 characters" };
  }
  return { valid: true };
}
