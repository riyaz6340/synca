/**
 * Environment configuration for the Avento mobile app.
 * Uses Expo's built-in environment variable support (EXPO_PUBLIC_ prefix).
 */

export const ENV = {
  /** Base URL for the Avento REST API */
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://avento-api.onrender.com',

  /** App version (from app.json) */
  APP_VERSION: '1.0.0',

  /** Whether we're in development mode */
  IS_DEV: __DEV__,
} as const;
