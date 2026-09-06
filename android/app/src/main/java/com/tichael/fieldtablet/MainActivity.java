package com.tichael.fieldtablet;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {
    private int lastTopDp = -1;
    private int lastBottomDp = -1;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmbSyncPlugin.class);
        clearServiceWorkerCache();
        super.onCreate(savedInstanceState);

        // Ensure light status bar icons (dark icons on light background)
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(true);
        }

        // Listen for window insets (status bar, navigation bar, cutouts) and forward to CSS variables
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            float density = getResources().getDisplayMetrics().density;
            int topDp = density > 0 ? Math.round(insets.top / density) : 0;
            int bottomDp = density > 0 ? Math.round(insets.bottom / density) : 0;

            if (topDp != lastTopDp || bottomDp != lastBottomDp) {
                lastTopDp = topDp;
                lastBottomDp = bottomDp;
                applyWindowInsetsToWebview(topDp, bottomDp);
            }
            return windowInsets;
        });

        // Ensure the WebView always fetches fresh local assets directly from the APK
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
            getBridge().getWebView().clearCache(true);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (lastTopDp >= 0 && lastBottomDp >= 0) {
            applyWindowInsetsToWebview(lastTopDp, lastBottomDp);
        }
    }

    private void applyWindowInsetsToWebview(int topDp, int bottomDp) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().post(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            String js = String.format(
                java.util.Locale.US,
                "document.documentElement.style.setProperty('--sat-native', '%dpx');" +
                "document.documentElement.style.setProperty('--sab-native', '%dpx');",
                topDp,
                bottomDp
            );
            getBridge().getWebView().evaluateJavascript(js, null);
        });
    }

    /**
     * Deletes legacy WebView Service Worker registrations and CacheStorage directories
     * from disk without touching user databases (e.g. IndexedDB, LocalStorage).
     * This prevents older versions' Service Workers from serving stale cached HTML/JS
     * when updating the app in-place.
     */
    private void clearServiceWorkerCache() {
        try {
            File dataDir = new File(getApplicationInfo().dataDir);
            File appWebview = new File(dataDir, "app_webview");
            if (appWebview.exists()) {
                String[] targets = {
                    "Service Worker",
                    "Default/Service Worker",
                    "Cache",
                    "Default/Cache"
                };
                for (String target : targets) {
                    File dir = new File(appWebview, target);
                    if (dir.exists()) {
                        deleteRecursive(dir);
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "Failed to clean WebView cache: " + e.getMessage());
        }
    }

    private static boolean deleteRecursive(File fileOrDir) {
        if (fileOrDir != null && fileOrDir.isDirectory()) {
            File[] children = fileOrDir.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        return fileOrDir != null && fileOrDir.delete();
    }
}
