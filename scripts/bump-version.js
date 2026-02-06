const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const appPath = path.join(root, "app.json");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const app = JSON.parse(fs.readFileSync(appPath, "utf-8"));

// Use app.json as source of truth
const current = app.expo.version;
const [major, minor] = current.split(".").map(Number);
const next = `${major}.${minor + 1}.0`;

pkg.version = next;
app.expo.version = next;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + "\n");

console.log(`Version bumped: ${current} -> ${next}`);
