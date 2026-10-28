// First row on Home: the songs Melodi planned for this moment, ready as soon as the app opens.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { melodi, melodiConfigured } from '../lib/melodi';
import { playTracks } from '../lib/player';
import { useStore } from '../lib/store';
import { HScroll, SectionTitle, TrackCard } from './components';
import { colors } from './theme';

export function MelodiShelf() {
  const { status, mix } = useStore(melodi);
  if (!melodiConfigured || (!mix && status !== 'working')) return null;

  const seeAll = (
    <Pressable hitSlop={10} onPress={() => router.navigate('/melodi')}>
      <Text style={{ color: colors.sub, fontSize: 14, fontWeight: '600' }}>See all</Text>
    </Pressable>
  );

  return (
    <View>
      <SectionTitle action={mix ? seeAll : undefined}>
        <Ionicons name="sparkles" size={18} color={colors.accent} /> {mix ? mix.title : 'For this moment'}
      </SectionTitle>
      {mix ? (
        <>
          <Text style={{ color: colors.accent2, fontSize: 12.5, fontWeight: '700', paddingHorizontal: 16, marginTop: -8, marginBottom: 4 }}>✨ by Melodi AI</Text>
          <Text style={{ color: colors.sub, fontSize: 13.5, paddingHorizontal: 16, marginBottom: 12 }} numberOfLines={2}>
            {mix.description}
          </Text>
          <HScroll>
            {mix.tracks.map((t, i) => (
              <TrackCard key={t.id} track={t} size={130} onPress={() => playTracks(mix.tracks, i)} />
            ))}
          </HScroll>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.sub, fontSize: 14 }}>Melodi AI is reading the moment…</Text>
        </View>
      )}
    </View>
  );
}
