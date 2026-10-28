import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { restoreSignIn } from '../lib/account';
import { loadLibrary } from '../lib/library';
import { restoreSession } from '../lib/player';
import { colors } from '../ui/theme';

export default function RootLayout() {
  useEffect(() => {
    loadLibrary();
    restoreSignIn();
    restoreSession();
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
