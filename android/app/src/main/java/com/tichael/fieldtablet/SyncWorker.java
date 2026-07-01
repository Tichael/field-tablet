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
            boolean success = smbService.syncFiles(host, share, user, pass, domain);

            if (success) {
                Log.i(TAG, "Background sync completed successfully.");
                return Result.success();
            } else {
                Log.e(TAG, "Background sync failed.");
                return Result.retry();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in background sync", e);
            return Result.failure();
        }
    }
}
