package com.tichael.fieldtablet;

import android.content.Context;
import android.util.Log;

import com.hierynomus.msdtyp.AccessMask;
import com.hierynomus.msfscc.fileinformation.FileIdBothDirectoryInformation;
import com.hierynomus.mssmb2.SMB2CreateDisposition;
import com.hierynomus.mssmb2.SMB2ShareAccess;
import com.hierynomus.mssmb2.SMBApiException;
import com.hierynomus.smbj.SMBClient;
import com.hierynomus.smbj.auth.AuthenticationContext;
import com.hierynomus.smbj.connection.Connection;
import com.hierynomus.smbj.session.Session;
import com.hierynomus.smbj.share.DiskShare;
import com.hierynomus.smbj.share.File;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.EnumSet;
import java.util.List;
import java.util.ArrayList;

public class SmbService {
    private static final String TAG = "SmbService";
    private static final Object PENDING_LOCK = new Object();
    private Context context;

    public SmbService(Context context) {
        this.context = context;
    }

    public static String resolveSmbPath(String rootPath, String relativePath) {
        String cleanRoot = (rootPath == null) ? "" : rootPath.trim().replace("/", "\\").replaceAll("^\\\\+|\\\\+$", "");
        String cleanRel = (relativePath == null) ? "" : relativePath.trim().replace("/", "\\").replaceAll("^\\\\+|\\\\+$", "");
        if (cleanRoot.isEmpty()) return cleanRel;
        if (cleanRel.isEmpty()) return cleanRoot;
        return cleanRoot + "\\" + cleanRel;
    }

    public void testConnection(String host, String shareName, String username, String password, String domain) throws Exception {
        testConnection(host, shareName, username, password, domain, "");
    }

