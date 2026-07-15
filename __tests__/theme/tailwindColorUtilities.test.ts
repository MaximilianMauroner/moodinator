import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { createRequire } from "node:module";

type Palette = Record<string, string | Record<string, string>>;
type TailwindConfig = { theme: { extend: { colors: Palette } } };

const require = createRequire(import.meta.url);
const config = require("../../tailwind.config.js") as TailwindConfig;
const customColors = config.theme.extend.colors;
const customColorNames = Object.keys(customColors).join("|");
const utilityPattern = new RegExp(
  `(?:bg|text|border|ring|from|via|to|shadow)-(${customColorNames})-([a-z]+|\\d+)`,
  "g"
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".js", ".jsx", ".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

describe("custom Tailwind color utilities", () => {
  it("reference shades defined in the Tailwind palette", () => {
    const missing = new Set<string>();

    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      for (const match of readFileSync(file, "utf8").matchAll(utilityPattern)) {
        const [, color, shade] = match;
        const palette = customColors[color];
        if (typeof palette !== "object" || !(shade in palette)) {
          missing.add(`${color}-${shade}`);
        }
      }
    }

    expect([...missing].sort()).toEqual([]);
  });
});
