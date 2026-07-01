package com.tichael.fieldtablet;

import android.util.Log;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "SmbSync")
public class SmbSyncPlugin extends Plugin {
    private static final String TAG = "SmbSyncPlugin";
    private static final String WORK_NAME = "SmbSyncWork";

    @PluginMethod
    public void configure(PluginCall call) {
        String host = call.getString("host");
        String share = call.getString("share");
        String user = call.getString("username");
        String pass = call.getString("password");
        String domain = call.getString("domain", "");

        if (host == null || share == null || user == null || pass == null) {
            call.reject("Missing required parameters");
            return;
        }

        bridge.execute(() -> {
            try {
                SmbService smbService = new SmbService(getContext());
                smbService.testConnection(host, share, user, pass, domain);

                SecureStorage storage = new SecureStorage(getContext());
                storage.saveString("smb_host", host);
                storage.saveString("smb_share", share);
                storage.saveString("smb_user", user);
                storage.saveString("smb_pass", pass);
                storage.saveString("smb_domain", domain);

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Error configuring SMB", e);
                call.reject("Failed to connect: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void startBackgroundSync(PluginCall call) {
        int intervalMinutes = call.getInt("intervalMinutes", 15);
        if (intervalMinutes < 15) intervalMinutes = 15;

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest syncRequest = new PeriodicWorkRequest.Builder(SyncWorker.class, intervalMinutes, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();

        WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                syncRequest
        );

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopBackgroundSync(PluginCall call) {
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK_NAME);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void forceSync(PluginCall call) {
        bridge.execute(() -> {
            try {
                SecureStorage storage = new SecureStorage(getContext());
                String host = storage.getString("smb_host");
                String share = storage.getString("smb_share");
                String user = storage.getString("smb_user");
                String pass = storage.getString("smb_pass");
                String domain = storage.getString("smb_domain");

                if (host == null || share == null || user == null || pass == null) {
                    call.reject("SMB not configured");
                    return;
                }

                SmbService smbService = new SmbService(getContext());
                boolean success = smbService.syncFiles(host, share, user, pass, domain);
                if (success) {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } else {
                    call.reject("Sync failed");
                }
            } catch (Exception e) {
                call.reject("Sync error", e);
            }
        });
    }

    @PluginMethod
    public void getFiles(PluginCall call) {
        try {
            File dir = getContext().getFilesDir();
            File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
            
            JSArray filesArray = new JSArray();
            if (files != null) {
                for (File file : files) {
                    FileInputStream fis = new FileInputStream(file);
                    byte[] data = new byte[(int) file.length()];
                    fis.read(data);
                    fis.close();
                    
                    String content = new String(data, StandardCharsets.UTF_8);
                    
                    JSObject fileObj = new JSObject();
                    fileObj.put("name", file.getName());
                    fileObj.put("content", content);
                    filesArray.put(fileObj);
                }
            }
            
            JSObject ret = new JSObject();
            ret.put("files", filesArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error reading files", e);
        }
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String path = call.getString("path");
        String content = call.getString("content");
        
        if (path == null || content == null) {
            call.reject("Path and content are required");
            return;
        }

        bridge.execute(() -> {
            try {
                File file = new File(getContext().getFilesDir(), path);
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.close();
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error saving file", e);
            }
        });
    }
}
