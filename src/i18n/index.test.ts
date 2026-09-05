import { describe, it, expect, beforeEach, afterEach } from "vitest";
import en from "./locales/en.json";
import frCA from "./locales/fr-CA.json";
import {
  setDeviceLanguage,
  clearDeviceLanguageOverride,
  getDeviceLanguageOverride,
  syncLanguageWithConfig,
  getAppLanguage,
  formatAppDate,
  formatAppTime,
} from "./index";

describe("i18n catalog integrity", () => {
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

  it("should have identical translation keys in en.json and fr-CA.json", () => {
    const enKeys = getObjectKeys(en).sort();
    const frKeys = getObjectKeys(frCA).sort();

    const missingInFr = enKeys.filter((k) => !frKeys.includes(k));
    const missingInEn = frKeys.filter((k) => !enKeys.includes(k));

    expect(
      missingInFr,
      `Keys present in en.json but missing in fr-CA.json: ${missingInFr.join(", ")}`,
    ).toEqual([]);
    expect(
      missingInEn,
      `Keys present in fr-CA.json but missing in en.json: ${missingInEn.join(", ")}`,
    ).toEqual([]);
  });
});

describe("i18n runtime language resolution", () => {
  let mockStorage: Record<string, string> = {};

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
    await setDeviceLanguage("en");
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

  it("provides aligned default configuration filenames and placeholders in en and fr-CA", () => {
    expect(en.setup.defaultConfigFilename).toBe("tablet-config");
    expect(en.setup.newConfigPlaceholder).toContain("tablet-config");

    expect(frCA.setup.defaultConfigFilename).toBe("config-tablette");
    expect(frCA.setup.newConfigPlaceholder).toContain("config-tablette");
  });
});
