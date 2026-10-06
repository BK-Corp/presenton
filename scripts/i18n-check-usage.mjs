// Verify that every dictionary key referenced in code actually exists in en.ts.
// Catches: t("ns.key") literals, quoted strings that look like dict paths (key maps).
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["servers/nextjs/app", "servers/nextjs/components", "servers/nextjs/lib", "servers/nextjs/utils"];
const TOP_LEVEL = new Set([
  "common", "ui", "upload", "advanced", "mode", "notify", "loading", "dashboard",
  "outline", "presentation", "community", "templates", "settings", "onboarding",
  "editor", "documents", "customTemplate", "auth", "editorTools", "providerConfig",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.cy\.tsx$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const en = (await import("../servers/nextjs/lib/i18n/dictionaries/en.ts")).default;
const vi = (await import("../servers/nextjs/lib/i18n/dictionaries/vi.ts")).default;

const resolve = (dict, dotPath) =>
  dotPath.split(".").reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), dict);

const files = ROOTS.flatMap((r) => (fs.existsSync(r) ? walk(r) : []));
const missing = [];
const pathLike = /^([a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+)$/;

for (const file of files) {
  if (file.includes("/i18n/dictionaries/")) continue;
  const src = fs.readFileSync(file, "utf8");
  const found = new Set();

  // t("...") / t('...') first-arg literals (skip dynamic `${}` and concat)
  for (const m of src.matchAll(/\bt\(\s*(["'])([^"'\n]+?)\1/g)) {
    found.add(m[2]);
  }
  for (const m of src.matchAll(/tRef\.current\(\s*(["'])([^"'\n]+?)\1/g)) {
    found.add(m[2]);
  }
  // any quoted string that looks like a dict path (covers key maps passed to t())
  for (const m of src.matchAll(/(["'])([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)\1/g)) {
    const candidate = m[2];
    if (TOP_LEVEL.has(candidate.split(".")[0])) found.add(candidate);
  }

  for (const keyPath of found) {
    if (/\{|\}/.test(keyPath)) continue; // interpolated template
    const enVal = resolve(en, keyPath);
    if (typeof enVal !== "string") {
      missing.push({ file, keyPath });
      continue;
    }
    const viVal = resolve(vi, keyPath);
    if (typeof viVal !== "string") {
      missing.push({ file, keyPath, note: "missing in vi" });
    }
  }
}

if (missing.length === 0) {
  console.log("All referenced keys exist in en + vi.");
} else {
  const uniq = [...new Map(missing.map((m) => [m.keyPath + "|" + m.file, m])).values()];
  console.log(`MISSING REFERENCES: ${uniq.length}`);
  for (const m of uniq) console.log(`  ${m.file}  ->  ${m.keyPath}${m.note ? " (" + m.note + ")" : ""}`);
  process.exit(1);
}
