package com.tichael.fieldtablet;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class SyncWorker extends Worker {
    private static final String TAG = "SyncWorker";

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.i(TAG, "Running background SMB sync...");
        try {
            SecureStorage secureStorage = new SecureStorage(getApplicationContext());
            String host = secureStorage.getString("smb_host");
            String share = secureStorage.getString("smb_share");
            String user = secureStorage.getString("smb_user");
            String pass = secureStorage.getString("smb_pass");
            String domain = secureStorage.getString("smb_domain");

            if (host == null || share == null || user == null || pass == null) {
                Log.w(TAG, "Missing SMB credentials, skipping sync.");
                return Result.failure();
            }

            SmbService smbService = new SmbService(getApplicationContext());
            
            String syncFoldersStr = secureStorage.getString("sync_folders");
            String configFile = secureStorage.getString("config_file");
            
            java.util.List<String> syncFolders = new java.util.ArrayList<>();
            if (syncFoldersStr != null && !syncFoldersStr.isEmpty()) {
                try {
                    org.json.JSONArray arr = new org.json.JSONArray(syncFoldersStr);
                    for (int i = 0; i < arr.length(); i++) {
                        syncFolders.add(arr.getString(i));
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to parse sync folders", e);
                }
            }

            try {
                smbService.syncFiles(host, share, user, pass, domain, syncFolders, configFile);
                Log.i(TAG, "Background sync completed successfully.");
                return Result.success();
            } catch (Exception e) {
                if (e.getMessage() != null && e.getMessage().startsWith("MISSING_FOLDER:")) {
                    Log.w(TAG, "Background sync encountered missing folder: " + e.getMessage());
                    // Don't fail the worker completely so it keeps trying, but log it
                    return Result.success();
                }
                throw e;
            }


        } catch (Exception e) {
            Log.e(TAG, "Error in background sync", e);
            return Result.failure();
        }
    }
}
