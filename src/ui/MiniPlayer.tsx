import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { next, playerState, previous, progress, togglePlay } from '../lib/player';
import { useStore } from '../lib/store';
import { Artwork, haptic } from './components';
import { colors } from './theme';

function ProgressLine() {
  const { position, duration } = useStore(progress);
  const pct = duration ? Math.min(1, position / duration) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export default function MiniPlayer() {
  const { queue, index, playing, loading } = useStore(playerState);
  const track = queue[index];
  if (!track) return null;
  return (
    <Pressable onPress={() => router.push('/player')} style={styles.wrap}>
      <BlurView intensity={60} tint="dark" style={styles.blur}>
        <View style={styles.row}>
          <Artwork uri={track.thumb} size={42} radius={6} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.title}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={styles.sub}>
              {track.artist}
            </Text>
          </View>
          <Pressable
            hitSlop={10}
            onPress={() => {
              haptic();
              previous();
            }}
            style={styles.btn}
          >
            <Ionicons name="play-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            hitSlop={10}
            onPress={() => {
              haptic();
              togglePlay();
            }}
            style={styles.btn}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name={playing ? 'pause' : 'play'} size={26} color={colors.text} />
            )}
          </Pressable>
          <Pressable
            hitSlop={10}
            onPress={() => {
              haptic();
              next();
            }}
            style={styles.btn}
          >
            <Ionicons name="play-forward" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ProgressLine />
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 8, marginBottom: 6, borderRadius: 14, overflow: 'hidden' },
  blur: { backgroundColor: 'rgba(32,32,43,0.75)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  title: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  sub: { color: colors.sub, fontSize: 12.5, marginTop: 1 },
  btn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  track: { height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 10, marginBottom: 1 },
  fill: { height: 2, backgroundColor: colors.accent },
});
