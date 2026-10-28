import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { account } from '../../lib/account';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { library } from '../../lib/library';
import { playTrack, playTracks } from '../../lib/player';
import { useStore } from '../../lib/store';
import { getHome, type Shelf } from '../../lib/yt';
import { Artwork, CollectionCard, ErrorView, HScroll, Loading, SectionTitle, TrackCard, TrackRow } from '../../ui/components';
import { colors } from '../../ui/theme';

function AccountButton() {
  const { status, photo } = useStore(account);
  return (
    <Pressable hitSlop={10} onPress={() => router.push('/account')}>
      {status === 'signed-in' && photo ? (
        <Artwork uri={photo} size={34} radius={17} />
      ) : status === 'signed-in' ? (
        <Ionicons name="person-circle" size={34} color={colors.accent} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, paddingHorizontal: 12, height: 32, borderRadius: 16 }}>
          <Ionicons name="person-circle-outline" size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13.5 }}>Sign in</Text>
        </View>
      )}
    </Pressable>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// YouTube Music style "Quick picks": horizontally paged columns of four songs.
function QuickPicks({ shelf }: { shelf: Shelf }) {
  const { width } = useWindowDimensions();
  const cols: (typeof shelf.tracks)[] = [];
  for (let i = 0; i < shelf.tracks.length; i += 4) cols.push(shelf.tracks.slice(i, i + 4));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={width * 0.86} decelerationRate="fast">
      {cols.map((col, c) => (
        <View key={c} style={{ width: width * 0.86 }}>
          {col.map((t, i) => (
            <TrackRow key={t.id} track={t} onPress={() => playTracks(shelf.tracks, c * 4 + i)} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { recent } = useStore(library);
  const [shelves, setShelves] = useState<Shelf[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setShelves(await getHome());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your home feed');
    }
  }, []);

  // Reload when signing in or out so the feed matches the account.
  const { status } = useStore(account);
  useEffect(() => {
    if (status !== 'pending') load();
  }, [load, status]);

  if (error && !shelves) return <ErrorView message={error} onRetry={load} />;
  if (!shelves) return <Loading />;

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 30 }}
      refreshControl={
        <RefreshControl
          tintColor={colors.accent}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <Text style={{ color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.8 }}>{greeting()}</Text>
        <AccountButton />
      </View>

      {recent.length > 0 && (
        <>
          <SectionTitle>Listen again</SectionTitle>
          <HScroll>
            {recent.slice(0, 15).map((t) => (
              <TrackCard key={t.id} track={t} size={130} onPress={() => playTrack(t)} />
            ))}
          </HScroll>
        </>
      )}

      {shelves.map((shelf) => (
        <View key={shelf.title}>
          <SectionTitle>{shelf.title}</SectionTitle>
          {shelf.tracks.length >= 8 && !shelf.collections.length ? (
            <QuickPicks shelf={shelf} />
          ) : (
            <HScroll>
              {shelf.tracks.map((t, i) => (
                <TrackCard key={t.id} track={t} onPress={() => playTracks(shelf.tracks, i)} />
              ))}
              {shelf.collections.map((c) => (
                <CollectionCard key={c.id} item={c} />
              ))}
            </HScroll>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
