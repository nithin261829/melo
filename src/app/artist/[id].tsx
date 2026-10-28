import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playTracks } from '../../lib/player';
import { getArtist, type ArtistPage } from '../../lib/yt';
import { CollectionCard, ErrorView, GradientButton, HScroll, Loading, SectionTitle, TrackCard, TrackRow } from '../../ui/components';
import { BackButton } from '../../ui/CollectionView';
import MiniPlayer from '../../ui/MiniPlayer';
import { colors } from '../../ui/theme';

export default function Artist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [artist, setArtist] = useState<ArtistPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getArtist(id)
      .then(setArtist)
      .catch((e) => setError(e?.message ?? 'Could not load artist'));
  }, [id]);
  useEffect(load, [load]);

  const body = error ? (
    <ErrorView message={error} onRetry={load} />
  ) : !artist ? (
    <Loading />
  ) : (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ height: width * 0.9 }}>
        <Image source={{ uri: artist.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        <LinearGradient colors={['transparent', 'rgba(10,10,15,0.6)', colors.bg]} locations={[0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
        <Text style={s.name} numberOfLines={2}>
          {artist.name}
        </Text>
      </View>
      {artist.topSongs.length > 0 && (
        <>
          <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
            <GradientButton icon="play" label="Play top songs" onPress={() => playTracks(artist.topSongs, 0)} />
          </View>
          <SectionTitle>Top songs</SectionTitle>
          {artist.topSongs.map((t, i) => (
            <TrackRow key={t.id} track={t} onPress={() => playTracks(artist.topSongs, i)} />
          ))}
        </>
      )}
      {artist.shelves.map((shelf) => (
        <View key={shelf.title}>
          <SectionTitle>{shelf.title}</SectionTitle>
          <HScroll>
            {shelf.tracks.map((t, i) => (
              <TrackCard key={t.id} track={t} size={180} onPress={() => playTracks(shelf.tracks, i)} />
            ))}
            {shelf.collections.map((c) => (
              <CollectionCard key={c.id} item={c} />
            ))}
          </HScroll>
        </View>
      ))}
      {!!artist.description && (
        <>
          <SectionTitle>About</SectionTitle>
          <Text style={s.about} numberOfLines={8}>
            {artist.description}
          </Text>
        </>
      )}
    </ScrollView>
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
  name: { position: 'absolute', left: 16, right: 16, bottom: 14, color: colors.text, fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  about: { color: colors.sub, fontSize: 14.5, lineHeight: 21, paddingHorizontal: 16 },
});
