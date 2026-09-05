import type { AppConfig } from "../store/config-store";

/**
 * Checks if the given hex color is the default monochrome/dark slate theme.
 */
export function isDefaultOrNeutralColor(color?: string): boolean {
  if (!color) return true;
  const normalized = color.trim().toLowerCase();
  return (
    normalized === "#0f172a" ||
    normalized === "#000000" ||
    normalized === "#000" ||
    normalized === "black"
  );
}

/**
 * Parses a hex string (#rgb or #rrggbb) into RGB values [0..255].
 */
export function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").trim();
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(clean)) {
    return null;
  }
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
  }
  return null;
}

/**
 * Computes perceived luminance of RGB values [0..1].
 */
export function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Converts RGB to HSL. H: 0..360, S: 0..100, L: 0..100.
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL to hex string #rrggbb.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => {
    const hex = Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Computes an appropriate primary color and contrast foreground for light or dark mode.
 * If default monochrome slate is used:
 *  - returns null so index.css (:root and .dark) handles primary color naturally
 * If a custom brand color is used:
 *  - in light mode: uses custom color directly
 *  - in dark mode: ensures adequate lightness (>= 62%) so text and buttons are legible
 */
export function resolvePrimaryColors(
  primaryColor: string | undefined,
  isDark: boolean,
): { primary: string; foreground: string } | null {
  if (isDefaultOrNeutralColor(primaryColor)) {
    return null;
  }

  const rgb = primaryColor ? parseHex(primaryColor) : null;
  if (!rgb) {
    return null;
  }

  if (!isDark) {
    const lum = getLuminance(...rgb);
    const foreground = lum > 0.5 ? "#000000" : "#ffffff";
    return {
      primary: primaryColor!,
      foreground,
    };
  }

  // Dark mode for custom color:
  const { h, s, l } = rgbToHsl(...rgb);
  // Ensure lightness is at least 62% in dark mode for good legibility and contrast against dark backgrounds
  const adjustedL = Math.max(l, 62);
  const darkPrimary = hslToHex(h, s, adjustedL);
  const darkRgb = parseHex(darkPrimary);
  const darkLum = darkRgb ? getLuminance(...darkRgb) : 0.6;
  const foreground = darkLum > 0.5 ? "#000000" : "#ffffff";

  return {
    primary: darkPrimary,
    foreground,
  };
}

export function applyTheme(theme: AppConfig["theme"]) {
  const html = document.documentElement;

  const updateColors = (isDark: boolean) => {
    const colors = resolvePrimaryColors(theme.primaryColor, isDark);
    if (colors && colors.primary && colors.foreground) {
      html.style.setProperty("--primary", colors.primary);
      html.style.setProperty("--color-primary", colors.primary);
      html.style.setProperty("--primary-foreground", colors.foreground);
      html.style.setProperty("--color-primary-foreground", colors.foreground);
    } else {
      html.style.removeProperty("--primary");
      html.style.removeProperty("--color-primary");
      html.style.removeProperty("--primary-foreground");
      html.style.removeProperty("--color-primary-foreground");
    }
  };

  const applyDarkMode = (isDark: boolean) => {
    if (isDark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    updateColors(isDark);
  };

  const cleanupVars = () => {
    html.style.removeProperty("--primary");
    html.style.removeProperty("--color-primary");
    html.style.removeProperty("--primary-foreground");
    html.style.removeProperty("--color-primary-foreground");
    html.classList.remove("dark");
  };

  if (theme.darkMode === "system") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    applyDarkMode(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => applyDarkMode(e.matches);
    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
      cleanupVars();
    };
  } else {
    applyDarkMode(theme.darkMode === "dark");
    return () => {
      cleanupVars();
    };
  }
}
