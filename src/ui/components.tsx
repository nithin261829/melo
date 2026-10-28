import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
} from 'react-native';
import { download, isLiked, library, removeDownload, toggleLike } from '../lib/library';
import { addToQueue, currentTrack, playerState, playNext } from '../lib/player';
import { useStore } from '../lib/store';
import type { Collection, Track } from '../lib/yt';
import { colors, formatTime, gradient } from './theme';

export const haptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function Artwork({ uri, size, radius = 8, style }: { uri?: string; size: number; radius?: number; style?: ImageStyle }) {
  return (
    <Image
      source={uri ? { uri } : undefined}
      style={[{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surface2 }, style]}
      contentFit="cover"
      transition={200}
      recyclingKey={uri}
    />
  );
}

export function openCollection(c: Collection) {
  router.push(`/${c.kind}/${c.id}`);
}

export function showTrackMenu(track: Track) {
  haptic();
  const { downloads, downloading } = library.get();
  const isDownloaded = !!downloads[track.id];
  const items: { label: string; run: () => void; destructive?: boolean }[] = [
    { label: 'Play next', run: () => playNext(track) },
    { label: 'Add to queue', run: () => addToQueue(track) },
    { label: isLiked(track.id) ? 'Remove from liked' : 'Like', run: () => toggleLike(track) },
    isDownloaded
      ? { label: 'Remove download', run: () => removeDownload(track.id), destructive: true }
      : { label: track.id in downloading ? 'Downloading…' : 'Download', run: () => download(track).catch(downloadFailed) },
  ];
  if (track.artistId) items.push({ label: 'Go to artist', run: () => router.push(`/artist/${track.artistId}`) });
  if (track.albumId) items.push({ label: 'Go to album', run: () => router.push(`/album/${track.albumId}`) });

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: track.title,
        message: track.artist,
        options: [...items.map((i) => i.label), 'Cancel'],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: items.findIndex((i) => i.destructive),
        userInterfaceStyle: 'dark',
      },
      (i) => items[i]?.run(),
    );
  } else {
    Alert.alert(track.title, track.artist, [
      ...items.slice(0, 2).map((i) => ({ text: i.label, onPress: i.run })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}

export const downloadFailed = (e: any) => Alert.alert('Download failed', e?.message ?? 'Please try again.');

export const TrackRow = memo(function TrackRow({
  track,
  onPress,
  index,
  showArt = true,
}: {
  track: Track;
  onPress: () => void;
  index?: number;
  showArt?: boolean;
}) {
  const { queue, index: qi } = useStore(playerState);
  const { downloads, downloading } = useStore(library);
  const active = queue[qi]?.id === track.id;
  const progress = downloading[track.id];
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      onLongPress={() => showTrackMenu(track)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
    >
      {showArt ? (
        <Artwork uri={track.thumb} size={52} radius={6} />
      ) : (
        <Text style={styles.rowIndex}>{index != null ? index + 1 : ''}</Text>
      )}
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowTitle, active && { color: colors.accent }]}>
          {track.title}
        </Text>
        <View style={styles.rowSubLine}>
          {downloads[track.id] && <Ionicons name="arrow-down-circle" size={13} color={colors.accent} style={{ marginRight: 4 }} />}
          {progress != null && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 4, transform: [{ scale: 0.6 }] }} />}
          <Text numberOfLines={1} style={styles.rowSub}>
            {[track.artist, track.duration ? formatTime(track.duration) : ''].filter(Boolean).join(' • ')}
          </Text>
        </View>
      </View>
      <Pressable hitSlop={12} onPress={() => showTrackMenu(track)} style={{ padding: 6 }}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.sub} />
      </Pressable>
    </Pressable>
  );
});

export function CollectionCard({ item, size = 150 }: { item: Collection; size?: number }) {
  const round = item.kind === 'artist';
  return (
    <Pressable onPress={() => openCollection(item)} style={({ pressed }) => [{ width: size, opacity: pressed ? 0.7 : 1 }]}>
      <Artwork uri={item.thumb} size={size} radius={round ? size / 2 : 10} />
      <Text numberOfLines={2} style={[styles.cardTitle, round && { textAlign: 'center' }]}>
        {item.title}
      </Text>
      {!!item.subtitle && (
        <Text numberOfLines={1} style={[styles.cardSub, round && { textAlign: 'center' }]}>
          {item.subtitle}
        </Text>
      )}
    </Pressable>
  );
}

export function TrackCard({ track, onPress, size = 150 }: { track: Track; onPress: () => void; size?: number }) {
  return (
    <Pressable onPress={onPress} onLongPress={() => showTrackMenu(track)} style={({ pressed }) => [{ width: size, opacity: pressed ? 0.7 : 1 }]}>
      <Artwork uri={track.thumb} size={size} radius={10} />
      <Text numberOfLines={1} style={styles.cardTitle}>
        {track.title}
      </Text>
      <Text numberOfLines={1} style={styles.cardSub}>
        {track.artist}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function HScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
      {children}
    </ScrollView>
  );
}

export function GradientButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradBtn}>
        <Ionicons name={icon} size={18} color="#fff" />
        <Text style={styles.btnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.faint} />
      <Text style={[styles.rowSub, { marginVertical: 12, textAlign: 'center' }]}>{message}</Text>
      <View style={{ flexDirection: 'row' }}>
        <GhostButton icon="refresh" label="Try again" onPress={onRetry} />
      </View>
    </View>
  );
}

export function EmptyView({ icon, title, hint }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string }) {
  return (
    <View style={[styles.center, { paddingTop: 80 }]}>
      <Ionicons name={icon} size={48} color={colors.faint} />
      <Text style={[styles.sectionTitle, { marginTop: 14, fontSize: 18 }]}>{title}</Text>
      <Text style={[styles.rowSub, { marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }]}>{hint}</Text>
    </View>
  );
}

export const isCurrent = (id: string) => currentTrack()?.id === id;

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 7, gap: 12 },
  rowIndex: { width: 26, textAlign: 'center', color: colors.sub, fontSize: 15, fontVariant: ['tabular-nums'] },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 15.5, fontWeight: '600' },
  rowSubLine: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  rowSub: { color: colors.sub, fontSize: 13.5, flexShrink: 1 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 8 },
  cardSub: { color: colors.sub, fontSize: 12.5, marginTop: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  gradBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23 },
  ghostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 20,
    backgroundColor: colors.surface2,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
