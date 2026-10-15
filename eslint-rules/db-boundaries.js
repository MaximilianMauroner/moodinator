const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fromRoot = (file) => path.join(root, file);

const client = fromRoot("db/client");
const clientOwners = new Set(["db/writeQueue.ts", "src/qa/encryption/proof.ts"].map(fromRoot));
const sqliteOwner = fromRoot("db/encryption/native.ts");
const aliases = [["@db/", "db"], ["@/", "src"]];

function resolveImport(importer, specifier) {
  const alias = aliases.find(([prefix]) => specifier.startsWith(prefix));
  let target = null;
  if (alias) {
    target = path.resolve(root, alias[1], specifier.slice(alias[0].length));
  } else if (specifier.startsWith(".")) {
    target = path.resolve(path.dirname(importer), specifier);
  }
  return target?.replace(/\.[cm]?[jt]sx?$/, "");
}

function literalSource(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

function isTypeOnly(node) {
  if (node.importKind === "type" || node.exportKind === "type") return true;
  const specifiers = node.specifiers ?? [];
  return specifiers.length > 0
    && specifiers.every((specifier) => specifier.importKind === "type" || specifier.exportKind === "type");
}

function importsOnlyReadDb(node) {
  return node.type === "ImportDeclaration"
    && node.specifiers.length > 0
    && node.specifiers.every((specifier) => specifier.type === "ImportSpecifier"
      && (specifier.importKind === "type"
        || (specifier.imported.name ?? specifier.imported.value) === "readDb"));
}

module.exports = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      rawConnection: "The raw connection is private. Use readDb for queries or runInTransaction for writes.",
      sqlite: "Only db/encryption/native.ts may import Expo SQLite at runtime. Use readDb for queries or runInTransaction for writes.",
    },
  },
  create(context) {
    const filename = path.resolve(context.filename);

    function check(node, sourceNode) {
      const source = literalSource(sourceNode);
      if (source === null || isTypeOnly(node)) return;

      if (source === "expo-sqlite" || source.startsWith("expo-sqlite/")) {
        if (filename !== sqliteOwner) context.report({ node, messageId: "sqlite" });
        return;
      }

      if (resolveImport(filename, source) !== client || clientOwners.has(filename)) return;
      if (!importsOnlyReadDb(node)) context.report({ node, messageId: "rawConnection" });
    }

    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      TSImportEqualsDeclaration: (node) => check(node, node.moduleReference.expression),
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require") check(node, node.arguments[0]);
      },
    };
  },
};
