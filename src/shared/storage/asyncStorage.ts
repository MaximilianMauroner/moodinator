import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`[storage] Failed to read key "${key}":`, error);
    return null;
  }
}

export async function setString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error(`[storage] Failed to write key "${key}":`, error);
    throw error;
  }
}

export async function getBoolean(key: string): Promise<boolean | null> {
  const value = await getString(key);
  if (value === null) {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export async function setBoolean(key: string, value: boolean): Promise<void> {
  await setString(key, String(value));
}

export async function getJson<T>(key: string): Promise<T | null> {
  const value = await getString(key);
  if (value === null) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`[storage] Failed to parse JSON for key "${key}":`, error);
    return null;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await setString(key, JSON.stringify(value));
}

