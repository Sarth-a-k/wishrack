# Putting Wishrack online

Wishrack runs free on your own Cloudflare account. You do this once, from this folder, in PowerShell or a terminal. It takes about 10 minutes.

You need: Node.js (already installed), your Cloudflare account, and your Gemini API key from Google AI Studio (optional, but it makes screenshot reading much better).

## 1. Install the tools

```powershell
npm install
```

## 2. Sign in to Cloudflare

```powershell
npx wrangler login
```

A browser window opens. Sign in and allow access. This only links wrangler on this computer to your account.

## 3. Create the database

```powershell
npx wrangler d1 create wishrack
```

It prints a block that includes a line like `database_id = "1a2b3c..."`. Open `wrangler.toml` and replace `REPLACE_WITH_YOUR_DATABASE_ID` with that id.

Then create the tables and load your 7 saved products:

```powershell
npm run db:init
```

```powershell
npm run db:seed
```

## 4. Set your passcode and Gemini key

Pick a passcode you'll remember. You type it into the app once per device.

```powershell
npx wrangler secret put APP_PASSCODE
```

```powershell
npx wrangler secret put GEMINI_API_KEY
```

Each command asks you to paste the value. Secrets live in Cloudflare, never in this folder. Skip the Gemini one if you want; screenshots are then read on your device (slower, less accurate).

## 5. Put it online

```powershell
npm run deploy
```

It prints your app's address, like `https://wishrack.<your-name>.workers.dev`. That's your app.

## 6. Install it on your phone

1. Open that address in **Chrome** on your Android phone and type your passcode.
2. Chrome menu (⋮) → **Add to Home screen** → **Install**.
3. Now **Wishrack** appears in Android's share menu: in Instagram, a store app or your gallery, tap **Share → Wishrack**.

On your laptop, open the same address in Chrome or Edge; the install icon in the address bar adds it as an app.

## Android app: save screenshots automatically

The Android app (`dist/Wishrack.apk`) shows your Wishrack and, in the background, picks up every new screenshot. Clothes and shoes with a readable price go straight onto your rack; ones without a price wait in **Waiting for you** at the top; everything else is ignored.

1. **Put the latest version online first** (the app needs the inbox):

   ```powershell
   npm run deploy
   ```

2. **Copy `dist/Wishrack.apk` to your phone**: USB cable, Google Drive, or send it to yourself on WhatsApp/Telegram.
3. **Install it**: tap the file on the phone. Android asks to allow installs from that app (Files, Drive, WhatsApp); allow it, then tap **Install**. Play Protect may warn that it's an unknown app; it is your own build, so choose **Install anyway**.
4. **Connect**: open Wishrack, type your app address (`https://wishrack.<name>.workers.dev`) and your passcode, tap **Connect**.
5. **Allow access**: choose **Allow all** for photos (with "Select photos" it can't see new screenshots) and **Allow** notifications.
6. **Let it run in the background**: Settings → Apps → Wishrack → Battery → **Unrestricted**. Many phones (Xiaomi, Realme, Oppo, Vivo, Samsung) otherwise stop background work.

From then on, take screenshots as usual. A notification says what was saved. Only screenshots taken after setup are read. You can also share any image to **Wishrack** from the gallery. In the app, **Settings → Screenshots on this phone** turns auto-save on or off and shows the last result.

If you installed Wishrack from Chrome before, you can remove that copy (long-press its icon → Uninstall); the APK replaces it.

**Rebuilding the APK** after changing `android/` (from this folder):

```powershell
cd android; $env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; .\gradlew assembleRelease; cd ..
```

The new APK is `android/app/build/outputs/apk/release/app-release.apk`. Install it over the old one; it's signed with this computer's key, so build updates on this same computer.

## Updating later

After any change to the code, run `npm run deploy` again. Phones pick up the new version the next time the app opens.

## Testing on this computer

Create a `.dev.vars` file (copy `.dev.vars.example`) with a passcode and, optionally, your Gemini key, then:

```powershell
npm run db:init:local
```

```powershell
npm run dev
```

Open `http://localhost:8787`.

## Good to know

- **Free limits:** Cloudflare's free plan covers this easily. Gemini's free tier has a daily limit; when it runs out, the app reads screenshots on your device until the next day. Google may use free-tier inputs to improve its models.
- **Price checks** run every morning at 8:00 India time, about 20 items per day, oldest-checked first. Use **Check price now** on an item any time.
- **Links that can't be read:** H&M blocks requests from servers, Uniqlo loads its prices separately, and Instagram needs a login. For those, save a **screenshot** instead (or type the price in).
- **Your photos** are viewable by anyone who has a photo's exact address (a long random code); everything else needs your passcode.
- **To change the passcode:** run `npx wrangler secret put APP_PASSCODE` again, then enter the new one on each device.
