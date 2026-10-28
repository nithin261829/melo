// Shared page for albums and playlists: big artwork header, play/shuffle/download, and the track list.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { download } from '../lib/library';
import { playerState, playTracks } from '../lib/player';
import type { CollectionPage } from '../lib/yt';
import { Artwork, downloadFailed, ErrorView, GhostButton, GradientButton, Loading, TrackRow } from './components';
import MiniPlayer from './MiniPlayer';
import { colors } from './theme';

export function BackButton() {
  const insets = useSafeAreaInsets();
  return (
    <Pressable hitSlop={10} onPress={() => router.back()} style={[s.back, { top: insets.top + 6 }]}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

export default function CollectionView({ load, numbered }: { load: () => Promise<CollectionPage>; numbered?: boolean }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<CollectionPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(() => {
    setError(null);
    load()
      .then(setPage)
      .catch((e) => setError(e?.message ?? 'Could not load'));
  }, [load]);
  useEffect(fetchPage, [fetchPage]);

  const body = error ? (
    <ErrorView message={error} onRetry={fetchPage} />
  ) : !page ? (
    <Loading />
  ) : (
    <FlatList
      data={page.tracks}
      keyExtractor={(t, i) => t.id + i}
      ListHeaderComponent={
        <View>
          <Image source={{ uri: page.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={50} />
          <LinearGradient colors={['rgba(10,10,15,0.4)', colors.bg]} style={StyleSheet.absoluteFill} />
          <View style={{ alignItems: 'center', paddingTop: insets.top + 50, paddingHorizontal: 24 }}>
            <View style={s.artShadow}>
              <Artwork uri={page.thumb} size={220} radius={12} />
            </View>
            <Text style={s.title} numberOfLines={2}>
              {page.title}
            </Text>
            {!!page.subtitle && (
              <Text style={s.subtitle} numberOfLines={2}>
                {page.subtitle}
              </Text>
            )}
          </View>
          <View style={s.actions}>
            <GradientButton icon="play" label="Play" onPress={() => playTracks(page.tracks, 0)} />
            <GhostButton
              icon="shuffle"
              label="Shuffle"
              onPress={() => {
                playerState.set({ shuffle: true });
                playTracks(page.tracks, Math.floor(Math.random() * page.tracks.length));
              }}
            />
            <Pressable
              onPress={() => page.tracks.reduce((p, t) => p.then(() => download(t)), Promise.resolve()).catch(downloadFailed)}
              style={s.iconBtn}
            >
              <Ionicons name="arrow-down" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <TrackRow track={item} index={index} showArt={!numbered} onPress={() => playTracks(page.tracks, index)} />
      )}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {body}
      <BackButton />
      <View style={{ paddingBottom: insets.bottom }}>
        <MiniPlayer />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  back: {
    position: 'absolute',
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artShadow: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 18, letterSpacing: -0.4 },
  subtitle: { color: colors.sub, fontSize: 14, textAlign: 'center', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 18, alignItems: 'center' },
  iconBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
});
