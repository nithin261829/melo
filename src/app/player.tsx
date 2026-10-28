import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { download, library, removeDownload, toggleLike } from '../lib/library';
import {
  cycleRepeat,
  next,
  playerState,
  previous,
  progress,
  seekTo,
  skipTo,
  togglePlay,
  toggleShuffle,
} from '../lib/player';
import { useStore } from '../lib/store';
import { getLyrics, type Track } from '../lib/yt';
import { Artwork, downloadFailed, haptic, styles as ui } from '../ui/components';
import { colors, formatTime } from '../ui/theme';

type Panel = 'art' | 'lyrics' | 'queue';

function Seekbar() {
  const { position, duration } = useStore(progress);
  const [dragging, setDragging] = useState<number | null>(null);
  const value = dragging ?? position;
  return (
    <View>
      <Slider
        style={{ height: 30, marginHorizontal: -4 }}
        minimumValue={0}
        maximumValue={duration || 1}
        value={value}
        minimumTrackTintColor={colors.text}
        maximumTrackTintColor="rgba(255,255,255,0.2)"
        thumbTintColor={colors.text}
        onValueChange={setDragging}
        onSlidingComplete={async (v) => {
          await seekTo(v);
          setDragging(null);
        }}
      />
      <View style={s.times}>
        <Text style={s.time}>{formatTime(value)}</Text>
        <Text style={s.time}>-{formatTime(Math.max(0, duration - value))}</Text>
      </View>
    </View>
  );
}

function Lyrics({ track }: { track: Track }) {
  const [lyrics, setLyrics] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setLyrics(undefined);
    getLyrics(track.id).then(setLyrics);
  }, [track.id]);
  if (lyrics === undefined) return <ActivityIndicator color={colors.text} style={{ flex: 1 }} />;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
      <Text style={s.lyrics}>{lyrics ?? 'No lyrics available for this song.'}</Text>
    </ScrollView>
  );
}

function Queue() {
  const { queue, index } = useStore(playerState);
  const upcoming = queue.slice(index + 1);
  return (
    <FlatList
      style={{ flex: 1 }}
      data={upcoming}
      keyExtractor={(t, i) => t.id + i}
      ListHeaderComponent={<Text style={s.queueTitle}>Up next</Text>}
      ListEmptyComponent={<Text style={[ui.rowSub, { padding: 8 }]}>Nothing queued.</Text>}
      renderItem={({ item, index: i }) => (
        <Pressable onPress={() => skipTo(index + 1 + i)} style={({ pressed }) => [s.queueRow, pressed && { opacity: 0.6 }]}>
          <Artwork uri={item.thumb} size={44} radius={5} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={ui.rowTitle}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={ui.rowSub}>
              {item.artist}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

export default function Player() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { queue, index, playing, loading, error, repeat, shuffle } = useStore(playerState);
  const { liked, downloads, downloading } = useStore(library);
  const [panel, setPanel] = useState<Panel>('art');
  const track = queue[index];

  useEffect(() => {
    if (!track) router.back();
  }, [track]);
  if (!track) return null;

  const isLiked = liked.some((t) => t.id === track.id);
  const isDownloaded = !!downloads[track.id];
  const dlProgress = downloading[track.id];
  const artSize = width - 56;
  const tap = (fn: () => void) => () => {
    haptic();
    fn();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Blurred, darkened artwork fills the background. */}
      <Image source={{ uri: track.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />

      <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 12, paddingHorizontal: 28 }}>
        <View style={s.topBar}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="chevron-down" size={28} color={colors.text} />
          </Pressable>
          <Text style={s.topLabel} numberOfLines={1}>
            {track.album ?? 'Now playing'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', marginVertical: 18 }}>
          {panel === 'art' ? (
            <View style={s.artShadow}>
              <Artwork uri={track.thumb} size={artSize} radius={14} />
            </View>
          ) : panel === 'lyrics' ? (
            <Lyrics track={track} />
          ) : (
            <Queue />
          )}
        </View>

        <View style={s.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={s.title}>
              {track.title}
            </Text>
            <Pressable
              disabled={!track.artistId}
              onPress={() => {
                router.back();
                router.push(`/artist/${track.artistId}`);
              }}
            >
              <Text numberOfLines={1} style={s.artist}>
                {track.artist}
              </Text>
            </Pressable>
          </View>
          <Pressable hitSlop={10} onPress={tap(() => toggleLike(track))}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={28} color={isLiked ? colors.accent : colors.text} />
          </Pressable>
        </View>

        <Seekbar />
        {!!error && <Text style={s.error}>{error} — tap play to retry</Text>}

        <View style={s.controls}>
          <Pressable hitSlop={10} onPress={tap(toggleShuffle)}>
            <Ionicons name="shuffle" size={24} color={shuffle ? colors.accent : colors.sub} />
          </Pressable>
          <Pressable hitSlop={10} onPress={tap(previous)}>
            <Ionicons name="play-skip-back" size={34} color={colors.text} />
          </Pressable>
          <Pressable onPress={tap(togglePlay)} style={({ pressed }) => [s.playBtn, pressed && { transform: [{ scale: 0.94 }] }]}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Ionicons name={playing ? 'pause' : 'play'} size={36} color="#000" style={!playing && { marginLeft: 4 }} />
            )}
          </Pressable>
          <Pressable hitSlop={10} onPress={tap(next)}>
            <Ionicons name="play-skip-forward" size={34} color={colors.text} />
          </Pressable>
          <Pressable hitSlop={10} onPress={tap(cycleRepeat)}>
            <View>
              <Ionicons name="repeat" size={24} color={repeat === 'off' ? colors.sub : colors.accent} />
              {repeat === 'one' && <Text style={s.repeatOne}>1</Text>}
            </View>
          </Pressable>
        </View>

        <View style={s.bottomRow}>
          <Pressable hitSlop={10} onPress={tap(() => setPanel(panel === 'lyrics' ? 'art' : 'lyrics'))}>
            <Ionicons name="chatbox-ellipses-outline" size={22} color={panel === 'lyrics' ? colors.accent : colors.sub} />
          </Pressable>
          <Pressable
            hitSlop={10}
            onPress={tap(() => (isDownloaded ? removeDownload(track.id) : download(track).catch(downloadFailed)))}
          >
            {dlProgress != null ? (
              <Text style={[s.time, { color: colors.accent }]}>{Math.round(dlProgress * 100)}%</Text>
            ) : (
              <Ionicons
                name={isDownloaded ? 'checkmark-circle' : 'arrow-down-circle-outline'}
                size={24}
                color={isDownloaded ? colors.accent : colors.sub}
              />
            )}
          </Pressable>
          <Pressable hitSlop={10} onPress={tap(() => setPanel(panel === 'queue' ? 'art' : 'queue'))}>
            <Ionicons name="list" size={24} color={panel === 'queue' ? colors.accent : colors.sub} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLabel: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, opacity: 0.8 },
  artShadow: {
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  artist: { color: 'rgba(255,255,255,0.7)', fontSize: 17, marginTop: 3 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontVariant: ['tabular-nums'] },
  error: { color: colors.accent, fontSize: 13, textAlign: 'center', marginTop: 6 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  playBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  repeatOne: { position: 'absolute', right: -6, top: -6, color: colors.accent, fontSize: 11, fontWeight: '900' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, paddingHorizontal: 12 },
  lyrics: { color: colors.text, fontSize: 21, lineHeight: 32, fontWeight: '700' },
  queueTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
