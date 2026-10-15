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
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/PrivateModal.tsx", "src/components/ui/PrivateDateTimePicker.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "react-native",
          importNames: ["Modal"],
          message: "Use PrivateModal. A React Native Modal stays above the App Lock screen.",
        }, {
          name: "@react-native-community/datetimepicker",
          importNames: ["default"],
          message: "Use PrivateDateTimePicker. Its Android dialog stays above the App Lock screen.",
        }],
      }],
    },
  },
]);
