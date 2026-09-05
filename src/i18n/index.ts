import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type SupportedLanguage = "en" | "fr-CA" | (string & {});

// Dynamically discover and load all locale files in ./locales/*.json
const localeModules = import.meta.glob<Record<string, any>>(
  "./locales/*.json",
  {
    eager: true,
    import: "default",
  },
);

export interface LanguageInfo {
  code: SupportedLanguage;
  label: string;
}

/**
 * Format language code to display label using native Intl API fallback.
 */
function getNativeLanguageLabel(code: string): string {
  try {
    const dn = new Intl.DisplayNames([code], { type: "language" });
    const name = dn.of(code);
    if (name) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {}
  return code;
}

const resources: Record<string, { translation: Record<string, any> }> = {};
const languagesList: LanguageInfo[] = [];

for (const [filePath, content] of Object.entries(localeModules)) {
  const code = filePath.replace(/^\.\/locales\//, "").replace(/\.json$/, "");
  resources[code] = { translation: content };

  const label =
    content._meta?.label ||
    content.languages?.[code] ||
    getNativeLanguageLabel(code);

  languagesList.push({ code, label });
}

// Automatically alias base languages (e.g. if 'fr-CA' exists and 'fr' does not, alias 'fr' to 'fr-CA')
for (const lang of Object.keys(resources)) {
  if (lang.includes("-")) {
    const base = lang.split("-")[0];
    if (!resources[base]) {
      resources[base] = resources[lang];
    }
  }
}

// Sort supported languages (placing 'en' first, then alphabetical)
languagesList.sort((a, b) => {
  if (a.code === "en") return -1;
  if (b.code === "en") return 1;
  return a.label.localeCompare(b.label);
});

export const SUPPORTED_LANGUAGES: LanguageInfo[] = languagesList;

/**
 * Normalizes any language code or tag against available locales.
 * Handles case insensitivity, territory variations (e.g. fr-FR -> fr-CA), and aliases.
 */
export function normalizeLanguage(lang?: string | null): SupportedLanguage {
  if (!lang) return "en";
  const clean = lang.trim();

  // If clean is already an exact supported language code (e.g. "en" or "fr-CA"), return it
  const directCode = SUPPORTED_LANGUAGES.find((l) => l.code === clean);
  if (directCode) return directCode.code;

  const lower = clean.toLowerCase();
  const directMatch = SUPPORTED_LANGUAGES.find(
    (l) => l.code.toLowerCase() === lower,
  );
  if (directMatch) return directMatch.code;

  const base = lower.split(/[-_]/)[0];
  const baseMatch = SUPPORTED_LANGUAGES.find((l) =>
    l.code.toLowerCase().startsWith(base),
  );
  if (baseMatch) return baseMatch.code;

  return "en";
}

/**
 * Detects default application language from environment/navigator.
 */
export function detectDefaultAppLanguage(): SupportedLanguage {
  if (typeof navigator !== "undefined" && navigator.language) {
    return normalizeLanguage(navigator.language);
  }
  return "en";
}

/**
 * Gets the manual device-level language override if one has been saved.
 */
export function getDeviceLanguageOverride(): SupportedLanguage | null {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("app_language");
    if (saved) {
      const normalized = normalizeLanguage(saved);
      if (resources[normalized]) {
        return normalized;
      }
    }
  }
  return null;
}

/**
 * Determines the initial language for i18next during bootstrap.
 */
function resolveInitialLanguage(): SupportedLanguage {
  const deviceOverride = getDeviceLanguageOverride();
  if (deviceOverride) {
    return deviceOverride;
  }
  return detectDefaultAppLanguage();
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

// Sync HTML document lang attribute whenever language changes
if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language || "en";
}
i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
});

/**
 * Sets a manual device language override and updates i18n immediately.
 */
export async function setDeviceLanguage(
  lang: SupportedLanguage,
): Promise<void> {
  const normalized = normalizeLanguage(lang);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("app_language", normalized);
  }
  await i18n.changeLanguage(normalized);
}

/**
 * Clears any manual device override so the device inherits the configuration language.
 */
export async function clearDeviceLanguageOverride(
  fallbackLang: SupportedLanguage = "en",
): Promise<void> {
  const normalized = normalizeLanguage(fallbackLang);
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("app_language");
  }
  await i18n.changeLanguage(normalized);
}

/**
 * Synchronizes the runtime language with the loaded configuration file.
 * If the user has set a manual device override, the manual override is preserved.
 */
export async function syncLanguageWithConfig(
  configLanguage?: SupportedLanguage,
): Promise<void> {
  const manualOverride = getDeviceLanguageOverride();
  if (!manualOverride) {
    const target = normalizeLanguage(configLanguage || "en");
    if (i18n.language !== target) {
      await i18n.changeLanguage(target);
    }
  }
}

/**
 * Gets the currently active application UI language.
 */
export function getAppLanguage(): SupportedLanguage {
  return normalizeLanguage(i18n.language);
}

/**
 * Locale mapping for Intl APIs.
 */
function getIntlLocale(lang?: SupportedLanguage): string {
  const current = lang ? normalizeLanguage(lang) : getAppLanguage();
  if (current === "fr-CA" || current.startsWith("fr")) return "fr-CA";
  return current === "en" ? "en-US" : current;
}

/**
 * Format a Date into a localized date string.
 */
export function formatAppDate(
  dateInput: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
  lang?: SupportedLanguage,
): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString(getIntlLocale(lang), options);
}

/**
 * Format a Date into a localized time string.
 */
export function formatAppTime(
  dateInput: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
  lang?: SupportedLanguage,
): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleTimeString(getIntlLocale(lang), options);
}

/**
 * Format a Date into a localized date and time string.
 */
export function formatAppDateTime(
  dateInput: Date | number | string,
  lang?: SupportedLanguage,
): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return `${formatAppDate(date, undefined, lang)} ${formatAppTime(date, { hour: "2-digit", minute: "2-digit" }, lang)}`;
}

export default i18n;
