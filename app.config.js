/* global __dirname */
const { readPreparedSourceSha } = require("./scripts/qa-source-provenance");

module.exports = ({ config }) => {
  if (process.env.MOODINATOR_QA_ENCRYPTION_PROOF === "1" && process.env.MOODINATOR_VARIANT !== "qa") {
    throw new Error("Native encryption proof requires the separate QA variant.");
  }
  if (process.env.MOODINATOR_VARIANT !== "qa") return config;

  // The sealed manifest covers generated Android inputs. iOS QA configuration
  // must remain usable without requiring an unrelated Android prebuild first.
  const isIosConfig =
    process.env.EAS_BUILD_PLATFORM === "ios" || process.env.EXPO_OS === "ios";
  const sourceSha = isIosConfig
    ? undefined
    : readPreparedSourceSha(__dirname, process.env);

  return {
    ...config,
    name: "Moodinator QA",
    scheme: "moodinator-qa",
    ios: { ...config.ios, bundleIdentifier: "com.lab4code.moodinator.qa" },
    android: { ...config.android, package: "com.lab4code.moodinator.qa" },
    extra: {
      ...config.extra,
      ...(sourceSha ? { qaSourceSha: sourceSha } : {}),
      ...(process.env.MOODINATOR_QA_ENCRYPTION_PROOF === "1" ? { qaEncryptionProof: true } : {}),
    },
  };
};
