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
import java.util.ArrayList;
import java.util.List;
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

        JSArray syncFoldersArray = call.getArray("syncFolders", new JSArray());
        String configFile = call.getString("configFile", "");

        try {
            SecureStorage storage = new SecureStorage(getContext());
            storage.saveString("sync_folders", syncFoldersArray.toString());
            storage.saveString("config_file", configFile);
        } catch (Exception e) {
            Log.e(TAG, "Failed to save sync options", e);
        }

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
        JSArray syncFoldersArray = call.getArray("syncFolders", new JSArray());
        String configFile = call.getString("configFile", "");

        List<String> syncFolders = new ArrayList<>();
        try {
            for (int i = 0; i < syncFoldersArray.length(); i++) {
                syncFolders.add(syncFoldersArray.getString(i));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing syncFolders", e);
        }

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
                smbService.syncFiles(host, share, user, pass, domain, syncFolders, configFile);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                if (e.getMessage() != null && e.getMessage().startsWith("MISSING_FOLDER:")) {
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("error", "MISSING_FOLDER");
                    ret.put("folder", e.getMessage().substring("MISSING_FOLDER:".length()));
                    call.resolve(ret);
                } else {
                    call.reject("Sync error", e);
                }
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

    @PluginMethod
    public void listRemoteFiles(PluginCall call) {
        String path = call.getString("path", "");
        bridge.execute(() -> {
            try {
                SecureStorage storage = new SecureStorage(getContext());
                String host = storage.getString("smb_host");
                String share = storage.getString("smb_share");
                String user = storage.getString("smb_user");
                String pass = storage.getString("smb_pass");
                String domain = storage.getString("smb_domain");

                if (host == null || share == null) {
                    call.reject("SMB not configured");
                    return;
                }

                SmbService smbService = new SmbService(getContext());
                org.json.JSONArray files = smbService.listRemoteFiles(host, share, user, pass, domain, path);
                
                JSObject ret = new JSObject();
                JSArray jsArray = new JSArray(files.toString());
                ret.put("files", jsArray);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error listing remote files", e);
            }
        });
    }

    @PluginMethod
    public void listLocalFiles(PluginCall call) {
        String path = call.getString("path", "");
        try {
            File dir = new File(getContext().getFilesDir(), path);
            JSArray filesArray = new JSArray();

            if (dir.exists() && dir.isDirectory()) {
                File[] files = dir.listFiles();
                if (files != null) {
                    for (File file : files) {
                        JSObject fileObj = new JSObject();
                        fileObj.put("name", file.getName());
                        fileObj.put("path", path.isEmpty() ? file.getName() : path + "/" + file.getName());
                        fileObj.put("isDirectory", file.isDirectory());
                        filesArray.put(fileObj);
                    }
                }
            }
            
            JSObject ret = new JSObject();
            ret.put("files", filesArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error listing local files", e);
        }
    }

    @PluginMethod
    public void getFileUrl(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Path is required");
            return;
        }
        File file = new File(getContext().getFilesDir(), path);
        JSObject ret = new JSObject();
        ret.put("url", file.toURI().toString());
        call.resolve(ret);
    }

    @PluginMethod
    public void readFileText(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Path is required");
            return;
        }
        try {
            File file = new File(getContext().getFilesDir(), path);
            if (!file.exists()) {
                call.reject("File does not exist: " + path);
                return;
            }
            FileInputStream fis = new FileInputStream(file);
            byte[] data = new byte[(int) file.length()];
            fis.read(data);
            fis.close();
            
            String content = new String(data, StandardCharsets.UTF_8);
            JSObject ret = new JSObject();
            ret.put("content", content);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error reading file", e);
        }
    }
}
