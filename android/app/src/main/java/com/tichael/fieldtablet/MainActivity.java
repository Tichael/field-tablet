package com.tichael.fieldtablet;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmbSyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
