const { readPreparedSourceSha } = require("./scripts/qa-source-provenance");

module.exports = ({ config }) => {
  if (process.env.MOODINATOR_VARIANT !== "qa") return config;

  const sourceSha = readPreparedSourceSha(__dirname, process.env);

  return {
    ...config,
    name: "Moodinator QA",
    scheme: "moodinator-qa",
    ios: { ...config.ios, bundleIdentifier: "com.lab4code.moodinator.qa" },
    android: { ...config.android, package: "com.lab4code.moodinator.qa" },
    extra: { ...config.extra, qaSourceSha: sourceSha },
  };
};
