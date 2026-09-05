import { describe, it, expect, beforeEach, afterEach } from "vitest";
import i18n, {
  setDeviceLanguage,
  clearDeviceLanguageOverride,
  getDeviceLanguageOverride,
  syncLanguageWithConfig,
  getAppLanguage,
  formatAppDate,
  formatAppTime,
  normalizeLanguage,
  detectDefaultAppLanguage,
  SUPPORTED_LANGUAGES,
} from "./index";

const localeFiles = import.meta.glob<Record<string, any>>("./locales/*.json", {
  eager: true,
  import: "default",
});

describe("i18n catalog integrity and dynamic discovery", () => {
  function getObjectKeys(obj: Record<string, any>, prefix = ""): string[] {
    let keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        keys = keys.concat(getObjectKeys(v, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  it("should dynamically discover all locale files and populate SUPPORTED_LANGUAGES", () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(2);
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toContain("en");
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toContain("fr-CA");

    // Labels should be populated
    const enEntry = SUPPORTED_LANGUAGES.find((l) => l.code === "en");
    const frEntry = SUPPORTED_LANGUAGES.find((l) => l.code === "fr-CA");
    expect(enEntry?.label).toBe("English");
    expect(frEntry?.label).toBe("Français (Canada)");
  });

  it("should have identical translation keys across all discovered locales", () => {
    const enContent = localeFiles["./locales/en.json"];
    expect(enContent).toBeDefined();
    const enKeys = getObjectKeys(enContent).sort();

    for (const [filePath, content] of Object.entries(localeFiles)) {
      if (filePath === "./locales/en.json") continue;
      const localeKeys = getObjectKeys(content).sort();

      const missingInLocale = enKeys.filter((k) => !localeKeys.includes(k));
      const missingInEn = localeKeys.filter((k) => !enKeys.includes(k));

      expect(
        missingInLocale,
        `Keys in en.json missing in ${filePath}: ${missingInLocale.join(", ")}`,
      ).toEqual([]);
      expect(
        missingInEn,
        `Keys in ${filePath} missing in en.json: ${missingInEn.join(", ")}`,
      ).toEqual([]);
    }
  });
});

describe("i18n runtime language resolution & normalization", () => {
  let mockStorage: Record<string, string> = {};
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    mockStorage = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
  });

  afterEach(async () => {
    mockStorage = {};
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
    await setDeviceLanguage("en");
  });

  it("normalizes language codes including territory and base language fallbacks", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("fr-CA")).toBe("fr-CA");
    expect(normalizeLanguage("fr-ca")).toBe("fr-CA");
    expect(normalizeLanguage("fr")).toBe("fr-CA");
    expect(normalizeLanguage("fr-FR")).toBe("fr-CA");
    expect(normalizeLanguage("")).toBe("en");
    expect(normalizeLanguage(null)).toBe("en");
  });

  it("resolves French catalog when language is set to 'fr' via alias", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("header.settings")).toBe("Paramètres");
    expect(getAppLanguage()).toBe("fr-CA");

    await setDeviceLanguage("fr");
    expect(i18n.t("header.settings")).toBe("Paramètres");
    expect(getDeviceLanguageOverride()).toBe("fr-CA");
  });

  it("detects default application language from navigator", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "fr-CA" },
      configurable: true,
    });
    expect(detectDefaultAppLanguage()).toBe("fr-CA");

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "fr-FR" },
      configurable: true,
    });
    expect(detectDefaultAppLanguage()).toBe("fr-CA");

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-US" },
      configurable: true,
    });
    expect(detectDefaultAppLanguage()).toBe("en");
  });

  it("should allow setting and reading manual device language", async () => {
    expect(getDeviceLanguageOverride()).toBeNull();

    await setDeviceLanguage("fr-CA");
    expect(getDeviceLanguageOverride()).toBe("fr-CA");
    expect(getAppLanguage()).toBe("fr-CA");
    expect(localStorage.getItem("app_language")).toBe("fr-CA");

    await setDeviceLanguage("en");
    expect(getDeviceLanguageOverride()).toBe("en");
    expect(getAppLanguage()).toBe("en");
  });

  it("should clear device language override and inherit fallback", async () => {
    await setDeviceLanguage("fr-CA");
    expect(getDeviceLanguageOverride()).toBe("fr-CA");

    await clearDeviceLanguageOverride("en");
    expect(getDeviceLanguageOverride()).toBeNull();
    expect(getAppLanguage()).toBe("en");
  });

  it("should inherit configuration language when no device override is set", async () => {
    expect(getDeviceLanguageOverride()).toBeNull();

    await syncLanguageWithConfig("fr-CA");
    expect(getAppLanguage()).toBe("fr-CA");

    await syncLanguageWithConfig("en");
    expect(getAppLanguage()).toBe("en");
  });

  it("should NOT override manual device setting when syncing with configuration", async () => {
    await setDeviceLanguage("en");
    expect(getDeviceLanguageOverride()).toBe("en");

    // Config specifies fr-CA, but device has explicit override for en
    await syncLanguageWithConfig("fr-CA");
    expect(getAppLanguage()).toBe("en");
  });

  it("formats dates and times using locale rules", () => {
    const testDate = new Date(2026, 8, 5, 14, 30); // 2026-09-05 14:30
    const enDate = formatAppDate(testDate, undefined, "en");
    const frDate = formatAppDate(testDate, undefined, "fr-CA");

    expect(enDate).toBeTruthy();
    expect(frDate).toBeTruthy();

    const enTime = formatAppTime(
      testDate,
      { hour: "2-digit", minute: "2-digit" },
      "en",
    );
    const frTime = formatAppTime(
      testDate,
      { hour: "2-digit", minute: "2-digit" },
      "fr-CA",
    );

    expect(enTime).toBeTruthy();
    expect(frTime).toBeTruthy();
  });
});
