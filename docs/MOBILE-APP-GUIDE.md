# Arixx Mobile App Guide

## Current State: PWA (Progressive Web App)

Your app is now installable as a PWA. This means:

### For Parents (Android/iPhone):
1. Open the app URL in Chrome (Android) or Safari (iPhone)
2. A banner says "Add to Home Screen" or tap the menu → "Install App"
3. The app appears on their home screen like a native app
4. Opens in full screen (no browser bar)
5. Works offline for viewing cached data

### What PWA gives you:
- ✅ Installable on home screen (looks like native app)
- ✅ Full screen mode (no browser bar)
- ✅ Splash screen while loading
- ✅ Works on any phone (Android + iPhone)
- ✅ No app store submission required
- ✅ Instant updates (no app store approval wait)
- ✅ Push notifications (with some setup)
- ❌ No access to native features (camera, contacts, etc.)
- ❌ Not listed on Play Store / App Store

---

## Phase 2: React Native App (When Ready)

When you're ready to build a full native app (for Play Store / App Store listing):

### Recommended Stack:
- **React Native + Expo** (fastest development)
- **Same backend** (your existing Express API)
- Reuse the same API endpoints — just build native UI

### Timeline: 2-4 weeks for MVP
### Cost: ₹0 if you build yourself, ₹50K-2L if you hire

### Key Screens to Build:
1. Login screen
2. Parent Dashboard (calendar view)
3. Notifications (with push)
4. Leave request form
5. Announcements
6. Admin: Attendance marking (for teachers)

### Commands to Start:
```bash
# Install Expo CLI
npm install -g expo-cli

# Create project
npx create-expo-app avento-mobile --template blank-typescript

# Install dependencies
cd avento-mobile
npx expo install @react-navigation/native @react-navigation/stack
npx expo install react-native-screens react-native-safe-area-context
npx expo install axios
npx expo install @react-native-async-storage/async-storage

# Start development
npx expo start
```

### Project Structure:
```
avento-mobile/
├── src/
│   ├── api/           # Same axios client pointing to your backend
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── parent/
│   │   │   ├── CalendarScreen.tsx
│   │   │   ├── NotificationsScreen.tsx
│   │   │   ├── AnnouncementsScreen.tsx
│   │   │   └── LeaveRequestScreen.tsx
│   │   └── admin/
│   │       ├── AttendanceScreen.tsx
│   │       └── DashboardScreen.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   └── navigation/
│       └── AppNavigator.tsx
├── app.json
└── package.json
```

### Push Notifications Setup:
1. Use **Expo Push Notifications** (free, easy)
2. Or **Firebase Cloud Messaging** for more control
3. Store device push token in the stakeholder's communication_channels
4. Your existing notification worker sends to FCM/Expo

### Publishing:
- **Android**: Expo builds APK/AAB → Upload to Play Console (₹2,100 one-time fee)
- **iOS**: Expo builds IPA → Upload to App Store Connect ($99/year Apple Developer)

---

## Phase 3: Capacitor (Alternative Quick Approach)

If you want a native app wrapper without rewriting:

```bash
# In your frontend/ directory
npm install @capacitor/core @capacitor/cli
npx cap init "Arixx" "com.avento.app"
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android  # Opens in Android Studio
```

This wraps your existing web app in a native container. Gets you:
- Play Store / App Store listing
- Push notifications
- Camera access
- But performance is "web-like", not truly native

---

## Recommendation

| Stage | Approach | When |
|-------|----------|------|
| Now | PWA | Already done ✅ |
| 10-50 schools | Capacitor | When schools ask "is there an app?" |
| 50+ schools | React Native | When you have revenue to invest |

For the MVP phase with 1-10 schools, the PWA is more than enough. Parents just need to bookmark the URL or add to home screen.
