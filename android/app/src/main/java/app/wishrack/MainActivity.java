package app.wishrack;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** First run: connect to your Wishrack (address + passcode). After that: your Wishrack, full screen. */
public class MainActivity extends Activity {
    private static final int PICK = 7, PERMS = 8;
    private static final int BG = Color.parseColor("#141a30"), FG = Color.parseColor("#eef0f7"), DIM = Color.parseColor("#a6aec6");
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        if (Processor.configured(this)) { showWeb(); ShotJob.schedule(this); } else showSetup(null);
    }

    // ---------------------------------------------------------------- setup
    private void showSetup(String error) {
        SharedPreferences p = Processor.prefs(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(BG);
        box.setGravity(Gravity.CENTER_VERTICAL);
        int pad = dp(24);
        box.setPadding(pad, pad, pad, pad);

        TextView title = text("Connect Wishrack", 28, FG);
        TextView sub = text("Use the address from npm run deploy and the passcode you set.", 15, DIM);
        EditText url = field("https://wishrack.yourname.workers.dev", InputType.TYPE_TEXT_VARIATION_URI);
        url.setText(p.getString("base", ""));
        EditText pass = field("Passcode", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        Button go = new Button(this);
        go.setText("Connect");
        TextView msg = text(error == null ? "" : error, 14, Color.parseColor("#ff9a9a"));
        for (View v : new View[]{title, sub, url, pass, go, msg}) {
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.topMargin = dp(12);
            box.addView(v, lp);
        }
        go.setOnClickListener(v -> {
            String base = url.getText().toString().trim().replaceAll("/+$", "");
            if (!base.startsWith("http")) base = "https://" + base;
            String key = pass.getText().toString();
            go.setEnabled(false);
            msg.setText("Checking…");
            final String b2 = base;
            new Thread(() -> {
                String err = null;
                try { Processor.http("POST", b2 + "/api/login", key, null, null); }
                catch (Exception e) { err = e.getMessage(); }
                final String e2 = err;
                runOnUiThread(() -> {
                    if (e2 != null) { showSetup(e2.startsWith("No connection") ? "Couldn't reach that address. Check it and your internet." : e2); return; }
                    p.edit().putString("base", b2).putString("key", key).putBoolean("auto", true).apply();
                    askPermissions();
                    showWeb();
                });
            }).start();
        });
        setContentView(box);
    }

    private void askPermissions() {
        List<String> need = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33) {
            need.add(Manifest.permission.READ_MEDIA_IMAGES);
            need.add(Manifest.permission.POST_NOTIFICATIONS);
        } else need.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        requestPermissions(need.toArray(new String[0]), PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code != PERMS) return;
        new Thread(() -> Processor.markExistingAsSeen(this)).start();
        ShotJob.schedule(this);
    }

    // ---------------------------------------------------------------- the web app
    private void showWeb() {
        SharedPreferences p = Processor.prefs(this);
        String base = p.getString("base", "");
        web = new WebView(this);
        web.setBackgroundColor(BG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new Bridge(), "WishrackAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (u.getHost() != null && u.getHost().equals(Uri.parse(base).getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true; // store links open in the browser or the store's own app
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                // Sign the web app in with the passcode this phone already knows, once.
                String js = "if(!localStorage.getItem('wr.key')){localStorage.setItem('wr.key'," + JSONObject.quote(p.getString("key", "")) + ");location.reload();}";
                v.evaluateJavascript(js, null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(Intent.createChooser(i, "Choose screenshots"), PICK); }
                catch (Exception e) { fileCallback = null; return false; }
                return true;
            }
        });
        web.loadUrl(base + "/");
        setContentView(web);
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code != PICK || fileCallback == null) return;
        Uri[] uris = null;
        if (result == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                uris = new Uri[clip.getItemCount()];
                for (int i = 0; i < uris.length; i++) uris[i] = clip.getItemAt(i).getUri();
            } else if (data.getData() != null) uris = new Uri[]{data.getData()};
        }
        fileCallback.onReceiveValue(uris);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** What the web app's settings sheet can see and change. */
    private final class Bridge {
        @JavascriptInterface public boolean isAuto() { return Processor.prefs(MainActivity.this).getBoolean("auto", true) && Processor.hasMediaPermission(MainActivity.this); }

        @JavascriptInterface public void setAuto(boolean on) {
            Processor.prefs(MainActivity.this).edit().putBoolean("auto", on).apply();
            runOnUiThread(() -> {
                if (on && !Processor.hasMediaPermission(MainActivity.this)) askPermissions();
                ShotJob.schedule(MainActivity.this);
            });
        }

        @JavascriptInterface public String status() {
            if (!Processor.hasMediaPermission(MainActivity.this)) return "Photo access is off, so new screenshots can't be seen. Turn the switch on to allow it (choose Allow all).";
            if (!Processor.prefs(MainActivity.this).getBoolean("auto", true)) return "Off. Share screenshots to Wishrack to save them.";
            return Processor.prefs(MainActivity.this).getString("status", "On. New screenshots are checked within a minute, or within 15 minutes when the phone is idle.");
        }
    }

    // ---------------------------------------------------------------- small helpers
    private TextView text(String s, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        return t;
    }

    private EditText field(String hint, int type) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setInputType(type);
        e.setSingleLine(true);
        e.setTextColor(FG);
        e.setHintTextColor(DIM);
        return e;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
