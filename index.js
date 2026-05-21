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

require("expo-router/entry");
