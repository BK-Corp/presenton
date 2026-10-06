// Merge pending i18n manifest JSON files into en.ts and vi.ts.
// Usage: node scripts/i18n-merge-pending.mjs
// Manifest format: { "ns.sub.key": { "en": "...", "vi": "..." }, ... }
// Handles both new top-level namespaces and sub-objects of existing ones.
import fs from "node:fs";
import path from "node:path";

const PENDING_DIR = "servers/nextjs/lib/i18n/pending";
const DICTS = {
  en: "servers/nextjs/lib/i18n/dictionaries/en.ts",
  vi: "servers/nextjs/lib/i18n/dictionaries/vi.ts",
};

function collectManifests() {
  const merged = {};
  for (const file of fs.readdirSync(PENDING_DIR).filter((f) => f.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, file), "utf8"));
    for (const [key, value] of Object.entries(data)) {
      if (merged[key]) console.warn(`WARN duplicate key across manifests: ${key}`);
      merged[key] = value;
    }
  }
  return merged;
}

function buildTree(flat, lang) {
  const tree = {};
  for (const [dotPath, value] of Object.entries(flat)) {
    const text = value?.[lang];
    if (typeof text !== "string") {
      console.warn(`WARN missing ${lang} for ${dotPath}, skipping`);
      continue;
    }
    const parts = dotPath.split(".");
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= {};
      node = node[parts[i]];
    }
    node[parts.at(-1)] = text;
  }
  return tree;
}

const serialize = (obj, indent) => {
  const pad = " ".repeat(indent);
  const padIn = " ".repeat(indent + 2);
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object") {
      lines.push(`${padIn}${key}: {`);
      lines.push(serialize(value, indent + 2));
      lines.push(`${padIn}},`);
    } else {
      lines.push(`${padIn}${key}: ${JSON.stringify(value)},`);
    }
  }
  return lines.join("\n");
};

// Find the index of the closing brace (at `indent` spaces) of the object
// opened at `openLine` (matched via `openRegex`), using a string-aware scan.
function findObjectClose(src, openRegex) {
  const lines = src.split("\n");
  const openIdx = lines.findIndex((l) => openRegex.test(l));
  if (openIdx < 0) return null;
  const indent = lines[openIdx].match(/^(\s*)/)[1].length;
  // scan from openIdx, tracking depth with a per-line brace count that is
  // string/comment aware
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < lines.length; i++) {
    const line = lines[i];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (inStr) {
        if (ch === "\\") c++;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "\"" || ch === "'" || ch === "`") {
        inStr = ch;
        continue;
      }
      if (ch === "/" && line[c + 1] === "/") break;
      if (ch === "/" && line[c + 1] === "*") break;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return { lines, openIdx, closeIdx: i, indent };
        }
      }
    }
  }
  return null;
}

const manifests = collectManifests();
if (Object.keys(manifests).length === 0) {
  console.log("No pending manifests found.");
  process.exit(0);
}

const trees = { en: buildTree(manifests, "en"), vi: buildTree(manifests, "vi") };

for (const [lang, file] of Object.entries(DICTS)) {
  let src = fs.readFileSync(file, "utf8");
  const topNamespaces = Object.keys(trees[lang]);
  let changed = false;

  for (const ns of topNamespaces) {
    const existsRe = new RegExp(`^  ${ns}: \\{`, "m");
    if (!existsRe.test(src)) continue;

    // Namespace exists: merge each missing second-level sub-object inside it.
    // Scope the existence check to lines within this namespace's block so that
    // a same-named sub-object in another namespace cannot cause a false skip.
    for (const sub of Object.keys(trees[lang][ns])) {
      const nsClose = findObjectClose(src, new RegExp(`^  ${ns}: \\{`));
      if (!nsClose) throw new Error(`Cannot locate ${ns} object in ${file}`);
      const nsBlock = nsClose.lines
        .slice(nsClose.openIdx, nsClose.closeIdx + 1)
        .join("\n");
      const subExistsRe = new RegExp(`^ {${close.indent + 2}}${sub}: \\{`, "m");
      if (subExistsRe.test(nsBlock)) {
        console.warn(`${lang}: ${ns}.${sub} already present, skipping`);
        continue;
      }
      const close = nsClose;
      const lines = close.lines;
      const block = `    ${sub}: {\n${serialize(trees[lang][ns][sub], 4)}\n    },`;
      lines.splice(close.closeIdx, 0, block);
      src = lines.join("\n");
      changed = true;
      console.log(`${lang}: inserted ${ns}.${sub} (${Object.keys(trees[lang][ns][sub]).length} keys)`);
    }
    delete trees[lang][ns];
  }

  // Remaining = brand-new top-level namespaces.
  const newNamespaces = Object.keys(trees[lang]);
  if (newNamespaces.length > 0) {
    const anchor = src.lastIndexOf("};");
    if (anchor < 0) throw new Error(`Cannot find closing anchor in ${file}`);
    const block = newNamespaces
      .map((ns) => `  ${ns}: {\n${serialize(trees[lang][ns], 2)}\n  },`)
      .join("\n");
    src = src.slice(0, anchor) + block + "\n" + src.slice(anchor);
    changed = true;
    console.log(`${lang}: appended new namespaces ${newNamespaces.join(", ")}`);
  }

  if (changed) {
    fs.writeFileSync(file, src);
  } else {
    console.log(`${lang}: nothing to merge.`);
  }
}
