// Heuristic scan for hardcoded user-visible English strings in Next.js app code.
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["servers/nextjs/app", "servers/nextjs/components"];
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const SKIP_FILES = new Set(["dictionaries"]);

const results = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(p);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !SKIP_FILES.has(entry.name)) {
      scan(p);
    }
  }
}

const JSX_TEXT = />[ \t]*([A-Z][^<>{}"'\n]*[a-zA-Z.!?])[ \t]*</g;
const STRING_PROP = /\b(placeholder|title|label|description|message|tooltip|subtitle)=\{?"([A-Z][a-zA-Z0-9 ,.'%:;!?()\-\u2019\u2013]{4,})"/g;
const TOAST_CALL = /\b(toast|notify)\.\w+\(\s*[\{\s]*["'`](["'`])([A-Z][^"'`\n]{4,})\1/g;

function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  if (!/useT|useLanguage|t\(/.test(src)) return; // only files already i18n-aware
  const rel = file.replaceAll("\\", "/");
  const hits = [];
  for (const m of src.matchAll(JSX_TEXT)) {
    const text = m[1].trim();
    if (text.length < 3) continue;
    if (/^(div|span|p|h[1-6]|button|input|svg|path|img|ul|li|section|a|em|strong|b|i)$/i.test(text)) continue;
    if (/^(http|\/|\.\/|@\/|#[a-f0-9]{3,8}|data:|var\(|--)/i.test(text)) continue;
    hits.push({ line: src.slice(0, m.index).split("\n").length, kind: "jsx", text });
  }
  for (const m of src.matchAll(STRING_PROP)) {
    hits.push({ line: src.slice(0, m.index).split("\n").length, kind: m[1], text: m[2] });
  }
  for (const m of src.matchAll(TOAST_CALL)) {
    hits.push({ line: src.slice(0, m.index).split("\n").length, kind: "toast", text: m[3] });
  }
  if (hits.length) results.push({ file: rel, hits });
}

for (const r of ROOTS) walk(r);

let total = 0;
for (const r of results) {
  console.log(`\n## ${r.file}`);
  for (const h of r.hits) {
    total++;
    console.log(`  L${h.line} [${h.kind}] ${h.text.slice(0, 110)}`);
  }
}
console.log(`\nTOTAL: ${total} candidate strings in ${results.length} files`);
