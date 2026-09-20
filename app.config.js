module.exports = ({ config }) => {
  if (process.env.MOODINATOR_VARIANT !== "qa") return config;

  const sourceSha = process.env.MOODINATOR_SOURCE_SHA;
  if (!sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error("QA builds require MOODINATOR_SOURCE_SHA as a full lowercase Git SHA.");
  }

  return {
    ...config,
    name: "Moodinator QA",
    scheme: "moodinator-qa",
    ios: { ...config.ios, bundleIdentifier: "com.lab4code.moodinator.qa" },
    android: { ...config.android, package: "com.lab4code.moodinator.qa" },
    extra: { ...config.extra, qaSourceSha: sourceSha },
  };
};
