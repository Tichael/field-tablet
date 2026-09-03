import type { AppConfig } from "../store/config-store";

export function applyTheme(theme: AppConfig["theme"]) {
  const html = document.documentElement;

  if (theme.primaryColor) {
    html.style.setProperty("--primary", theme.primaryColor);
    html.style.setProperty("--color-primary", theme.primaryColor);

    const hex = theme.primaryColor.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const foreground = luminance > 0.5 ? "#000000" : "#ffffff";
      html.style.setProperty("--primary-foreground", foreground);
      html.style.setProperty("--color-primary-foreground", foreground);
    }
  }

  const applyDarkMode = (isDark: boolean) => {
    if (isDark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
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

    // Return cleanup function
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
