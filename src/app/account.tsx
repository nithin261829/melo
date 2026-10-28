import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { account, signInWithCode, signOut } from '../lib/account';
import { useStore } from '../lib/store';
import { Artwork, GhostButton, GradientButton } from '../ui/components';
import { colors } from '../ui/theme';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { status, method, code, verifyUrl, name, photo, error } = useStore(account);

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <Pressable hitSlop={12} onPress={() => router.back()} style={s.close}>
        <Ionicons name="close" size={26} color={colors.text} />
      </Pressable>

      {status === 'signed-in' ? (
        <View style={s.center}>
          {photo ? <Artwork uri={photo} size={96} radius={48} /> : <Ionicons name="person-circle" size={96} color={colors.sub} />}
          <Text style={s.title}>{name}</Text>
          <Text style={s.body}>
            {method === 'google'
              ? 'Connected with Google. Your home, history, likes and playlists come from your YouTube Music account.'
              : "Connected with a TV code. YouTube Music doesn't share history, playlists and likes with TV sign-ins — sign out and use Google sign-in for those."}
          </Text>
          <View style={s.actions}>
            <GhostButton icon="log-out-outline" label="Sign out" onPress={signOut} />
          </View>
        </View>
      ) : status === 'pending' ? (
        <View style={s.center}>
          <Text style={s.title}>Sign in with a TV code</Text>
          <Text style={s.body}>Go to the page below on any device and enter this code:</Text>
          {code ? <Text style={s.code}>{code}</Text> : <ActivityIndicator color={colors.accent} style={{ margin: 30 }} />}
          {!!code && (
            <View style={s.actions}>
              <GradientButton
                icon="open-outline"
                label="Open google.com/device"
                onPress={() => Linking.openURL(verifyUrl ?? 'https://www.google.com/device')}
              />
            </View>
          )}
          <View style={s.waiting}>
            <ActivityIndicator color={colors.sub} size="small" />
            <Text style={s.small}>Waiting for you to approve…</Text>
          </View>
        </View>
      ) : (
        <View style={s.center}>
          <Ionicons name="logo-youtube" size={64} color={colors.accent} />
          <Text style={s.title}>Connect YouTube Music</Text>
          <Text style={s.body}>Get your personal home, history, liked songs and playlists.</Text>
          {!!error && <Text style={[s.small, { color: colors.accent }]}>{error}</Text>}
          <View style={s.actions}>
            <GradientButton icon="logo-google" label="Sign in with Google" onPress={() => router.replace('/google-login')} />
          </View>
          <View style={s.actions}>
            <GhostButton icon="tv-outline" label="Use a TV code instead" onPress={signInWithCode} />
          </View>
          <Text style={s.small}>
            Google sign-in happens on Google's own page. With a TV code, you approve on google.com/device and your password never
            enters Melo. Sign-in data is kept in the iPhone Keychain.
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  body: { color: colors.sub, fontSize: 15.5, lineHeight: 22, textAlign: 'center' },
  code: { color: colors.text, fontSize: 40, fontWeight: '900', letterSpacing: 4, marginVertical: 10, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', alignSelf: 'stretch' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  small: { color: colors.faint, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
