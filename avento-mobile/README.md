# Avento Mobile

React Native (Expo) mobile application for the Avento People Presence Platform. Android-only.

## Setup

```bash
cd avento-mobile
npm install
```

## Development

```bash
npx expo start
```

## Build

### Development APK
```bash
npx eas-cli build --profile development --platform android
```

### Production AAB (Play Store)
```bash
npx eas-cli build --profile production --platform android
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `https://avento-api.onrender.com` |

## Project Structure

```
src/
├── api/          # Axios client and endpoint modules
├── components/   # Reusable UI components
├── navigation/   # React Navigation navigators
├── screens/      # Screen components organized by role
├── services/     # Platform services (biometric, push, storage)
├── stores/       # Zustand stores (auth, offline queue)
├── types/        # TypeScript type definitions
├── utils/        # Utility functions
└── __tests__/    # Test files
```

## Tech Stack

- **Framework**: React Native (Expo SDK 51+)
- **Navigation**: React Navigation 6 (bottom-tabs + native-stack)
- **State**: Zustand + TanStack React Query
- **HTTP**: Axios with interceptors
- **Storage**: expo-secure-store (tokens) + AsyncStorage (cache)
- **Push**: expo-notifications + FCM
- **Biometric**: expo-local-authentication
- **Build**: EAS Build
