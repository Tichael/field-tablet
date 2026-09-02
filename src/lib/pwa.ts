import { Capacitor } from "@capacitor/core";

/**
 * Initializes PWA Service Worker for web browser environments while
 * preventing and clearing service workers in native Capacitor WebViews.
 *
 * In Capacitor Android/iOS, web assets are already packaged locally in the APK/app.
 * A Service Worker in Capacitor causes aggressive caching of index.html and assets,
 * which prevents new web files from loading after app updates unless uninstalled.
 */
export function initPWA() {
  if (Capacitor.isNativePlatform()) {
    // Unregister any active service worker in native app
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }

    // Clear CacheStorage caches in native app
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      });
    }
    return;
  }

  // Web / PWA browser environment: register service worker for offline support
  if ("serviceWorker" in navigator) {
    import("virtual:pwa-register").then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onRegisteredSW(_swScriptUrl, registration) {
          if (registration) {
            // Check for updates every hour
            setInterval(
              () => {
                registration.update();
              },
              60 * 60 * 1000,
            );

            // Check for updates when user refocuses the app/tab
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "visible") {
                registration.update();
              }
            });
          }
        },
        onNeedRefresh() {
          // autoUpdate triggers immediate reload to apply the new version
          updateSW(true);
        },
      });
    });
  }
}
