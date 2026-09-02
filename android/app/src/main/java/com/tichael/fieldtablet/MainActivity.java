package com.tichael.fieldtablet;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmbSyncPlugin.class);
        clearServiceWorkerCache();
        super.onCreate(savedInstanceState);

        // Ensure the WebView always fetches fresh local assets directly from the APK
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
            getBridge().getWebView().clearCache(true);
        }
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
