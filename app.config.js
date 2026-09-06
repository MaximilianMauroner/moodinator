module.exports = ({ config }) => {
  if (process.env.MOODINATOR_VARIANT !== "qa") return config;

  return {
    ...config,
    name: "Moodinator QA",
    scheme: "moodinator-qa",
    ios: { ...config.ios, bundleIdentifier: "com.lab4code.moodinator.qa" },
    android: { ...config.android, package: "com.lab4code.moodinator.qa" },
  };
};
