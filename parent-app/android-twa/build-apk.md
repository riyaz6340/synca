# Building the Avento Android APK

Complete step-by-step guide for generating a signed APK for Google Play Store publishing.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | https://nodejs.org |
| JDK | 17+ | https://adoptium.net |
| Android SDK | API 33+ | https://developer.android.com/studio |

### Setting up environment variables

```bash
# Windows (PowerShell)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# Add to PATH
$env:PATH += ";$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools"
```

---

## Option A: Using Bubblewrap CLI (Recommended)

### Step 1: Install Bubblewrap

```bash
npm install -g @nickersoft/bubblewrap
```

### Step 2: Initialize from the PWA manifest

```bash
cd android-twa
bubblewrap init --manifest https://synca-45ns.vercel.app/manifest.json
```

Bubblewrap will:
- Ask for JDK and Android SDK paths (auto-detects if env vars are set)
- Generate the full Android Gradle project
- Create signing key (or you can provide your own)

### Step 3: Build debug APK (for testing)

```bash
bubblewrap build
```

Output: `./app-debug.apk`

Install on your device:
```bash
adb install app-debug.apk
```

### Step 4: Build signed release APK (for Play Store)

```bash
bubblewrap build --release
```

You'll be prompted to:
1. Create a new keystore (or provide an existing one)
2. Set a keystore password
3. Set a key password

Output: `./app-release-signed.apk`

> **Important:** Keep your keystore safe! You need it for every future update.

### Step 5: Generate AAB (Android App Bundle) for Play Store

Play Store prefers AAB over APK:

```bash
bubblewrap build --release --format aab
```

Output: `./app-release-signed.aab`

---

## Option B: Using PWABuilder (Web-based, no CLI needed)

1. Go to **https://www.pwabuilder.com**
2. Enter: `https://synca-45ns.vercel.app`
3. Wait for analysis to complete
4. Click **"Package for stores"** → Select **Android**
5. Configure:
   - Package ID: `com.avento.app`
   - App name: Avento
   - Theme color: #4f46e5
6. Click **Download**
7. Extract the zip — it contains an Android Studio project
8. Open in Android Studio → Build → Generate Signed Bundle/APK

---

## Setting Up Digital Asset Links

This is **required** for the app to run without showing the Chrome URL bar.

### Step 1: Get your signing certificate fingerprint

```bash
keytool -list -v -keystore your-keystore.jks -alias avento-key
```

Look for the **SHA-256** fingerprint line. It looks like:
```
SHA-256: AB:CD:EF:12:34:...
```

### Step 2: Create the assetlinks.json file

Create file at `c:\Users\ruddin\Synca\parent-app\public\.well-known\assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.avento.app",
    "sha256_cert_fingerprints": [
      "YOUR_SHA256_FINGERPRINT_HERE"
    ]
  }
}]
```

### Step 3: Deploy and verify

After deploying, verify at:
```
https://synca-45ns.vercel.app/.well-known/assetlinks.json
```

Use Google's validation tool:
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://synca-45ns.vercel.app&relation=delegate_permission/common.handle_all_urls
```

---

## Publishing to Google Play Store

### 1. Create a Google Play Developer account
- Go to https://play.google.com/console
- Pay the one-time $25 registration fee

### 2. Create a new app
- App name: **Avento**
- Default language: English
- App type: App
- Free or Paid: Free

### 3. Fill in the store listing
- Short description: "Track attendance, announcements, and leave requests"
- Full description: Write a detailed description of the app features
- Screenshots: Take screenshots from the PWA on mobile
- Feature graphic: 1024x500 banner image

### 4. Upload the AAB/APK
- Go to **Release** → **Production** → **Create new release**
- Upload `app-release-signed.aab`
- Add release notes

### 5. Complete content rating questionnaire
- Answer questions about app content
- Get your content rating

### 6. Set up pricing and distribution
- Select countries to distribute in
- Confirm content guidelines compliance

### 7. Submit for review
- Google typically reviews within 1-3 days
- You'll get an email when approved

---

## Troubleshooting

### URL bar showing in the TWA
- Digital Asset Links are not set up correctly
- Verify assetlinks.json is accessible and has the correct fingerprint
- Clear Chrome data on the test device and try again

### App crashes on launch
- Make sure the PWA is accessible at https://synca-45ns.vercel.app
- Check that manifest.json is valid (use Chrome DevTools → Application tab)
- Ensure Chrome is up to date on the device

### Service worker not registering
- Service workers require HTTPS (Vercel provides this automatically)
- Check browser console for SW registration errors
- Verify sw.js is served from the root path

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `twa-manifest.json` | Bubblewrap configuration |
| `../public/manifest.json` | Web app manifest |
| `../public/sw.js` | Service worker for offline support |
| `../public/icons/icon.svg` | App icon (replace with proper PNG icons for production) |
| `../public/.well-known/assetlinks.json` | Digital asset links (create after signing) |

---

## Production Checklist

- [ ] Replace SVG icon with proper PNG icons (192x192 and 512x512)
- [ ] Create maskable icon variant (use https://maskable.app/editor)
- [ ] Set up Digital Asset Links with actual signing fingerprint
- [ ] Test offline functionality
- [ ] Test install prompt on mobile Chrome
- [ ] Generate screenshots for Play Store listing
- [ ] Complete Google Play Store listing
- [ ] Upload signed AAB and submit for review
