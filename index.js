const { LogBox } = require("react-native");

const ignoredWarnings = [
  "SafeAreaView has been deprecated",
];

const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.map(String).join(" ");

  if (ignoredWarnings.some((warning) => message.includes(warning))) {
    return;
  }

  originalWarn(...args);
};

LogBox.ignoreLogs(ignoredWarnings);

if (require("expo-constants").default.expoConfig?.extra?.qaEncryptionProof === true) {
  const { registerRootComponent } = require("expo");
  registerRootComponent(require("./src/qa/encryption/Entry").default);
} else {
  require("expo-router/entry");
}
