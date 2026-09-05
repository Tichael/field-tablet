import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import frCA from "./locales/fr-CA.json";

export type SupportedLanguage = "en" | "fr-CA";

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string }[] =
  [
    { code: "en", label: "English" },
    { code: "fr-CA", label: "Français (Canada)" },
  ];

/**
 * Gets the manual device-level language override if one has been saved.
 * Per-device settings are manual only; no automatic detection is used at runtime.
 */
export function getDeviceLanguageOverride(): SupportedLanguage | null {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("app_language");
    if (saved === "en" || saved === "fr-CA") {
      return saved;
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
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "fr-CA": { translation: frCA },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

// Sync initial HTML document lang attribute if in browser
if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language || "en";
}

/**
 * Sets a manual device language override and updates i18n immediately.
 */
export async function setDeviceLanguage(
  lang: SupportedLanguage,
): Promise<void> {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("app_language", lang);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
  await i18n.changeLanguage(lang);
}

/**
 * Clears any manual device override so the device inherits the configuration language.
 */
export async function clearDeviceLanguageOverride(
  fallbackLang: SupportedLanguage = "en",
): Promise<void> {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("app_language");
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = fallbackLang;
  }
  await i18n.changeLanguage(fallbackLang);
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
    const target = configLanguage || "en";
    if (i18n.language !== target) {
      if (typeof document !== "undefined") {
        document.documentElement.lang = target;
      }
      await i18n.changeLanguage(target);
    }
  }
}

/**
 * Gets the currently active application UI language.
 */
export function getAppLanguage(): SupportedLanguage {
  const lang = i18n.language;
  return lang === "fr-CA" ? "fr-CA" : "en";
}

/**
 * Locale mapping for Intl APIs.
 */
function getIntlLocale(lang?: SupportedLanguage): string {
  const current = lang || getAppLanguage();
  return current === "fr-CA" ? "fr-CA" : "en-US";
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
