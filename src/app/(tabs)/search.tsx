import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playTrack } from '../../lib/player';
import {
  getSuggestions,
  search,
  searchFiltered,
  type Collection,
  type SearchKind,
  type SearchPage,
  type SearchResults,
  type Track,
} from '../../lib/yt';
import { Artwork, ErrorView, Loading, openCollection, styles as ui, TrackRow } from '../../ui/components';
import { colors } from '../../ui/theme';

const FILTERS = ['All', 'Songs', 'Artists', 'Albums', 'Playlists'] as const;
type Filter = (typeof FILTERS)[number];

type Row = { type: 'track'; track: Track } | { type: 'collection'; item: Collection } | { type: 'header'; title: string };

const KIND: Record<Exclude<Filter, 'All'>, SearchKind> = { Songs: 'song', Artists: 'artist', Albums: 'album', Playlists: 'playlist' };

const trackRows = (list: Track[]) => list.map((track): Row => ({ type: 'track', track }));
const collectionRows = (list: Collection[]) => list.map((item): Row => ({ type: 'collection', item }));

// "All" is a short overview; each chip loads that category's full, paged list.
function overviewRows(r: SearchResults): Row[] {
  const out: Row[] = [];
  if (r.artists[0]) out.push({ type: 'collection', item: r.artists[0] });
  if (r.songs.length) out.push({ type: 'header', title: 'Songs' }, ...trackRows(r.songs.slice(0, 8)));
  if (r.albums.length) out.push({ type: 'header', title: 'Albums' }, ...collectionRows(r.albums.slice(0, 4)));
  if (r.artists.length > 1) out.push({ type: 'header', title: 'Artists' }, ...collectionRows(r.artists.slice(1, 4)));
  if (r.playlists.length) out.push({ type: 'header', title: 'Playlists' }, ...collectionRows(r.playlists.slice(0, 4)));
  return out;
}

type FilteredState = { tracks: Track[]; collections: Collection[]; next: SearchPage['next']; loadingMore: boolean };

