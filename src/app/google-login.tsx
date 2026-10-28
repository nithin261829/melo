// Google's real sign-in page in a WebView. When Google redirects back to YouTube Music,
// the youtube.com cookies it set are handed to the app (see finishGoogleSignIn).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { finishGoogleSignIn } from '../lib/account';
import { colors } from '../ui/theme';

const SIGN_IN_URL =
  'https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=' +
  encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&next=https://music.youtube.com/');

// Google refuses sign-in from pages that look like embedded browsers, so present as Safari.
const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

export default function GoogleLogin() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const done = useRef(false);

  async function onUrl(url: string) {
    if (done.current || !url.startsWith('https://music.youtube.com')) return;
    done.current = true;
    setFinishing(true);
    if (await finishGoogleSignIn()) router.back();
    else {
      done.current = false;
      setFinishing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={s.bar}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <View style={s.title}>
          <Ionicons name="lock-closed" size={13} color={colors.sub} />
          <Text style={s.titleText}>accounts.google.com</Text>
        </View>
        <View style={{ width: 26 }}>{loading && <ActivityIndicator color={colors.sub} size="small" />}</View>
      </View>
      <WebView
        source={{ uri: SIGN_IN_URL }}
        userAgent={SAFARI_UA}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(e) => onUrl(e.url)}
        sharedCookiesEnabled
        style={{ flex: 1, backgroundColor: '#fff' }}
      />
      {finishing && (
        <View style={s.overlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[s.titleText, { marginTop: 12 }]}>Connecting your account…</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { color: colors.sub, fontSize: 14, fontWeight: '600' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
