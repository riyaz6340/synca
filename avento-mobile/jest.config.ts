import type { Config } from 'jest';

/**
 * Jest configuration for the Arixx mobile app.
 *
 * Uses the `jest-expo` preset (the standard for Expo SDK 51 / React Native
 * projects), with TypeScript support provided by babel-preset-expo. The same
 * config powers both unit tests and property-based tests (fast-check).
 */
const config: Config = {
  preset: 'jest-expo',

  // Run after the test framework is installed in the environment.
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  // React Native and Expo ship untranspiled ESM, so they must be transformed
  // rather than ignored. This pattern follows the jest-expo recommendation and
  // additionally allows our state/test libraries through the transformer.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack/.*|zustand|msw|@mswjs/.*))',
  ],

  // Mirror the TypeScript path alias defined in tsconfig.json (`@/* -> src/*`).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Only treat files explicitly suffixed with `.test`/`.spec` as test files so
  // that helper modules under src/__tests__ (mocks, utils) are not executed as
  // test suites.
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],

  // Coverage scope (collected only when --coverage is passed).
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/__tests__/**',
  ],

  clearMocks: true,
};

export default config;
