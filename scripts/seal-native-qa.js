/* global __dirname */
const path = require("node:path");
const { sealPreparedNativeSource } = require("./qa-source-provenance");

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !/^--platform=(android|ios)$/.test(args[0]))) {
  throw new Error("Usage: qa:seal-native [--platform=android|ios]");
}
const platform = args[0]?.slice("--platform=".length) ?? "android";
sealPreparedNativeSource(path.resolve(__dirname, ".."), platform);
console.log(`Prepared ${platform === "ios" ? "iOS" : "Android"} source sealed for exact-SHA QA.`);
