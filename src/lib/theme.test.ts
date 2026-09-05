import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isDefaultOrNeutralColor,
  parseHex,
  getLuminance,
  rgbToHsl,
  hslToHex,
  resolvePrimaryColors,
  applyTheme,
} from "./theme";

describe("theme utility", () => {
  let mockHtml: {
    classList: {
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
      contains: ReturnType<typeof vi.fn>;
    };
    style: {
      setProperty: ReturnType<typeof vi.fn>;
      removeProperty: ReturnType<typeof vi.fn>;
      getPropertyValue: ReturnType<typeof vi.fn>;
    };
  };

  const originalDocument = (globalThis as any).document;

  beforeEach(() => {
    const classes = new Set<string>();
    const styles = new Map<string, string>();

    mockHtml = {
      classList: {
        add: vi.fn((cls: string) => classes.add(cls)),
        remove: vi.fn((cls: string) => classes.delete(cls)),
        contains: vi.fn((cls: string) => classes.has(cls)),
      },
      style: {
        setProperty: vi.fn((prop: string, val: string) =>
          styles.set(prop, val),
        ),
        removeProperty: vi.fn((prop: string) => styles.delete(prop)),
        getPropertyValue: vi.fn((prop: string) => styles.get(prop) || ""),
      },
    };

    (globalThis as any).document = {
      documentElement: mockHtml,
    };
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  describe("isDefaultOrNeutralColor", () => {
    it("identifies default dark slate colors as neutral default", () => {
      expect(isDefaultOrNeutralColor("#0f172a")).toBe(true);
      expect(isDefaultOrNeutralColor("#0F172A")).toBe(true);
      expect(isDefaultOrNeutralColor("#000000")).toBe(true);
      expect(isDefaultOrNeutralColor("#000")).toBe(true);
      expect(isDefaultOrNeutralColor(undefined)).toBe(true);
      expect(isDefaultOrNeutralColor("")).toBe(true);
    });

    it("identifies custom colors as non-default", () => {
      expect(isDefaultOrNeutralColor("#2563eb")).toBe(false);
      expect(isDefaultOrNeutralColor("#10b981")).toBe(false);
      expect(isDefaultOrNeutralColor("#e11d48")).toBe(false);
    });
  });

  describe("color math", () => {
    it("parses 3-digit and 6-digit hex", () => {
      expect(parseHex("#fff")).toEqual([255, 255, 255]);
      expect(parseHex("#0f172a")).toEqual([15, 23, 42]);
      expect(parseHex("invalid")).toBeNull();
    });

    it("calculates luminance", () => {
      expect(getLuminance(255, 255, 255)).toBe(1);
      expect(getLuminance(0, 0, 0)).toBe(0);
      expect(getLuminance(15, 23, 42)).toBeLessThan(0.15);
    });

    it("converts between RGB and HSL correctly", () => {
      const hsl = rgbToHsl(37, 99, 235); // #2563eb
      expect(hsl.h).toBeGreaterThanOrEqual(215);
      expect(hsl.h).toBeLessThanOrEqual(225);
      const hex = hslToHex(hsl.h, hsl.s, hsl.l);
      const [r2, g2, b2] = parseHex(hex)!;
      expect(Math.abs(r2 - 37)).toBeLessThanOrEqual(1);
      expect(Math.abs(g2 - 99)).toBeLessThanOrEqual(1);
      expect(Math.abs(b2 - 235)).toBeLessThanOrEqual(1);
    });
  });

  describe("resolvePrimaryColors", () => {
    it("returns null for default slate #0f172a so native CSS rules handle contrast", () => {
      expect(resolvePrimaryColors("#0f172a", false)).toBeNull();
      expect(resolvePrimaryColors("#0f172a", true)).toBeNull();
    });

    it("preserves custom vibrant colors in light mode", () => {
      const colors = resolvePrimaryColors("#2563eb", false);
      expect(colors).not.toBeNull();
      expect(colors?.primary).toBe("#2563eb");
      expect(colors?.foreground).toBe("#ffffff");
    });

    it("adjusts dark custom colors in dark mode to ensure high contrast and visibility", () => {
      // Dark navy: #1e3a8a (very dark, would be invisible on dark background)
      const colors = resolvePrimaryColors("#1e3a8a", true);
      expect(colors).not.toBeNull();
      // Must be lightened for contrast (not dark navy)
      expect(colors?.primary).not.toBe("#1e3a8a");
      const rgb = parseHex(colors!.primary)!;
      const lum = getLuminance(...rgb);
      expect(lum).toBeGreaterThanOrEqual(0.35);
    });
  });

  describe("applyTheme", () => {
    it("applies dark mode class and removes inline overrides for default color", () => {
      const cleanup = applyTheme({
        primaryColor: "#0f172a",
        darkMode: "dark",
      });

      expect(mockHtml.classList.add).toHaveBeenCalledWith("dark");
      expect(mockHtml.style.removeProperty).toHaveBeenCalledWith("--primary");

      cleanup();
      expect(mockHtml.classList.remove).toHaveBeenCalledWith("dark");
    });

    it("applies light mode and removes dark class for default color", () => {
      const cleanup = applyTheme({
        primaryColor: "#0f172a",
        darkMode: "light",
      });

      expect(mockHtml.classList.remove).toHaveBeenCalledWith("dark");
      expect(mockHtml.style.removeProperty).toHaveBeenCalledWith("--primary");

      cleanup();
    });

    it("sets legible inline colors for custom theme in dark mode", () => {
      const cleanup = applyTheme({
        primaryColor: "#1e3a8a",
        darkMode: "dark",
      });

      expect(mockHtml.classList.add).toHaveBeenCalledWith("dark");
      expect(mockHtml.style.setProperty).toHaveBeenCalledWith(
        "--primary",
        expect.not.stringMatching(/^#1e3a8a$/i),
      );

      cleanup();
      expect(mockHtml.style.removeProperty).toHaveBeenCalledWith("--primary");
    });
  });
});
