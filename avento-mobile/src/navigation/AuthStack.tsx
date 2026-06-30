/**
 * AuthStack — the unauthenticated navigation stack.
 *
 * Currently renders the LoginScreen. The biometric gate (BiometricScreen) is
 * driven by {@link RootNavigator} as a post-authentication gate rather than a
 * screen inside this stack, so this stack stays focused on credential entry.
 *
 * Validates: Requirements 1.1, 2.4
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '@/screens/auth/LoginScreen';
import type { AuthStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
