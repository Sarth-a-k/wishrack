package app.wishrack;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Finds new screenshots, has the Wishrack Worker read them (Gemini keeps only clothes and shoes),
 * and saves each product: straight to the rack when name and price were read, otherwise to the inbox.
 */
final class Processor {
    static final String PREFS = "wr";
    private static final int MAX_PER_RUN = 10;

    /** A failure worth retrying later (no network, Gemini limit, server trouble); the screenshot is kept for next time. */
    static final class Retry extends Exception { Retry(String m) { super(m); } }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static boolean configured(Context c) {
        SharedPreferences p = prefs(c);
        return !p.getString("base", "").isEmpty() && !p.getString("key", "").isEmpty();
    }

    static boolean hasMediaPermission(Context c) {
        String perm = Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_IMAGES : Manifest.permission.READ_EXTERNAL_STORAGE;
        return c.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    /** Start watching from the newest image now, so screenshots taken before setup are never imported. */
    static void markExistingAsSeen(Context c) {
        if (!hasMediaPermission(c) || prefs(c).getLong("lastId", -1) >= 0) return;
        long max = 0;
        try (Cursor cur = c.getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                new String[]{MediaStore.Images.Media._ID}, null, null, MediaStore.Images.Media._ID + " DESC")) {
            if (cur != null && cur.moveToFirst()) max = cur.getLong(0);
        } catch (Exception ignored) { }
        prefs(c).edit().putLong("lastId", max).apply();
    }

