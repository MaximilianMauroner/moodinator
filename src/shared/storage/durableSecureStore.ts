import * as SecureStore from "expo-secure-store";

const DURABILITY_MARKER_SUFFIX = ".moodinatorDurabilityCheck";
let durableWriteTail = Promise.resolve();

/**
 * Persist a SecureStore value and require one checked Android preferences commit.
 *
 * expo-secure-store 55.0.18 ignores the Boolean returned by non-null writes on
 * Android, but its delete path rejects when SharedPreferences.commit() fails.
 * The final marker deletion commits the complete in-memory preferences map, so
 * success also makes the requested value durable. Writes are serialized so one
 * call cannot remove another call's marker. Remove this sequence when the
 * installed SecureStore version rejects failed non-null commits itself.
 */
export async function setDurableItemAsync(
  key: string,
  value: string,
  options?: SecureStore.SecureStoreOptions
): Promise<void> {
  const write = durableWriteTail.then(async () => {
    const markerKey = `${key}${DURABILITY_MARKER_SUFFIX}`;
    await SecureStore.setItemAsync(markerKey, "pending", options);
    await SecureStore.setItemAsync(key, value, options);
    await SecureStore.deleteItemAsync(markerKey, options);
  });
  durableWriteTail = write.catch(() => undefined);
  await write;
}
