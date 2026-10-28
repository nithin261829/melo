// Client for the Melodi AI server (melodi-ai/). Sends the moment plus a taste summary worked out
// from the local library, and turns the planned mix back into playable Tracks.
import type { Moment } from './context';
import { library } from './library';
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