    public void testConnection(String host, String shareName, String username, String password, String domain, String rootPath) throws Exception {
        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                if (rootPath != null && !rootPath.trim().isEmpty()) {
                    ensureDirectoriesExist(share, rootPath);
                }
            }
        } finally {
            client.close();
        }
    }

    public JSONArray listRemoteFiles(String host, String shareName, String username, String password, String domain, String path) throws Exception {
        return listRemoteFiles(host, shareName, username, password, domain, "", path);
    }

    public JSONArray listRemoteFiles(String host, String shareName, String username, String password, String domain, String rootPath, String path) throws Exception {
        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                
                JSONArray result = new JSONArray();
                try {
                    String smbPath = resolveSmbPath(rootPath, path);
                    List<FileIdBothDirectoryInformation> files = share.list(smbPath);
                    for (FileIdBothDirectoryInformation fileInfo : files) {
                        String fileName = fileInfo.getFileName();
                        if (fileName.equals(".") || fileName.equals("..")) continue;

                        boolean isDirectory = (fileInfo.getFileAttributes() & 0x10) == 0x10; // FILE_ATTRIBUTE_DIRECTORY
                        
                        JSONObject obj = new JSONObject();
                        obj.put("name", fileName);
                        String cleanPath = (path == null || path.isEmpty()) ? fileName : path.replaceAll("^/+|/+$", "") + "/" + fileName;
                        obj.put("path", cleanPath);
                        obj.put("isDirectory", isDirectory);
                        result.put(obj);
                    }
                } catch (SMBApiException e) {
                    if (e.getStatusCode() == 0xC0000034) { // STATUS_OBJECT_NAME_NOT_FOUND
                        // Return empty if folder doesn't exist
                        return result;
                    }
                    throw e;
                }
                return result;
            }
        } finally {
            client.close();
        }
    }

    public List<String> getPendingUploads() {
        synchronized (PENDING_LOCK) {
            List<String> list = new ArrayList<>();
            java.io.File file = new java.io.File(context.getFilesDir(), "pending_uploads.json");
            if (!file.exists()) return list;
            try (java.io.FileInputStream fis = new java.io.FileInputStream(file)) {
                byte[] data = new byte[(int) file.length()];
                int bytesRead = 0;
                while (bytesRead < data.length) {
                    int r = fis.read(data, bytesRead, data.length - bytesRead);
                    if (r == -1) break;
                    bytesRead += r;
                }
                String jsonStr = new String(data, 0, bytesRead, java.nio.charset.StandardCharsets.UTF_8);
                JSONArray arr = new JSONArray(jsonStr);
                for (int i = 0; i < arr.length(); i++) {
                    String p = arr.getString(i);
                    if (!list.contains(p)) {
                        list.add(p);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error reading pending_uploads.json", e);
            }
            return list;
        }
    }

    public void savePendingUploads(List<String> list) {
        synchronized (PENDING_LOCK) {
            java.io.File file = new java.io.File(context.getFilesDir(), "pending_uploads.json");
            try {
                JSONArray arr = new JSONArray();
                for (String p : list) {
                    arr.put(p);
                }
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(file)) {
                    fos.write(arr.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
            } catch (Exception e) {
                Log.e(TAG, "Error writing pending_uploads.json", e);
            }
        }
    }

    public void recordPendingUpload(String path) {
        synchronized (PENDING_LOCK) {
            List<String> list = getPendingUploads();
            if (!list.contains(path)) {
                list.add(path);
                savePendingUploads(list);
            }
        }
    }

    public void removePendingUpload(String path) {
        synchronized (PENDING_LOCK) {
            List<String> list = getPendingUploads();
            if (list.remove(path)) {
                savePendingUploads(list);
            }
        }
    }

    public int flushPendingUploads(String host, String shareName, String username, String password, String domain) {
        return flushPendingUploads(host, shareName, username, password, domain, "");
    }

    public int flushPendingUploads(String host, String shareName, String username, String password, String domain, String rootPath) {
        List<String> pending = getPendingUploads();
        if (pending.isEmpty()) return 0;

        Log.i(TAG, "Flushing " + pending.size() + " pending upload(s)...");
        List<String> successfulUploads = new ArrayList<>();

        for (String path : pending) {
            java.io.File localFile = new java.io.File(context.getFilesDir(), path);
            if (!localFile.exists()) {
                // Local file was removed, drop from pending
                successfulUploads.add(path);
                continue;
            }
            try {
                byte[] bytes = new byte[(int) localFile.length()];
                try (java.io.FileInputStream fis = new java.io.FileInputStream(localFile)) {
                    int bytesRead = 0;
                    while (bytesRead < bytes.length) {
                        int r = fis.read(bytes, bytesRead, bytes.length - bytesRead);
                        if (r == -1) break;
                        bytesRead += r;
                    }
                }
                uploadFileBytes(host, shareName, username, password, domain, rootPath, path, bytes);
                Log.i(TAG, "Successfully uploaded pending file: " + path);
                successfulUploads.add(path);
            } catch (Exception e) {
                Log.w(TAG, "Failed to flush pending file " + path + ": " + e.getMessage());
            }
        }

        synchronized (PENDING_LOCK) {
            List<String> current = getPendingUploads();
            current.removeAll(successfulUploads);
            savePendingUploads(current);
            return current.size();
        }
    }

    public void syncFiles(String host, String shareName, String username, String password, String domain, List<String> syncFolders, String configFile) throws Exception {
        syncFiles(host, shareName, username, password, domain, "", syncFolders, configFile);
    }

    public void syncFiles(String host, String shareName, String username, String password, String domain, String rootPath, List<String> syncFolders, String configFile) throws Exception {
        // Flush any offline uploads first before pulling remote changes
        try {
            flushPendingUploads(host, shareName, username, password, domain, rootPath);
        } catch (Exception e) {
            Log.w(TAG, "Could not flush pending uploads during sync: " + e.getMessage());
        }

        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                
                List<String> effectiveSyncFolders = new ArrayList<>();
                if (syncFolders != null) {
                    for (String f : syncFolders) {
                        if (f != null && !f.trim().isEmpty() && !effectiveSyncFolders.contains(f.trim())) {
                            effectiveSyncFolders.add(f.trim());
                        }
                    }
                }

                if (configFile != null && !configFile.isEmpty()) {
                    try {
                        String remoteConfigPath = resolveSmbPath(rootPath, configFile);
                        downloadFile(share, remoteConfigPath, configFile);
                    } catch (SMBApiException e) {
                        if (e.getStatusCode() == 0xC0000034) { // STATUS_OBJECT_NAME_NOT_FOUND
                            Log.w(TAG, "Config file does not exist on remote share yet: " + configFile);
                        } else {
                            throw e;
                        }
                    }
                    java.io.File localConfigFile = new java.io.File(context.getFilesDir(), configFile);
                    if (localConfigFile.exists()) {
                        try (java.io.FileInputStream fis = new java.io.FileInputStream(localConfigFile)) {
                            byte[] data = new byte[(int) localConfigFile.length()];
                            int bytesRead = 0;
                            while (bytesRead < data.length) {
                                int r = fis.read(data, bytesRead, data.length - bytesRead);
                                if (r == -1) break;
                                bytesRead += r;
                            }
                            String content = new String(data, 0, bytesRead, java.nio.charset.StandardCharsets.UTF_8);
                            JSONObject configJson = new JSONObject(content);
                            if (configJson.has("syncFolders")) {
                                JSONArray arr = configJson.getJSONArray("syncFolders");
                                for (int i = 0; i < arr.length(); i++) {
                                    String f = arr.getString(i).trim();
                                    if (!f.isEmpty() && !effectiveSyncFolders.contains(f)) {
                                        effectiveSyncFolders.add(f);
                                    }
                                }
                            }
                            if (configJson.has("formFolders")) {
                                Object ffObj = configJson.get("formFolders");
                                if (ffObj instanceof JSONObject) {
                                    JSONObject ffJson = (JSONObject) ffObj;
                                    java.util.Iterator<String> keys = ffJson.keys();
                                    while (keys.hasNext()) {
                                        String key = keys.next();
                                        String folder = ffJson.optString(key, "").trim();
                                        if (!folder.isEmpty() && !effectiveSyncFolders.contains(folder)) {
                                            effectiveSyncFolders.add(folder);
                                        }
                                    }
                                } else if (ffObj instanceof JSONArray) {
                                    JSONArray ffArr = (JSONArray) ffObj;
                                    for (int i = 0; i < ffArr.length(); i++) {
                                        String folder = ffArr.getString(i).trim();
                                        if (!folder.isEmpty() && !effectiveSyncFolders.contains(folder)) {
                                            effectiveSyncFolders.add(folder);
                                        }
                                    }
                                }
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Failed to parse updated config file for sync folders", e);
                        }
                    }
                } else {
                    // Sync json in root if no config folder specified
                    syncRootConfig(share, rootPath);
                }

                if (effectiveSyncFolders != null) {
                    for (String folder : effectiveSyncFolders) {
                        try {
                            String remoteFolder = resolveSmbPath(rootPath, folder);
                            syncDirectory(share, remoteFolder, folder);
                        } catch (Exception e) {
                            Log.w(TAG, "Could not sync folder: " + folder + ", skipping", e);
                        }
                    }
                }
            }
        } finally {
            client.close();
        }
    }

    private void syncRootConfig(DiskShare share, String rootPath) throws Exception {
        String remoteDir = resolveSmbPath(rootPath, "");
        List<FileIdBothDirectoryInformation> files;
        try {
            files = share.list(remoteDir, "*.json");
        } catch (SMBApiException e) {
            if (e.getStatusCode() == 0xC0000034) { // STATUS_OBJECT_NAME_NOT_FOUND
                return;
            }
            throw e;
        }
        for (FileIdBothDirectoryInformation fileInfo : files) {
            String fileName = fileInfo.getFileName();
            if (fileName.equals(".") || fileName.equals("..")) continue;
            String remoteFilePath = resolveSmbPath(rootPath, fileName);
            downloadFile(share, remoteFilePath, fileName);
        }
    }

    private void syncDirectory(DiskShare share, String smbPath, String localSubPath) throws Exception {
        String cleanSmbPath = smbPath.replace("/", "\\").replaceAll("^\\\\+|\\\\+$", "").trim();
        List<FileIdBothDirectoryInformation> files;
        try {
            files = share.list(cleanSmbPath);
        } catch (SMBApiException e) {
            if (e.getStatusCode() == 0xC0000034) {
                try {
                    ensureDirectoriesExist(share, cleanSmbPath);
                    files = share.list(cleanSmbPath);
                } catch (Exception createEx) {
                    Log.w(TAG, "Remote folder does not exist on share and could not be created: " + cleanSmbPath);
                    return;
                }
            } else {
                throw e;
            }
        }

        java.io.File localDir = new java.io.File(context.getFilesDir(), localSubPath);
        if (!localDir.exists()) {
            localDir.mkdirs();
        }

        for (FileIdBothDirectoryInformation fileInfo : files) {
            String fileName = fileInfo.getFileName();
            if (fileName.equals(".") || fileName.equals("..")) continue;

            boolean isDirectory = (fileInfo.getFileAttributes() & 0x10) == 0x10;
            String childSmbPath = cleanSmbPath.isEmpty() ? fileName : (cleanSmbPath + "\\" + fileName);
            String childLocalPath = localSubPath.isEmpty() ? fileName : (localSubPath + "/" + fileName);

            if (isDirectory) {
                syncDirectory(share, childSmbPath, childLocalPath);
            } else {
                downloadFile(share, childSmbPath, childLocalPath);
            }
        }
    }

    public void uploadFile(String host, String shareName, String username, String password, String domain, String path, String content) throws Exception {
        uploadFile(host, shareName, username, password, domain, "", path, content);
    }

    public void uploadFile(String host, String shareName, String username, String password, String domain, String rootPath, String path, String content) throws Exception {
        uploadFileBytes(host, shareName, username, password, domain, rootPath, path, content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public void uploadFileBytes(String host, String shareName, String username, String password, String domain, String path, byte[] data) throws Exception {
        uploadFileBytes(host, shareName, username, password, domain, "", path, data);
    }

    public void uploadFileBytes(String host, String shareName, String username, String password, String domain, String rootPath, String path, byte[] data) throws Exception {
        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                String fullSmbPath = resolveSmbPath(rootPath, path);
                int lastSlash = fullSmbPath.lastIndexOf('\\');
                if (lastSlash > 0) {
                    String parentSmbDir = fullSmbPath.substring(0, lastSlash);
                    ensureDirectoriesExist(share, parentSmbDir);
                }

                try (File smbFile = share.openFile(fullSmbPath, 
                        EnumSet.of(AccessMask.GENERIC_WRITE),
                        null,
                        SMB2ShareAccess.ALL,
                        SMB2CreateDisposition.FILE_OVERWRITE_IF,
                        null)) {
                    
                    try (java.io.OutputStream os = smbFile.getOutputStream()) {
                        os.write(data);
                    }
                }
            }
        } finally {
            client.close();
        }
    }

    public void createDirectory(String host, String shareName, String username, String password, String domain, String path) throws Exception {
        createDirectory(host, shareName, username, password, domain, "", path);
    }

    public void createDirectory(String host, String shareName, String username, String password, String domain, String rootPath, String path) throws Exception {
        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                String fullPath = resolveSmbPath(rootPath, path);
                ensureDirectoriesExist(share, fullPath);
            }
        } finally {
            client.close();
        }
    }

    private void ensureDirectoriesExist(DiskShare share, String path) {
        String[] parts = path.split("[/\\\\]");
        StringBuilder current = new StringBuilder();
        for (String part : parts) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            if (current.length() > 0) {
                current.append("\\");
            }
            current.append(trimmed);
            String subPath = current.toString();
            try {
                if (!share.folderExists(subPath)) {
                    share.mkdir(subPath);
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not ensure directory exists: " + subPath, e);
            }
        }
    }

    private void downloadFile(DiskShare share, String smbPath, String localRelativePath) throws Exception {
        // If this file has pending local changes that have not yet uploaded, do NOT overwrite it
        if (getPendingUploads().contains(localRelativePath)) {
            Log.i(TAG, "Skipping download of " + localRelativePath + " because it has pending local changes.");
            return;
        }

        java.io.File localFile = new java.io.File(context.getFilesDir(), localRelativePath);
        
        java.io.File parent = localFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        try (File smbFile = share.openFile(smbPath.replace("/", "\\"), 
                EnumSet.of(AccessMask.GENERIC_READ),
                null,
                SMB2ShareAccess.ALL,
                SMB2CreateDisposition.FILE_OPEN,
                null)) {
            
            try (InputStream is = smbFile.getInputStream();
                 FileOutputStream fos = new FileOutputStream(localFile)) {
                byte[] buffer = new byte[8192];
                int len;
                while ((len = is.read(buffer)) > 0) {
                    fos.write(buffer, 0, len);
                }
            }
        }
    }
}
