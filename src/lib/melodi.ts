// Client for the Melodi AI server (github.com/nithin261829/melodi-ai). Sends the moment plus a taste
// summary worked out from the local library, and turns the planned mix back into playable Tracks.
// The app asks for a mix by itself when it opens, and reuses the last one while the moment is unchanged.
import { File, Paths } from 'expo-file-system';
import { senseMoment, type Moment } from './context';
import { library } from './library';
import { createStore } from './store';
import type { Track } from './yt';

// Set in .env (EXPO_PUBLIC_* values are baked into the app at build time). The token only stops
// casual misuse of the server: anything inside an app binary can be extracted.
const SERVER = process.env.EXPO_PUBLIC_MELODI_URL ?? '';
const TOKEN = process.env.EXPO_PUBLIC_MELODI_TOKEN ?? '';

export const melodiConfigured = SERVER.length > 0;

export type Mix = {
  title: string;
  description: string;
  tracks: Track[];
  reasons: Record<string, string>; // track id -> why it was picked
};

export type MomentChip = 'weather' | 'activity' | 'city';

type MelodiState = {
  status: 'idle' | 'working' | 'ready' | 'error';
  moment?: Moment;
  mix?: Mix;
  error?: string;
  mood?: string;
  description: string;
  off: MomentChip[]; // context the listener chose not to share
};

export const melodi = createStore<MelodiState>({ status: 'idle', description: '', off: [] });

// Same moment within this window -> reuse the last mix instead of paying for a new one.
const FRESH_MS = 30 * 60_000;
const lastFile = new File(Paths.document, 'melodi.json');
let last: { key: string; plannedAt: number; mix: Mix; moment: Moment } | null = null;

/** Called on launch and whenever the app comes back to the foreground. */
export function autoMix() {
  if (!melodiConfigured) return;
  if (!last) {
    try {
      if (lastFile.exists) {
        last = JSON.parse(lastFile.textSync());
        if (last && !melodi.get().mix) melodi.set({ status: 'ready', mix: last.mix, moment: last.moment });
      }
    } catch {
      last = null;
    }
  }
  refreshMix({ force: false });
}

/** Reads the moment and plans a mix; `force` skips the reuse check (new mood, description, pull to refresh). */
export async function refreshMix({ force }: { force: boolean }) {
  if (!melodiConfigured || melodi.get().status === 'working') return;
  melodi.set({ status: 'working', error: undefined });
  try {
    const { mood, description, off } = melodi.get();
    const sensed = await senseMoment();
    const shared: Moment = {
      ...sensed,
      weather: off.includes('weather') ? undefined : sensed.weather,
      activity: off.includes('activity') ? undefined : sensed.activity,
      city: off.includes('city') ? undefined : sensed.city,
    };
    const key = momentKey(shared, mood, description);
    if (!force && last && last.key === key && Date.now() - last.plannedAt < FRESH_MS) {
      melodi.set({ status: 'ready', moment: sensed, mix: last.mix });
      return;
    }
    const mix = await planMix(shared, { mood, description });
    if (!mix.tracks.length) throw new Error('Melodi could not find songs for this moment. Try another mood.');
    last = { key, plannedAt: Date.now(), mix, moment: sensed };
    try {
      if (!lastFile.exists) lastFile.create();
      lastFile.write(JSON.stringify(last));
    } catch {
      // Not being able to cache only costs a re-plan next launch.
    }
    melodi.set({ status: 'ready', moment: sensed, mix });
  } catch (e: any) {
    melodi.set({ status: 'error', error: e?.message ?? 'Melodi could not make a mix right now.' });
  }
}

// Temperature is left out so a one-degree change doesn't count as a new moment.
function momentKey(m: Moment, mood?: string, description?: string) {
  return [m.daypart, m.weather?.split(',')[0], m.activity, m.city, mood, description?.trim()].join('|');
}

type PlannedTrack = {
  video_id: string;
  title: string;
  artists: string[];
  album?: string | null;
  duration_seconds?: number | null;
  thumbnail?: string | null;
  why?: string | null;
};

export async function planMix(moment: Moment, choice: { mood?: string; description?: string }): Promise<Mix> {
  if (!melodiConfigured) throw new Error('Melodi AI server is not set up (EXPO_PUBLIC_MELODI_URL).');
  const res = await fetch(`${SERVER.replace(/\/$/, '')}/v1/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { 'X-Melodi-Token': TOKEN } : {}) },
    body: JSON.stringify({
      size: 25,
      context: {
        local_time: moment.localTime,
        daypart: moment.daypart,
        weather: moment.weather,
        activity: moment.activity,
        city: moment.city,
        country_code: moment.countryCode,
        mood: choice.mood,
        description: choice.description?.trim() || undefined,
        taste: tasteSummary(),
      },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.detail ?? `Melodi AI error ${res.status}`);

  const planned: PlannedTrack[] = body.tracks;
  return {
    title: body.title,
    description: body.description,
    tracks: planned.map((t) => ({
      id: t.video_id,
      title: t.title,
      artist: t.artists.join(', '),
      album: t.album ?? undefined,
      duration: t.duration_seconds ?? undefined,
      thumb: t.thumbnail ?? '',
    })),
    reasons: Object.fromEntries(planned.filter((t) => t.why).map((t) => [t.video_id, t.why as string])),
  };
}

/** Favourite artists and recent plays from the on-device library; nothing is stored server-side. */
function tasteSummary() {
  const { liked, recent } = library.get();
  const counts = new Map<string, number>();
  for (const [tracks, weight] of [[liked, 2], [recent, 1]] as const) {
    for (const t of tracks) {
      for (const name of t.artist.split(/,|&/).map((s) => s.trim()).filter(Boolean)) {
        counts.set(name, (counts.get(name) ?? 0) + weight);
      }
    }
  }
  const topArtists = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name);
  return {
    top_artists: topArtists,
    liked_video_ids: liked.slice(0, 200).map((t) => t.id),
    recent_video_ids: recent.slice(0, 30).map((t) => t.id),
  };
}
