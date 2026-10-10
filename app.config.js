/* global __dirname */
const { readPreparedSourceSha } = require("./scripts/qa-source-provenance");

module.exports = ({ config }) => {
  if (process.env.MOODINATOR_QA_ENCRYPTION_PROOF === "1" && process.env.MOODINATOR_VARIANT !== "qa") {
    throw new Error("Native encryption proof requires the separate QA variant.");
  }
  if (process.env.MOODINATOR_VARIANT !== "qa") return config;

  // Ordinary iOS QA can run without a seal. Encryption proof binds both native
  // platforms to the prepared source and their own generated inputs.
  const isIosConfig =
    process.env.EAS_BUILD_PLATFORM === "ios" || process.env.EXPO_OS === "ios";
  const sourceSha = isIosConfig && process.env.MOODINATOR_QA_ENCRYPTION_PROOF !== "1"
    ? undefined
    : readPreparedSourceSha(__dirname, process.env, isIosConfig ? "ios" : "android");

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