    /** Process new screenshots. Returns true when something should be retried later. */
    static synchronized boolean runScreenshots(Context c) {
        SharedPreferences p = prefs(c);
        if (!configured(c) || !p.getBoolean("auto", true) || !hasMediaPermission(c)) return false;
        markExistingAsSeen(c);
        long lastId = p.getLong("lastId", 0);
        List<long[]> shots = newScreenshots(c, lastId);
        int[] tally = new int[3]; // saved, waiting, skipped
        String problem = null;
        for (long[] s : shots) {
            Uri uri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, String.valueOf(s[0]));
            try {
                count(tally, processImage(c, uri));
            } catch (Retry e) {
                problem = e.getMessage();
                break; // keep this screenshot for the next run
            } catch (Exception e) {
                tally[2]++; // unreadable image: skip it
            }
            p.edit().putLong("lastId", s[0]).apply();
        }
        finish(c, tally, problem);
        return problem != null;
    }

    /** Process images shared to Wishrack (copied into the app's cache first). */
    static synchronized void runFiles(Context c, String[] paths) {
        if (!configured(c) || paths == null) return;
        int[] tally = new int[3];
        String problem = null;
        for (String path : paths) {
            File f = new File(path);
            try {
                if (problem == null) count(tally, processImage(c, Uri.fromFile(f)));
            } catch (Retry e) {
                problem = e.getMessage();
            } catch (Exception e) {
                tally[2]++;
            } finally {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
        finish(c, tally, problem);
    }

    private static void count(int[] tally, int[] r) {
        tally[0] += r[0];
        tally[1] += r[1];
        if (r[0] + r[1] == 0) tally[2]++;
    }

    private static List<long[]> newScreenshots(Context c, long lastId) {
        List<long[]> out = new ArrayList<>();
        String pathCol = Build.VERSION.SDK_INT >= 29 ? MediaStore.Images.Media.RELATIVE_PATH : MediaStore.Images.Media.DATA;
        String sel = MediaStore.Images.Media._ID + ">? AND (" + pathCol + " LIKE ? OR " + MediaStore.Images.Media.DISPLAY_NAME + " LIKE ?)";
        String[] args = {String.valueOf(lastId), "%creenshot%", "Screenshot%"};
        try (Cursor cur = c.getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                new String[]{MediaStore.Images.Media._ID}, sel, args, MediaStore.Images.Media._ID + " ASC")) {
            while (cur != null && cur.moveToNext() && out.size() < MAX_PER_RUN) out.add(new long[]{cur.getLong(0)});
        } catch (Exception ignored) { }
        return out;
    }

    /** Returns {saved to rack, saved to inbox}; {0,0} means no clothes or shoes were found. */
    static int[] processImage(Context c, Uri uri) throws Exception {
        SharedPreferences p = prefs(c);
        String base = p.getString("base", ""), key = p.getString("key", "");
        Bitmap full = decode(c, uri, 2000);
        if (full == null) throw new IOException("Not an image");

        JSONObject read = http("POST", base + "/api/read-image", key, "image/jpeg", jpeg(scaleMax(full, 1600), 85));
        JSONArray items = read.optJSONArray("items");
        int saved = 0, waiting = 0;
        if (items == null) return new int[]{0, 0};
        long now = System.currentTimeMillis();
        for (int i = 0; i < Math.min(items.length(), 8); i++) {
            JSONObject it = items.getJSONObject(i);
            // Best photo: the store's own clean one (Shopify stores); otherwise the screenshot crop with shop badges painted out.
            StoreHit hit = findOnStore(it);
            Bitmap photo = hit != null ? hit.photo : cropBox(full, it.optJSONArray("box"), it.optJSONArray("overlays"));
            String imageId = http("POST", base + "/api/images", key, "image/jpeg", jpeg(scaleMax(photo, 900), 85)).getString("id");
            if (hit != null) {
                it.put("url", hit.url);
                if (hit.price > 0) it.put("price", hit.price);
                if (hit.mrp > 0) it.put("mrp", hit.mrp);
            }

            String title = it.optString("title", "").trim();
            boolean hasPrice = !it.isNull("price") && it.optDouble("price", 0) > 0;
            boolean complete = !title.isEmpty() && hasPrice;
            JSONObject item = new JSONObject();
            item.put("title", title);
            for (String k : new String[]{"brand", "store", "url", "currency", "colour"}) item.put(k, it.optString(k, ""));
            if (hasPrice) item.put("price", it.getDouble("price"));
            if (!it.isNull("mrp") && it.optDouble("mrp", 0) > 0) item.put("mrp", it.getDouble("mrp"));
            item.put("imageId", imageId);
            item.put("addedAt", now + i);
            item.put("bought", false);
            item.put("source", "screenshot");
            item.put("inbox", !complete);
            String id = "s" + Long.toString(now, 36) + Integer.toString(new Random().nextInt(1 << 20), 36) + i;
            http("PUT", base + "/api/items/" + id, key, "application/json", item.toString().getBytes(StandardCharsets.UTF_8));
            if (complete) saved++; else waiting++;
        }
        return new int[]{saved, waiting};
    }

    // ---------------------------------------------------------------- images
    private static Bitmap decode(Context c, Uri uri, int maxSide) throws IOException {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        try (InputStream in = c.getContentResolver().openInputStream(uri)) { BitmapFactory.decodeStream(in, null, o); }
        if (o.outWidth <= 0 || o.outHeight <= 0) return null;
        int sample = 1;
        while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= maxSide) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        try (InputStream in = c.getContentResolver().openInputStream(uri)) { return BitmapFactory.decodeStream(in, null, o2); }
    }

    private static Bitmap scaleMax(Bitmap b, int max) {
        int w = b.getWidth(), h = b.getHeight(), m = Math.max(w, h);
        if (m <= max) return b;
        float s = (float) max / m;
        return Bitmap.createScaledBitmap(b, Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), true);
    }

    /** Crops to the product photo box Gemini returned ([x0,y0,x1,y1] fractions), then paints out the shop badges inside it. */
    private static Bitmap cropBox(Bitmap b, JSONArray box, JSONArray spots) {
        int w = b.getWidth(), h = b.getHeight();
        int l = 0, t = 0, r = w, btm = h;
        if (box != null && box.length() == 4) {
            double x0 = box.optDouble(0), y0 = box.optDouble(1), x1 = box.optDouble(2), y1 = box.optDouble(3);
            if (!Double.isNaN(x0 + y0 + x1 + y1) && x1 - x0 >= 0.08 && y1 - y0 >= 0.08) {
                int cl = (int) Math.max(0, x0 * w), ct = (int) Math.max(0, y0 * h), cr = (int) Math.min(w, x1 * w), cb = (int) Math.min(h, y1 * h);
                if (cr - cl >= 16 && cb - ct >= 16) { l = cl; t = ct; r = cr; btm = cb; }
            }
        }
        Bitmap out = Bitmap.createBitmap(b, l, t, r - l, btm - t).copy(Bitmap.Config.ARGB_8888, true);
        if (spots == null) return out;
        int W = out.getWidth(), H = out.getHeight();
        int[] px = new int[W * H];
        out.getPixels(px, 0, W, 0, 0, W, H);
        for (int k = 0; k < spots.length(); k++) {
            JSONArray o = spots.optJSONArray(k);
            if (o == null || o.length() != 4) continue;
            fillSpot(px, W, H, (int) Math.floor(o.optDouble(0) * w) - l, (int) Math.floor(o.optDouble(1) * h) - t,
                    (int) Math.ceil(o.optDouble(2) * w) - l, (int) Math.ceil(o.optDouble(3) * h) - t);
        }
        out.setPixels(px, 0, W, 0, 0, W, H);
        return out;
    }

    /** Fills one spot from the pixels just around it, each side counting more the closer it is (same as the web app). */
    static void fillSpot(int[] px, int W, int H, int ax0, int ay0, int ax1, int ay1) {
        int x0 = Math.max(0, Math.min(ax0, ax1) - 3), y0 = Math.max(0, Math.min(ay0, ay1) - 3);
        int x1 = Math.min(W, Math.max(ax0, ax1) + 3), y1 = Math.min(H, Math.max(ay0, ay1) + 3);
        int w = x1 - x0, h = y1 - y0;
        if (w < 2 || h < 2 || (long) w * h > (long) W * H / 4) return;
        boolean hasL = x0 > 0, hasR = x1 < W, hasT = y0 > 0, hasB = y1 < H;
        if (!hasL && !hasR && !hasT && !hasB) return;
        int[] fill = new int[w * h];
        for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) {
            double u = (x - x0 + 1.0) / (w + 1), v = (y - y0 + 1.0) / (h + 1), r = 0, g = 0, bl = 0, wt = 0, k;
            int[] src = new int[4]; double[] ks = new double[4]; int n = 0;
            if (hasL) { src[n] = px[y * W + x0 - 1]; ks[n++] = 1 / u; }
            if (hasR) { src[n] = px[y * W + x1]; ks[n++] = 1 / (1 - u); }
            if (hasT) { src[n] = px[(y0 - 1) * W + x]; ks[n++] = 1 / v; }
            if (hasB) { src[n] = px[y1 * W + x]; ks[n++] = 1 / (1 - v); }
            for (int i = 0; i < n; i++) {
                k = ks[i];
                r += ((src[i] >> 16) & 255) * k; g += ((src[i] >> 8) & 255) * k; bl += (src[i] & 255) * k; wt += k;
            }
            fill[(y - y0) * w + (x - x0)] = 0xff000000 | ((int) (r / wt) << 16) | ((int) (g / wt) << 8) | (int) (bl / wt);
        }
        for (int y = 0; y < h; y++) System.arraycopy(fill, y * w, px, (y + y0) * W + x0, w);
    }

    // ---------------------------------------------------------------- the store's own photo (Shopify stores)
    static final class StoreHit { String url; double price, mrp; Bitmap photo; }

    /** Searches the product's Shopify store by name; returns its link, live price and clean photo, or null. */
    static StoreHit findOnStore(JSONObject it) {
        try {
            String site = it.optString("site", ""), title = it.optString("title", "").trim();
            if (site.isEmpty() || title.isEmpty() || it.optString("url", "").startsWith("http")) return null;
            String raw = shopSearch(site, title);
            if (raw == null) return null;
            JSONArray list = new JSONObject(raw).getJSONObject("resources").getJSONObject("results").getJSONArray("products");
            String best = null;
            double score = 0;
            for (int i = 0; i < list.length(); i++) {
                JSONObject p = list.getJSONObject(i);
                // A different colour of the same product is a different photo, so a known colour must be in the store's title.
                String colour = it.optString("colour", "").trim();
                double sc = colour.isEmpty() || nameMatch(colour, p.optString("title", "")) == 1 ? nameMatch(title, p.optString("title", "")) : 0;
                if (sc > score) { score = sc; best = p.optString("url", ""); }
            }
            if (best == null || score < 0.75 || !best.startsWith("/products/")) return null;
            StoreHit hit = new StoreHit();
            hit.url = "https://" + site + best.split("\\?")[0];
            String js = getText(hit.url + ".js");
            if (js == null) return null;
            JSONObject p = new JSONObject(js);
            JSONArray vs = p.optJSONArray("variants");
            JSONObject v = null;
            if (vs != null) for (int i = 0; i < vs.length() && v == null; i++) if (vs.getJSONObject(i).optBoolean("available")) v = vs.getJSONObject(i);
            if (v == null && vs != null && vs.length() > 0) v = vs.getJSONObject(0);
            if (v == null) v = p;
            hit.price = v.optDouble("price", 0) / 100;
            double cmp = v.optDouble("compare_at_price", 0) / 100;
            hit.mrp = cmp > hit.price ? cmp : 0;
            String img = p.optString("featured_image", "");
            if (img.isEmpty()) return null;
            if (img.startsWith("//")) img = "https:" + img;
            byte[] bytes = getBytes(img);
            hit.photo = bytes == null ? null : BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            return hit.photo == null ? null : hit;
        } catch (Exception e) {
            return null; // fall back to the screenshot crop
        }
    }

    static String shopSearch(String site, String q) {
        if (!site.matches("[a-z0-9-]+(\\.[a-z0-9-]+)+")) return null;
        try {
            return getText("https://" + site + "/search/suggest.json?q=" + java.net.URLEncoder.encode(q, "UTF-8") + "&resources%5Btype%5D=product&resources%5Blimit%5D=5");
        } catch (Exception e) { return null; }
    }

    /** Share of the wanted words found in a store title; 1 means all of them. */
    static double nameMatch(String want, String title) {
        java.util.Set<String> have = new java.util.HashSet<>(), need = new java.util.LinkedHashSet<>();
        for (String w : title.toLowerCase().split("[^a-z0-9]+")) if (w.length() > 1) have.add(w);
        for (String w : want.toLowerCase().split("[^a-z0-9]+")) if (w.length() > 1) need.add(w);
        if (need.isEmpty()) return 0;
        int hit = 0;
        for (String w : need) if (have.contains(w)) hit++;
        return (double) hit / need.size();
    }

    static String getText(String url) {
        byte[] b = getBytes(url);
        return b == null ? null : new String(b, StandardCharsets.UTF_8);
    }

    static byte[] getBytes(String url) {
        try {
            HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
            con.setConnectTimeout(8000);
            con.setReadTimeout(12000);
            con.setRequestProperty("user-agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36");
            if (con.getResponseCode() != 200) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = con.getInputStream()) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > 8_000_000) return null; }
            }
            return out.toByteArray();
        } catch (Exception e) { return null; }
    }

    private static byte[] jpeg(Bitmap b, int q) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, q, out);
        return out.toByteArray();
    }

    // ---------------------------------------------------------------- network
    static JSONObject http(String method, String url, String key, String type, byte[] body) throws Exception {
        HttpURLConnection con;
        int code;
        String text;
        try {
            con = (HttpURLConnection) new URL(url).openConnection();
            con.setConnectTimeout(20000);
            con.setReadTimeout(90000);
            con.setRequestMethod(method);
            con.setRequestProperty("x-wishrack-key", key);
            if (body != null) {
                con.setDoOutput(true);
                con.setRequestProperty("content-type", type);
                con.setFixedLengthStreamingMode(body.length);
                try (OutputStream o = con.getOutputStream()) { o.write(body); }
            }
            code = con.getResponseCode();
            InputStream in = code < 400 ? con.getInputStream() : con.getErrorStream();
            text = in == null ? "" : readAll(in);
        } catch (IOException e) {
            throw new Retry("No connection. Screenshots will be read when you're back online.");
        }
        JSONObject j;
        try { j = new JSONObject(text); } catch (Exception e) { j = new JSONObject(); }
        String msg = j.optString("message", "The server answered " + code + ".");
        if (code == 401) throw new Retry("Wrong passcode. Open Wishrack, then Settings, to sign in again.");
        if (code == 429 || code >= 500) throw new Retry(msg);
        if (code >= 400) throw new IOException(msg);
        return j;
    }

    private static String readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toString("UTF-8");
    }

    // ---------------------------------------------------------------- feedback
    private static void finish(Context c, int[] t, String problem) {
        StringBuilder sb = new StringBuilder();
        if (t[0] > 0) sb.append(t[0] == 1 ? "Saved 1 item to your rack." : "Saved " + t[0] + " items to your rack.");
        if (t[1] > 0) sb.append(sb.length() > 0 ? " " : "").append(t[1] == 1 ? "1 is waiting for a price." : t[1] + " are waiting for a price.");
        if (problem != null) sb.append(sb.length() > 0 ? " " : "").append(problem);
        String line = sb.toString();
        if (line.isEmpty() && t[2] == 0) return; // nothing new
        String when = java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(new java.util.Date());
        prefs(c).edit().putString("status", "Last run " + when + ": " + (line.isEmpty() ? "no clothes or shoes in new screenshots." : line)).apply();
        if (!line.isEmpty()) notifyUser(c, line);
    }

    private static void notifyUser(Context c, String text) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("saves", "Saved screenshots", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(c, "saves")
                .setSmallIcon(android.R.drawable.ic_menu_gallery)
                .setContentTitle("Wishrack")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(open)
                .setAutoCancel(true)
                .build();
        nm.notify(1, n);
    }
}
