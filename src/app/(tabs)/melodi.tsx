// The Melodi AI tab: the mix Melodi planned for this moment, with a reason for every song, and
// controls to steer it (context chips, moods, a free-text description, pull to re-plan).
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Moment } from '../../lib/context';
import { melodi, melodiConfigured, refreshMix, type MomentChip } from '../../lib/melodi';
import { playTracks } from '../../lib/player';
import { useStore } from '../../lib/store';
import { Artwork, EmptyView, GhostButton, GradientButton, haptic } from '../../ui/components';
import { colors } from '../../ui/theme';

const MOODS = [
  { key: 'calm', label: '😌 Calm' },
  { key: 'happy', label: '😊 Happy' },
  { key: 'romantic', label: '💖 Romantic' },
  { key: 'sad', label: '💔 Sad' },
  { key: 'hype', label: '🔥 Hype' },
  { key: 'focus', label: '🎯 Focus' },
];

const ACTIVITY_LABEL = { still: '🛋️ Relaxing', walking: '🚶 Walking', driving: '🚗 Driving' } as const;

export default function MelodiScreen() {
  const insets = useSafeAreaInsets();
  const { status, moment, mix, error, mood, description, off } = useStore(melodi);
  const [draft, setDraft] = useState(description);
  const working = status === 'working';

  if (!melodiConfigured) {
    return <EmptyView icon="sparkles-outline" title="Melodi AI isn't set up" hint="Set EXPO_PUBLIC_MELODI_URL to your Melodi AI server and rebuild the app." />;
  }

  const replan = (next: Partial<{ mood?: string; description: string; off: MomentChip[] }>) => {
    haptic();
    melodi.set(next);
    refreshMix({ force: true });
  };

  const toggleChip = (chip: MomentChip) =>
    replan({ off: off.includes(chip) ? off.filter((c) => c !== chip) : [...off, chip] });

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl tintColor={colors.accent} refreshing={false} onRefresh={() => replan({})} />}
    >
      <View style={s.header}>
        <Ionicons name="sparkles" size={24} color={colors.accent} />
        <Text style={s.h1}>Melodi</Text>
      </View>
      <Text style={s.lead}>Songs for this moment, picked from your time, weather, place, mood and taste.</Text>

      {moment && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {momentChips(moment).map((c) =>
            c.key === 'daypart' ? (
              <Text key={c.key} style={s.chip}>
                {c.label}
              </Text>
            ) : (
              <Pressable key={c.key} disabled={working} onPress={() => toggleChip(c.key as MomentChip)}>
                <Text style={[s.chip, off.includes(c.key as MomentChip) && s.chipOff]}>{c.label}</Text>
              </Pressable>
            ),
          )}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {MOODS.map((m) => (
          <Pressable key={m.key} disabled={working} onPress={() => replan({ mood: mood === m.key ? undefined : m.key })}>
            <Text style={[s.chip, mood === m.key && s.chipOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Describe it… “long drive to Vizag at night”"
        placeholderTextColor={colors.faint}
        style={s.input}
        maxLength={300}
        returnKeyType="go"
        editable={!working}
        onSubmitEditing={() => replan({ description: draft })}
      />

      {working && (
        <View style={s.working}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.workingText}>Melodi is reading the moment…</Text>
        </View>
      )}
      {status === 'error' && error && <Text style={s.error}>{error}</Text>}

      {mix && (
        <>
          <Text style={s.mixTitle}>{mix.title}</Text>
          <Text style={s.mixDesc}>{mix.description}</Text>
          <View style={s.actions}>
            <GradientButton icon="play" label="Play all" onPress={() => playTracks(mix.tracks)} />
            <GhostButton
              icon="shuffle"
              label="Shuffle"
              onPress={() => playTracks([...mix.tracks].sort(() => Math.random() - 0.5))}
            />
          </View>
          {mix.tracks.map((t, i) => (
            <Pressable key={t.id} onPress={() => playTracks(mix.tracks, i)} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
              <Artwork uri={t.thumb} size={52} radius={6} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {t.artist}
                </Text>
                {mix.reasons[t.id] && (
                  <Text style={s.why} numberOfLines={2}>
                    ✨ {mix.reasons[t.id]}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function momentChips(m: Moment): { key: MomentChip | 'daypart'; label: string }[] {
  const chips: { key: MomentChip | 'daypart'; label: string }[] = [{ key: 'daypart', label: `🕘 ${capitalize(m.daypart)}` }];
  if (m.weather) chips.push({ key: 'weather', label: `${weatherEmoji(m.weather)} ${capitalize(m.weather)}` });
  if (m.activity) chips.push({ key: 'activity', label: ACTIVITY_LABEL[m.activity] });
  if (m.city) chips.push({ key: 'city', label: `📍 ${m.city}` });
  return chips;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function weatherEmoji(weather: string) {
  if (/thunder/.test(weather)) return '⛈️';
  if (/rain|drizzle/.test(weather)) return '🌧️';
  if (/snow/.test(weather)) return '❄️';
  if (/fog/.test(weather)) return '🌫️';
  if (/cloud|overcast/.test(weather)) return '☁️';
  return '☀️';
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  h1: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  lead: { color: colors.sub, fontSize: 14, marginTop: 6, paddingHorizontal: 16, lineHeight: 20 },
  chips: { gap: 8, paddingTop: 12, paddingHorizontal: 16 },
  chip: { color: colors.text, fontSize: 13.5, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface2 },
  chipOn: { backgroundColor: colors.accent },
  chipOff: { opacity: 0.4, textDecorationLine: 'line-through' },
  input: { marginTop: 12, marginHorizontal: 16, color: colors.text, fontSize: 14.5, backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  working: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: 16 },
  workingText: { color: colors.sub, fontSize: 14 },
  error: { color: colors.accent, fontSize: 13.5, marginTop: 14, paddingHorizontal: 16 },
  mixTitle: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 22, paddingHorizontal: 16 },
  mixDesc: { color: colors.sub, fontSize: 14, marginTop: 4, paddingHorizontal: 16, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 14, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  rowTitle: { color: colors.text, fontSize: 15.5, fontWeight: '600' },
  rowSub: { color: colors.sub, fontSize: 13.5, marginTop: 2 },
  why: { color: colors.accent2, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
});
