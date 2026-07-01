package com.tichael.fieldtablet;

import android.content.Context;
import android.util.Log;

import com.hierynomus.msdtyp.AccessMask;
import com.hierynomus.msfscc.fileinformation.FileIdBothDirectoryInformation;
import com.hierynomus.mssmb2.SMB2CreateDisposition;
import com.hierynomus.mssmb2.SMB2ShareAccess;
import com.hierynomus.smbj.SMBClient;
import com.hierynomus.smbj.auth.AuthenticationContext;
import com.hierynomus.smbj.connection.Connection;
import com.hierynomus.smbj.session.Session;
import com.hierynomus.smbj.share.DiskShare;
import com.hierynomus.smbj.share.File;

import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.EnumSet;
import java.util.List;

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

    public boolean syncFiles(String host, String shareName, String username, String password, String domain) {
        SMBClient client = new SMBClient();
        try (Connection connection = client.connect(host)) {
            String actualDomain = (domain != null && !domain.isEmpty()) ? domain : null;
            AuthenticationContext ac = new AuthenticationContext(username, password.toCharArray(), actualDomain);
            Session session = connection.authenticate(ac);
            try (DiskShare share = (DiskShare) session.connectShare(shareName)) {
                
                // List files in the root
                List<FileIdBothDirectoryInformation> files = share.list("", "*.json");
                for (FileIdBothDirectoryInformation fileInfo : files) {
                    String fileName = fileInfo.getFileName();
                    if (fileName.equals(".") || fileName.equals("..")) continue;

                    java.io.File localFile = new java.io.File(context.getFilesDir(), fileName);
                    
                    try (File smbFile = share.openFile(fileName, 
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

                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "SMB Sync failed", e);
            return false;
        } finally {
            client.close();
        }
    }
}
