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
    private Context context;

    public SmbService(Context context) {
        this.context = context;
    }

    public void testConnection(String host, String shareName, String username, String password, String domain) throws Exception {
        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                // Connection successful
            }
        } finally {
            client.close();
        }
    }

    public JSONArray listRemoteFiles(String host, String shareName, String username, String password, String domain, String path) throws Exception {
        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                
                JSONArray result = new JSONArray();
                try {
                    List<FileIdBothDirectoryInformation> files = share.list(path);
                    for (FileIdBothDirectoryInformation fileInfo : files) {
                        String fileName = fileInfo.getFileName();
                        if (fileName.equals(".") || fileName.equals("..")) continue;

                        boolean isDirectory = (fileInfo.getFileAttributes() & 0x10) == 0x10; // FILE_ATTRIBUTE_DIRECTORY
                        
                        JSONObject obj = new JSONObject();
                        obj.put("name", fileName);
                        obj.put("path", (path == null || path.isEmpty()) ? fileName : path + "/" + fileName);
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

    public void syncFiles(String host, String shareName, String username, String password, String domain, List<String> syncFolders, String configFile) throws Exception {
        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                
                if (configFile != null && !configFile.isEmpty()) {
                    downloadFile(share, configFile, configFile);
                } else {
                    // Sync json in root if no config folder specified
                    syncRootConfig(share);
                }

                if (syncFolders != null) {
                    for (String folder : syncFolders) {
                        try {
                            syncDirectory(share, folder, folder);
                        } catch (Exception e) {
                            Log.e(TAG, "Missing or failed to sync folder: " + folder, e);
                            throw new Exception("MISSING_FOLDER:" + folder);
                        }
                    }
                }
            }
        } finally {
            client.close();
        }
    }

    private void syncRootConfig(DiskShare share) throws Exception {
        List<FileIdBothDirectoryInformation> files = share.list("", "*.json");
        for (FileIdBothDirectoryInformation fileInfo : files) {
            String fileName = fileInfo.getFileName();
            if (fileName.equals(".") || fileName.equals("..")) continue;
            downloadFile(share, fileName, fileName);
        }
    }

    private void syncDirectory(DiskShare share, String smbPath, String localSubPath) throws Exception {
        List<FileIdBothDirectoryInformation> files;
        try {
            files = share.list(smbPath.replace("/", "\\"));
        } catch (SMBApiException e) {
            if (e.getStatusCode() == 0xC0000034) {
                throw new Exception("MISSING_FOLDER:" + smbPath);
            }
            throw e;
        }

        java.io.File localDir = new java.io.File(context.getFilesDir(), localSubPath);
        if (!localDir.exists()) {
            localDir.mkdirs();
        }

        for (FileIdBothDirectoryInformation fileInfo : files) {
            String fileName = fileInfo.getFileName();
            if (fileName.equals(".") || fileName.equals("..")) continue;

            boolean isDirectory = (fileInfo.getFileAttributes() & 0x10) == 0x10;
            String childSmbPath = smbPath + "\\" + fileName;
            String childLocalPath = localSubPath + "/" + fileName;

            if (isDirectory) {
                syncDirectory(share, childSmbPath, childLocalPath);
            } else {
                downloadFile(share, childSmbPath, childLocalPath);
            }
        }
    }

    private void downloadFile(DiskShare share, String smbPath, String localRelativePath) throws Exception {
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
