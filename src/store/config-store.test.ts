import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  detectDefaultAppLanguage,
  detectDefaultAppTitle,
  detectDefaultPdfPageSize,
  getDefaultConfig,
  getFormFoldersList,
  DEFAULT_CONFIG,
  useConfigStore,
} from "./config-store";
import type { AppConfig } from "./config-store";
import { syncManager } from "../lib/sync/sync-manager";

describe("config-store getFormFoldersList", () => {
  it("should return empty array when formFolders is undefined or empty", () => {
    expect(getFormFoldersList(null)).toEqual([]);
    expect(getFormFoldersList({} as AppConfig)).toEqual([]);
    expect(getFormFoldersList({ formFolders: {} } as AppConfig)).toEqual([]);
  });

  it("should extract non-empty folders from FormFoldersConfig object", () => {
    const config: AppConfig = {
      theme: { primaryColor: "#000", darkMode: "system" },
      branding: { appTitle: "Test" },
      formFolders: {
        dailyReports: "Reports/Daily Reports",
        incidentLogs: "Safety/Incidents",
      },
    };
    expect(getFormFoldersList(config)).toEqual([
      "Reports/Daily Reports",
      "Safety/Incidents",
    ]);
  });

  it("should extract customFolders along with starter form folders", () => {
    const config: AppConfig = {
      theme: { primaryColor: "#000", darkMode: "system" },
      branding: { appTitle: "Test" },
      formFolders: {
        dailyReports: "Reports/Daily Reports",
        customFolders: ["Custom/Safety Audit", "Custom/HVAC"],
      },
    };
    expect(getFormFoldersList(config)).toEqual([
      "Reports/Daily Reports",
      "Custom/Safety Audit",
      "Custom/HVAC",
    ]);
  });

  it("should support string array formFolders", () => {
    const config = {
      formFolders: ["Reports", "Inspections"],
    } as unknown as AppConfig;
    expect(getFormFoldersList(config)).toEqual(["Reports", "Inspections"]);
  });

  it("should support object with folders array", () => {
    const config: AppConfig = {
      theme: { primaryColor: "#000", darkMode: "system" },
      branding: { appTitle: "Test" },
      formFolders: {
        folders: ["Forms/Field", "Forms/Safety"],
      },
    };
    expect(getFormFoldersList(config)).toEqual(["Forms/Field", "Forms/Safety"]);
  });
});

describe("config-store detectDefaultPdfPageSize", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("should return letter for US locale", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-US" },
      configurable: true,
    });
    expect(detectDefaultPdfPageSize()).toBe("letter");
  });

  it("should return letter for Canadian or Mexican locales", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-CA" },
      configurable: true,
    });
    expect(detectDefaultPdfPageSize()).toBe("letter");

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "es-MX" },
      configurable: true,
    });
    expect(detectDefaultPdfPageSize()).toBe("letter");
  });

  it("should return a4 for European / international locales", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-GB" },
      configurable: true,
    });
    expect(detectDefaultPdfPageSize()).toBe("a4");

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "de-DE" },
      configurable: true,
    });
    expect(detectDefaultPdfPageSize()).toBe("a4");

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "fr-FR" },
      configurable: true,
    });
    expect(detectDefaultPdfPageSize()).toBe("a4");
  });
});

describe("config-store media configuration", () => {
  it("should have 2mp default photoQuality in DEFAULT_CONFIG", () => {
    expect(DEFAULT_CONFIG.media?.photoQuality).toBe("2mp");
  });
});

describe("config-store detectDefaultAppLanguage", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("should return fr-CA for French locales", () => {
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
      value: { language: "fr" },
      configurable: true,
    });
    expect(detectDefaultAppLanguage()).toBe("fr-CA");
  });

  it("should return en for English and other non-French locales", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-US" },
      configurable: true,
    });
    expect(detectDefaultAppLanguage()).toBe("en");

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-CA" },
      configurable: true,
    });
    expect(detectDefaultAppLanguage()).toBe("en");

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "es-MX" },
      configurable: true,
    });
    expect(detectDefaultAppLanguage()).toBe("en");
  });
});

describe("config-store detectDefaultAppTitle and getDefaultConfig", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("should return Tablette de terrain for fr-CA", () => {
    expect(detectDefaultAppTitle("fr-CA")).toBe("Tablette de terrain");
  });

  it("should return Field Tablet for en", () => {
    expect(detectDefaultAppTitle("en")).toBe("Field Tablet");
  });

  it("should detect title based on navigator if no language passed", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { language: "fr-CA" },
      configurable: true,
    });
    expect(detectDefaultAppTitle()).toBe("Tablette de terrain");

    Object.defineProperty(globalThis, "navigator", {
      value: { language: "en-US" },
      configurable: true,
    });
    expect(detectDefaultAppTitle()).toBe("Field Tablet");
  });

  it("should produce localized getDefaultConfig", () => {
    const frConfig = getDefaultConfig("fr-CA");
    expect(frConfig.language).toBe("fr-CA");
    expect(frConfig.branding.appTitle).toBe("Tablette de terrain");

    const enConfig = getDefaultConfig("en");
    expect(enConfig.language).toBe("en");
    expect(enConfig.branding.appTitle).toBe("Field Tablet");
  });
});

describe("config-store saveConfig during initial setup", () => {
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

  it("saves initial configuration and creates file via storage adapter", async () => {
    const savedFiles: Record<string, string> = {};
    const mockAdapter = {
      id: "mock-storage",
      isAvailable: () => true,
      saveFile: async (path: string, content: string) => {
        savedFiles[path] = content;
      },
      readFileText: async (path: string) => savedFiles[path] || "",
    } as any;

    (syncManager as any).adapter = mockAdapter;

    const initialConfig: AppConfig = {
      ...DEFAULT_CONFIG,
      language: "fr-CA",
      branding: {
        ...DEFAULT_CONFIG.branding,
        appTitle: "Application Tablette Terrain",
      },
    };

    await useConfigStore
      .getState()
      .saveConfig(initialConfig, "config-tablette.json");

    expect(savedFiles["config-tablette.json"]).toBeDefined();
    const parsed = JSON.parse(savedFiles["config-tablette.json"]);
    expect(parsed.language).toBe("fr-CA");
    expect(parsed.branding.appTitle).toBe("Application Tablette Terrain");
    expect(useConfigStore.getState().activeConfigFile).toBe(
      "config-tablette.json",
    );
    expect(useConfigStore.getState().config?.language).toBe("fr-CA");
    expect(mockStorage["activeConfigFile"]).toBe("config-tablette.json");
  });
});
