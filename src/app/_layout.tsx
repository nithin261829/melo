import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { restoreSignIn } from '../lib/account';
import { loadLibrary } from '../lib/library';
import { autoMix } from '../lib/melodi';
import { restoreSession } from '../lib/player';
import { colors } from '../ui/theme';

export default function RootLayout() {
  useEffect(() => {
    loadLibrary();
    restoreSignIn();
    restoreSession();
    // Melodi plans a mix for this moment on open, and checks again whenever the app comes back.
    autoMix();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && autoMix());
    return () => sub.remove();
  }, []);
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ presentation: 'modal', contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="google-login" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
