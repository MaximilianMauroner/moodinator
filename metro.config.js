const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

if (process.env.MOODINATOR_METRO_MAX_WORKERS !== undefined) {
  const maxWorkers = Number(process.env.MOODINATOR_METRO_MAX_WORKERS);
  if (!Number.isSafeInteger(maxWorkers) || maxWorkers < 1) {
    throw new Error("MOODINATOR_METRO_MAX_WORKERS must be a positive integer");
  }
  config.maxWorkers = maxWorkers;
}

const isIosQaConfig =
  process.env.EAS_BUILD_PLATFORM === "ios" || process.env.EXPO_OS === "ios";
if (process.env.MOODINATOR_VARIANT === "qa" && !isIosQaConfig) {
  require("./scripts/qa-source-provenance").readPreparedSourceSha(__dirname, process.env);
}

config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts ?? []), "wasm"])
);

// Enable inline requires for better performance
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,
    },
  }),
};

// Force a single React Navigation module graph so Expo Router and app code
// share the same context singletons at runtime.
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules ?? {}),
    "@react-navigation/bottom-tabs": path.resolve(__dirname, "node_modules/@react-navigation/bottom-tabs"),
    "@react-navigation/core": path.resolve(__dirname, "node_modules/@react-navigation/core"),
    "@react-navigation/elements": path.resolve(__dirname, "node_modules/@react-navigation/elements"),
    "@react-navigation/native": path.resolve(__dirname, "node_modules/@react-navigation/native"),
    "@react-navigation/native-stack": path.resolve(__dirname, "node_modules/@react-navigation/native-stack"),
    "@react-navigation/routers": path.resolve(__dirname, "node_modules/@react-navigation/routers"),
  },
};

module.exports = withNativeWind(config, { input: "./src/app/global.css" });
