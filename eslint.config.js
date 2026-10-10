const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig.map((config) => config.files?.includes("**/*.ts")
    ? { ...config, files: [...config.files, "**/*.mts"] }
    : config),
  {
    ignores: [
      "node_modules/**",
      "android/**",
      "ios/**",
      "dist/**",
      "build/**",
      "coverage/**",
    ],
  },
]);
