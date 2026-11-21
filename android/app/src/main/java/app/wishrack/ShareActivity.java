package app.wishrack;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/** Receives screenshots shared to Wishrack, copies them (share permissions don't last) and hands them to the background job. */
public class ShareActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (!Processor.configured(this)) {
            Toast.makeText(this, "Open Wishrack once to connect it first.", Toast.LENGTH_LONG).show();
            startActivity(new Intent(this, MainActivity.class));
            finish();
            return;
        }
        List<Uri> uris = new ArrayList<>();
        Intent in = getIntent();
        if (Intent.ACTION_SEND.equals(in.getAction())) {
            Uri u = in.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) uris.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(in.getAction())) {
            ArrayList<Uri> list = in.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
        }
        List<String> files = new ArrayList<>();
        for (Uri u : uris) {
            try (InputStream src = getContentResolver().openInputStream(u)) {
                if (src == null) continue;
                File f = File.createTempFile("share", ".img", getCacheDir());
                try (OutputStream out = new FileOutputStream(f)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = src.read(buf)) > 0) out.write(buf, 0, n);
                }
                files.add(f.getAbsolutePath());
            } catch (Exception ignored) { }
        }
        if (files.isEmpty()) {
            Toast.makeText(this, "Wishrack couldn't open that image.", Toast.LENGTH_LONG).show();
        } else {
            ShotJob.processShared(this, files.toArray(new String[0]));
            Toast.makeText(this, files.size() == 1 ? "Wishrack is reading your screenshot." : "Wishrack is reading " + files.size() + " screenshots.", Toast.LENGTH_SHORT).show();
        }
        finish();
    }
}
