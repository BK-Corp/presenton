export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const STORAGE_KEY = "presenton-ui-lang";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}

export function normalizeLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  if (typeof value === "string" && value.toLowerCase().startsWith("vi")) return "vi";
  return DEFAULT_LOCALE;
}
