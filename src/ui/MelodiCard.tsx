// "Melodi AI" on Home: senses the moment (time, weather, place, movement), lets the listener
// adjust it with chips or a description, and plays the mix the Melodi server plans.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { senseMoment, type Moment } from '../lib/context';
import { melodiConfigured, planMix, type Mix } from '../lib/melodi';
import { playTracks } from '../lib/player';
import { GradientButton, haptic } from './components';
import { colors } from './theme';

const MOODS = [
  { key: 'calm', label: '😌 Calm' },
  { key: 'happy', label: '😊 Happy' },
  { key: 'romantic', label: '💖 Romantic' },
  { key: 'sad', label: '💔 Sad' },
  { key: 'hype', label: '🔥 Hype' },
  { key: 'focus', label: '🎯 Focus' },
];

const ACTIVITY_LABEL = { still: '🛋️ Relaxing', walking: '🚶 Walking', driving: '🚗 Driving' } as const;

type MomentChip = 'weather' | 'activity' | 'city';

export function MelodiCard() {
  const [moment, setMoment] = useState<Moment | null>(null);
  const [off, setOff] = useState<Set<MomentChip>>(new Set());
  const [mood, setMood] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mix, setMix] = useState<Mix | null>(null);

  if (!melodiConfigured) return null;

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const sensed = moment ?? (await senseMoment());
      setMoment(sensed);
      // Chips the listener switched off are left out of what the server sees.
      const shared: Moment = {
        ...sensed,
        weather: off.has('weather') ? undefined : sensed.weather,
        activity: off.has('activity') ? undefined : sensed.activity,
        city: off.has('city') ? undefined : sensed.city,
      };
      const planned = await planMix(shared, { mood, description });
      if (!planned.tracks.length) throw new Error('Melodi could not find songs for this moment. Try another mood.');
      setMix(planned);
      playTracks(planned.tracks);
    } catch (e: any) {
      setError(e?.message ?? 'Melodi could not make a mix right now.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (chip: MomentChip) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });

  const momentChips: { key: MomentChip | 'daypart'; label: string }[] = [];
  if (moment) {
    momentChips.push({ key: 'daypart', label: `🕘 ${capitalize(moment.daypart)}` });
    if (moment.weather) momentChips.push({ key: 'weather', label: `${weatherEmoji(moment.weather)} ${capitalize(moment.weather)}` });
    if (moment.activity) momentChips.push({ key: 'activity', label: ACTIVITY_LABEL[moment.activity] });
    if (moment.city) momentChips.push({ key: 'city', label: `📍 ${moment.city}` });
  }

  return (
    <View style={s.card}>
      <LinearGradient
        colors={['rgba(255,61,110,0.18)', 'rgba(139,92,255,0.18)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.head}>
        <Ionicons name="sparkles" size={18} color={colors.accent} />
        <Text style={s.title}>Melodi AI</Text>
      </View>
      <Text style={s.sub}>{mix ? mix.description : 'A mix for this moment: your time, weather, place and mood.'}</Text>
      {mix && <Text style={s.mixTitle}>{mix.title}</Text>}

      {momentChips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {momentChips.map((c) => {
            const disabled = c.key !== 'daypart' && off.has(c.key);
            return (
              <Pressable key={c.key} disabled={c.key === 'daypart'} onPress={() => c.key !== 'daypart' && toggle(c.key)}>
                <Text style={[s.chip, disabled && s.chipOff]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {MOODS.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => {
              haptic();
              setMood(mood === m.key ? undefined : m.key);
            }}
          >
            <Text style={[s.chip, mood === m.key && s.chipOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Or describe it… “long drive to Vizag at night”"
        placeholderTextColor={colors.faint}
        style={s.input}
        maxLength={300}
        returnKeyType="go"
        onSubmitEditing={() => !busy && make()}
      />

      {error && <Text style={s.error}>{error}</Text>}

      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        {busy ? (
          <View style={s.busy}>
            <ActivityIndicator color={colors.text} />
            <Text style={s.busyText}>Melodi is reading the moment…</Text>
          </View>
        ) : (
          <GradientButton icon="sparkles" label={mix ? 'Make another mix' : 'Make my mix'} onPress={make} />
        )}
      </View>
    </View>
  );
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
  card: { marginHorizontal: 16, marginTop: 20, padding: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: colors.sub, fontSize: 13.5, marginTop: 6, lineHeight: 19 },
  mixTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  chips: { gap: 8, paddingTop: 12 },
  chip: { color: colors.text, fontSize: 13.5, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface2 },
  chipOn: { backgroundColor: colors.accent },
  chipOff: { opacity: 0.4, textDecorationLine: 'line-through' },
  input: { marginTop: 12, color: colors.text, fontSize: 14.5, backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: colors.accent, fontSize: 13, marginTop: 10 },
  busy: { flex: 1, height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.surface2 },
  busyText: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
});
