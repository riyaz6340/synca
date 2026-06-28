# Avento — TWA Android Wrapper

This directory contains the configuration to generate a Trusted Web Activity (TWA) Android app that wraps the Avento PWA for publishing on the Google Play Store.

## What is a TWA?

A TWA (Trusted Web Activity) is an Android app that runs your PWA in a full-screen Chrome custom tab — no browser UI. It's the official way to publish a PWA on the Play Store.

## Prerequisites

- Node.js 18+
- JDK 17+ (download from https://adoptium.net)
- Android SDK (comes with Android Studio, or install command-line tools)

## Quick Start with Bubblewrap

### 1. Install Bubblewrap CLI

```bash
npm install -g @nickersoft/bubblewrap
```

### 2. Initialize the project

```bash
cd android-twa
bubblewrap init --manifest https://synca-45ns.vercel.app/manifest.json
```

Bubblewrap will prompt for JDK and Android SDK paths. It will generate a full Android project.

### 3. Build a debug APK

```bash
bubblewrap build
```

The output APK will be at `./app-debug.apk`.

### 4. Build a signed release APK

```bash
bubblewrap build --release
```

You'll be prompted to create or use a signing key. The signed APK will be at `./app-release-signed.apk`.

## Alternative: PWABuilder (No-Code)

1. Go to https://www.pwabuilder.com
2. Enter `https://synca-45ns.vercel.app`
3. Click "Package for stores" → Android
4. Download the generated Android project
5. Build with Android Studio or command line

## Digital Asset Links (Required)

For the TWA to work without showing the browser URL bar, you must verify domain ownership.

### 1. Get your app's signing certificate SHA-256 fingerprint

```bash
keytool -list -v -keystore your-keystore.jks -alias avento-key
```

Copy the SHA-256 fingerprint.

### 2. Create the asset links file

Host this JSON at: `https://synca-45ns.vercel.app/.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.avento.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT_HERE"]
  }
}]
```

### 3. Deploy the asset links file

For Vercel, create the file at `public/.well-known/assetlinks.json` in the parent-app project.

## Project Structure

```
android-twa/
├── README.md              # This file
├── twa-manifest.json      # Bubblewrap configuration
└── build-apk.md           # Detailed build instructions
```
