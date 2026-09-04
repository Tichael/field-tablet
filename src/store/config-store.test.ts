import { describe, it, expect, afterEach } from "vitest";
import { detectDefaultPdfPageSize, getFormFoldersList } from "./config-store";
import type { AppConfig } from "./config-store";

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
