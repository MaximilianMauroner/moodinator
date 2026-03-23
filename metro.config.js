const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

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
