// Deep-compare en/vi i18n dictionaries: report missing, extra, and untranslated keys.
import en from "../servers/nextjs/lib/i18n/dictionaries/en.ts";
import vi from "../servers/nextjs/lib/i18n/dictionaries/vi.ts";

const flatten = (obj, prefix = "", out = {}) => {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, path, out);
    else out[path] = value;
  }
  return out;
};

const enFlat = flatten(en);
const viFlat = flatten(vi);
const enKeys = new Set(Object.keys(enFlat));
const viKeys = new Set(Object.keys(viFlat));

const missingInVi = [...enKeys].filter((k) => !viKeys.has(k));
const extraInVi = [...viKeys].filter((k) => !enKeys.has(k));
const untranslated = [...enKeys].filter(
  (k) => viKeys.has(k) && viFlat[k] === enFlat[k] && /\p{L}{3}/u.test(String(enFlat[k])),
);

const countByNs = (keys) => {
  const counts = {};
  for (const k of keys) {
    const ns = k.split(".").slice(0, 2).join(".");
    counts[ns] = (counts[ns] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
};

console.log(`EN keys: ${enKeys.size}  VI keys: ${viKeys.size}`);
console.log(`\n=== MISSING IN VI (${missingInVi.length}) ===`);
console.log(countByNs(missingInVi));
for (const k of missingInVi) console.log(k);
console.log(`\n=== EXTRA IN VI (${extraInVi.length}) ===`);
for (const k of extraInVi) console.log(k, "=>", viFlat[k]);
console.log(`\n=== UNTRANSLATED (vi === en) (${untranslated.length}) ===`);
console.log(countByNs(untranslated));
for (const k of untranslated) console.log(`${k} = ${enFlat[k]}`);