function CollectionRow({ item }: { item: Collection }) {
  return (
    <Pressable onPress={() => openCollection(item)} style={({ pressed }) => [ui.row, pressed && { backgroundColor: colors.surface }]}>
      <Artwork uri={item.thumb} size={52} radius={item.kind === 'artist' ? 26 : 6} />
      <View style={ui.rowText}>
        <Text numberOfLines={1} style={ui.rowTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={ui.rowSub}>
          {item.subtitle || item.kind[0].toUpperCase() + item.kind.slice(1)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [submitted, setSubmitted] = useState('');
  const [filtered, setFiltered] = useState<Partial<Record<Filter, FilteredState>>>({});
  const [filterError, setFilterError] = useState<string | null>(null);
  const latest = useRef('');
  const query = useRef('');

  // Load the full list the first time a category chip is opened for this query.
  useEffect(() => {
    if (filter === 'All' || !submitted || filtered[filter]) return;
    const q = submitted;
    setFilterError(null);
    searchFiltered(q, KIND[filter])
      .then((page) => {
        if (query.current === q) setFiltered((f) => ({ ...f, [filter]: { ...page, loadingMore: false } }));
      })
      .catch((e) => query.current === q && setFilterError(e?.message ?? 'Search failed'));
  }, [filter, submitted, filtered]);

  function loadMore() {
    if (filter === 'All') return;
    const state = filtered[filter];
    if (!state?.next || state.loadingMore) return;
    const q = submitted;
    const f = filter;
    setFiltered((all) => ({ ...all, [f]: { ...state, loadingMore: true } }));
    state
      .next()
      .then((page) => {
        if (query.current !== q) return;
        setFiltered((all) => {
          const cur = all[f]!;
          return {
            ...all,
            [f]: {
              tracks: [...cur.tracks, ...page.tracks.filter((t) => !cur.tracks.some((x) => x.id === t.id))],
              collections: [...cur.collections, ...page.collections.filter((c) => !cur.collections.some((x) => x.id === c.id))],
              next: page.next,
              loadingMore: false,
            },
          };
        });
      })
      .catch(() => setFiltered((all) => ({ ...all, [f]: { ...all[f]!, loadingMore: false } })));
  }

  useEffect(() => {
    latest.current = text;
    if (!text.trim() || text === submitted) return setSuggestions([]);
    const t = setTimeout(() => {
      getSuggestions(text)
        .then((s) => latest.current === text && setSuggestions(s))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [text, submitted]);

  async function run(q: string) {
    if (!q.trim()) return;
    Keyboard.dismiss();
    setText(q);
    setSubmitted(q);
    query.current = q;
    setFiltered({});
    setSuggestions([]);
    setLoading(true);
    setError(null);
    try {
      setResults(await search(q));
    } catch (e: any) {
      setError(e?.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  const current = filter === 'All' ? null : filtered[filter];
  const rows: Row[] =
    filter === 'All'
      ? results
        ? overviewRows(results)
        : []
      : current
        ? [...trackRows(current.tracks), ...collectionRows(current.collections)]
        : [];
  const filterLoading = filter !== 'All' && !current && !filterError;

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <Text style={s.heading}>Search</Text>
      <View style={s.inputWrap}>
        <Ionicons name="search" size={18} color={colors.sub} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => run(text)}
          placeholder="Songs, artists, albums"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          autoCorrect={false}
          style={s.input}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
        />
        {!!text && (
          <Pressable hitSlop={10} onPress={() => setText('')}>
            <Ionicons name="close-circle" size={18} color={colors.sub} />
          </Pressable>
        )}
      </View>

      {suggestions.length > 0 ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={suggestions}
          keyExtractor={(x) => x}
          renderItem={({ item }) => (
            <Pressable onPress={() => run(item)} style={({ pressed }) => [s.suggestion, pressed && { backgroundColor: colors.surface }]}>
              <Ionicons name="search-outline" size={17} color={colors.sub} />
              <Text style={s.suggestionText}>{item}</Text>
              <Ionicons name="arrow-up-outline" size={17} color={colors.faint} style={{ transform: [{ rotate: '-45deg' }] }} />
            </Pressable>
          )}
        />
      ) : loading ? (
        <Loading />
      ) : error ? (
        <ErrorView message={error} onRetry={() => run(submitted)} />
      ) : results ? (
        <>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
              {FILTERS.map((f) => (
                <Pressable key={f} onPress={() => setFilter(f)} style={[s.chip, filter === f && s.chipActive]}>
                  <Text style={[s.chipText, filter === f && { color: '#000' }]}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          {filterLoading ? (
            <Loading />
          ) : filterError && filter !== 'All' ? (
            <ErrorView message={filterError} onRetry={() => setFiltered((f) => ({ ...f }))} />
          ) : (
          <FlatList
            data={rows}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            ListFooterComponent={current?.loadingMore ? <ActivityIndicator color={colors.accent} style={{ margin: 20 }} /> : undefined}
            keyboardDismissMode="on-drag"
            keyExtractor={(r, i) => (r.type === 'track' ? r.track.id : r.type === 'collection' ? r.item.id : r.title) + i}
            renderItem={({ item: r }) =>
              r.type === 'header' ? (
                <Text style={s.groupTitle}>{r.title}</Text>
              ) : r.type === 'track' ? (
                <TrackRow track={r.track} onPress={() => playTrack(r.track)} />
              ) : (
                <CollectionRow item={r.item} />
              )
            }
            contentContainerStyle={{ paddingBottom: 30 }}
          />
          )}
        </>
      ) : (
        <View style={ui.center}>
          <Ionicons name="musical-notes" size={54} color={colors.surface2} />
          <Text style={[ui.rowSub, { marginTop: 10 }]}>Find any song on YouTube Music — no ads.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  heading: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.8, paddingHorizontal: 16, marginBottom: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface2,
  },
  input: { flex: 1, color: colors.text, fontSize: 16 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 13 },
  suggestionText: { flex: 1, color: colors.text, fontSize: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.surface2 },
  chipActive: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13.5 },
  groupTitle: { color: colors.text, fontSize: 18, fontWeight: '800', paddingHorizontal: 16, marginTop: 18, marginBottom: 6 },
});
