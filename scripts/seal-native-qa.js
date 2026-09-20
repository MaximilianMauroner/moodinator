const path = require("node:path");
const { sealPreparedNativeSource } = require("./qa-source-provenance");

sealPreparedNativeSource(path.resolve(__dirname, ".."));
console.log("Prepared Android source sealed for exact-SHA QA.");
