import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { account } from '../../lib/account';
import { library, syncYouTubeLikes } from '../../lib/library';
import { playerState, playTracks } from '../../lib/player';
import { useStore } from '../../lib/store';
import { getMyPlaylists, type Collection, type Track } from '../../lib/yt';
import { CollectionCard, EmptyView, GhostButton, GradientButton, HScroll, TrackRow } from '../../ui/components';
import { colors } from '../../ui/theme';

const TABS = ['Liked', 'Downloads', 'Recent'] as const;
type Tab = (typeof TABS)[number];

const EMPTY: Record<Tab, { icon: 'heart-outline' | 'arrow-down-circle-outline' | 'time-outline'; title: string; hint: string }> = {
  Liked: { icon: 'heart-outline', title: 'No liked songs yet', hint: 'Tap the heart in the player to save songs here.' },
  Downloads: { icon: 'arrow-down-circle-outline', title: 'No downloads yet', hint: 'Download songs to listen offline, even without internet.' },
  Recent: { icon: 'time-outline', title: 'Nothing played yet', hint: 'Songs you play will show up here.' },
};

export default function Library() {
  const insets = useSafeAreaInsets();
  const { liked, recent, downloads } = useStore(library);
  const [tab, setTab] = useState<Tab>('Liked');
  const { status, method } = useStore(account);
  const [playlists, setPlaylists] = useState<Collection[]>([]);
  // YouTube Music only serves account data (history, playlists, likes) to a Google sign-in;
  // it rejects TV-code tokens for these requests.
  const fullAccount = status === 'signed-in' && method === 'google';

  // When signed in, pull the account's playlists and merge its liked songs into Liked.
  useEffect(() => {
    if (!fullAccount) return setPlaylists([]);
    getMyPlaylists().then(setPlaylists).catch(() => {});
    syncYouTubeLikes().catch(() => {});
  }, [fullAccount]);
  const tracks: Track[] = tab === 'Liked' ? liked : tab === 'Recent' ? recent : Object.values(downloads).map((d) => d.track);

  function shuffle() {
    playerState.set({ shuffle: true });
    playTracks(tracks, Math.floor(Math.random() * tracks.length));
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <Text style={s.heading}>Library</Text>
      {status === 'signed-in' && method === 'tv' && (
        <Pressable onPress={() => router.push('/account')} style={s.notice}>
          <Ionicons name="information-circle-outline" size={18} color={colors.sub} />
          <Text style={s.noticeText}>
            YouTube Music doesn't share history, playlists and likes with TV-code sign-in. Sign in with Google to see them.
          </Text>
        </Pressable>
      )}
      {fullAccount && (
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sub}>Your YouTube Music</Text>
          <HScroll>
            <Pressable onPress={() => router.push('/history')} style={({ pressed }) => [{ width: 110, opacity: pressed ? 0.7 : 1 }]}>
              <View style={s.historyTile}>
                <Ionicons name="time" size={38} color={colors.text} />
              </View>
              <Text style={s.tileText}>History</Text>
            </Pressable>
            {playlists.map((p) => (
              <CollectionCard key={p.id} item={p} size={110} />
            ))}
          </HScroll>
        </View>
      )}
      <View style={s.segment}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[s.segBtn, tab === t && s.segActive]}>
            <Text style={[s.segText, tab === t && { color: colors.text }]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          tracks.length ? (
            <View style={s.actions}>
              <GradientButton icon="play" label="Play" onPress={() => playTracks(tracks, 0)} />
              <GhostButton icon="shuffle" label="Shuffle" onPress={shuffle} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={<EmptyView {...EMPTY[tab]} />}
        renderItem={({ item, index }) => <TrackRow track={item} onPress={() => playTracks(tracks, index)} />}
        contentContainerStyle={{ paddingBottom: 30 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  heading: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.8, paddingHorizontal: 16, marginBottom: 12 },
  notice: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  noticeText: { flex: 1, color: colors.sub, fontSize: 13.5, lineHeight: 19 },
  sub: { color: colors.sub, fontSize: 14, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 },
  historyTile: { width: 110, height: 110, borderRadius: 10, backgroundColor: colors.accent2, alignItems: 'center', justifyContent: 'center' },
  tileText: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 8 },
  segment: { flexDirection: 'row', marginHorizontal: 16, padding: 3, borderRadius: 12, backgroundColor: colors.surface },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  segActive: { backgroundColor: colors.surface2 },
  segText: { color: colors.sub, fontWeight: '700', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
});
