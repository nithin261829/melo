// One app-wide audio player with a queue. Streams the raw audio URL (no YouTube player, so no ads),
// keeps playing in the background, and publishes "Now Playing" info for the lock screen,
// notification shade and the iPhone Dynamic Island.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import RemoteCommands from '../../modules/remote-commands/src/RemoteCommandsModule';
import { addRecent, localUri } from './library';
import { createStore } from './store';
import { getAudioUrl, getUpNext, type Track } from './yt';

type Repeat = 'off' | 'all' | 'one';

type PlayerState = {
  queue: Track[];
  index: number;
  playing: boolean;
  loading: boolean;
  error: string | null;
  repeat: Repeat;
  shuffle: boolean;
};

export const playerState = createStore<PlayerState>({
  queue: [],
  index: -1,
  playing: false,
  loading: false,
  error: null,
  repeat: 'off',
  shuffle: false,
});

// Position updates arrive twice a second, so they live in their own store to avoid re-rendering lists.
export const progress = createStore({ position: 0, duration: 0, buffering: false });

let player: AudioPlayer | null = null;
let lockScreenActive = false;
let loadToken = 0;
let radio = false; // keep appending "up next" songs when the queue runs low
let lastRadioSeed: string | null = null;
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export const currentTrack = (): Track | null => {
  const { queue, index } = playerState.get();
  return queue[index] ?? null;
};

function getPlayer(): AudioPlayer {
  if (player) return player;
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
  player = createAudioPlayer(null, { updateInterval: 500, keepAudioSessionActive: true });
  player.addListener('playbackStatusUpdate', onStatus);
  RemoteCommands?.addListener('onRemoteTrack', (e) => (e.command === 'next' ? next() : previous()));
  return player;
}

function onStatus(s: AudioStatus) {
  progress.set({ position: s.currentTime, duration: s.duration || currentTrack()?.duration || 0, buffering: s.isBuffering });
  if (s.playing !== playerState.get().playing) {
    playerState.set({ playing: s.playing });
    saveSession();
  } else if (s.playing && Date.now() - lastSessionSave > 5000) saveSession();
  if (s.didJustFinish) onFinished();
}

// The queue and position survive the app being closed, so reopening Melo (or pressing play on
// AirPods / the lock screen afterwards) picks up where you left off.
const sessionFile = new File(Paths.document, 'session.json');
let lastSessionSave = 0;

function saveSession() {
  lastSessionSave = Date.now();
  const { queue, index, repeat, shuffle } = playerState.get();
  if (!queue.length) return;
  try {
    if (!sessionFile.exists) sessionFile.create();
    sessionFile.write(JSON.stringify({ queue, index, repeat, shuffle, radio, position: progress.get().position }));
  } catch {}
}

/** Loads the last queue paused at the saved position, ready on the lock screen. */
export function restoreSession() {
  if (playerState.get().queue.length) return;
  try {
    if (!sessionFile.exists) return;
    const saved = JSON.parse(sessionFile.textSync());
    if (!saved.queue?.length) return;
    radio = !!saved.radio;
    playerState.set({ queue: saved.queue, repeat: saved.repeat ?? 'off', shuffle: !!saved.shuffle });
    loadIndex(Math.min(saved.index ?? 0, saved.queue.length - 1), false, saved.position ?? 0);
  } catch {}
}

function onFinished() {
  if (playerState.get().repeat === 'one') {
    getPlayer().seekTo(0).then(() => getPlayer().play());
  } else {
    next();
  }
}

async function sourceFor(id: string): Promise<string> {
  const local = localUri(id);
  if (local) return local;
  const cached = urlCache.get(id);
  if (cached && cached.expiresAt - Date.now() > 10 * 60_000) return cached.url;
  const fresh = await getAudioUrl(id);
  urlCache.set(id, fresh);
  return fresh.url;
}

async function loadIndex(index: number, autoplay = true, startAt = 0) {
  const track = playerState.get().queue[index];
  if (!track) return;
  const token = ++loadToken;
  playerState.set({ index, loading: true, error: null });
  progress.set({ position: startAt, duration: track.duration ?? 0 });
  const p = getPlayer();
  p.pause();
  try {
    const uri = await sourceFor(track.id);
    if (token !== loadToken) return; // the user skipped again while this was resolving
    p.replace({ uri });
    if (startAt) p.seekTo(startAt);
    if (autoplay) p.play();
    const meta = { title: track.title, artist: track.artist, albumTitle: track.album, artworkUrl: track.thumb };
    if (lockScreenActive) p.updateLockScreenMetadata(meta);
    else {
      // The HLS stream's length is unknown for a moment after loading; without this iOS
      // shows "LIVE" and hides the seek bar.
      p.setActiveForLockScreen(true, meta, { isLiveStream: false });
      lockScreenActive = true;
    }
    RemoteCommands?.showTrackButtons();
    if (autoplay) addRecent(track);
    playerState.set({ loading: false });
    saveSession();
    extendRadio();
    prefetch(index + 1);
  } catch (e: any) {
    if (token !== loadToken) return;
    playerState.set({ loading: false, error: e?.message ?? 'Could not play this song' });
  }
}

// Resolve the next song's URL early so skipping feels instant.
function prefetch(index: number) {
  const t = playerState.get().queue[index];
  if (t) sourceFor(t.id).catch(() => {});
}

// When the queue is nearly over, append songs YouTube Music recommends after the last one.
async function extendRadio() {
  const { queue, index } = playerState.get();
  if (!radio || queue.length - index > 3) return;
  const seed = queue[queue.length - 1].id;
  if (seed === lastRadioSeed) return;
  lastRadioSeed = seed;
  try {
    const more = await getUpNext(seed);
    const have = new Set(playerState.get().queue.map((t) => t.id));
    const fresh = more.filter((t) => !have.has(t.id));
    if (fresh.length) playerState.set({ queue: [...playerState.get().queue, ...fresh] });
  } catch {}
}

/** Play `tracks` starting at `startIndex`. A single song starts a radio of similar songs. */
export function playTracks(tracks: Track[], startIndex = 0) {
  let queue = tracks;
  let index = startIndex;
  if (playerState.get().shuffle && tracks.length > 1) {
    const [first] = tracks.slice(startIndex, startIndex + 1);
    queue = [first, ...shuffled(tracks.filter((_, i) => i !== startIndex))];
    index = 0;
  }
  radio = tracks.length === 1;
  lastRadioSeed = null;
  playerState.set({ queue });
  loadIndex(index);
}

export const playTrack = (track: Track) => playTracks([track]);

export function togglePlay() {
  const p = getPlayer();
  if (!currentTrack()) return;
  if (playerState.get().error) return void loadIndex(playerState.get().index);
  p.playing ? p.pause() : p.play();
}

export function next() {
  const { queue, index, repeat } = playerState.get();
  if (index + 1 < queue.length) loadIndex(index + 1);
  else if (repeat === 'all' && queue.length) loadIndex(0);
  else getPlayer().pause();
}

export function previous() {
  const { index } = playerState.get();
  if (progress.get().position > 3 || index === 0) getPlayer().seekTo(0);
  else loadIndex(index - 1);
}

export const seekTo = (seconds: number) => getPlayer().seekTo(seconds);
export const skipTo = (index: number) => loadIndex(index);

export function playNext(track: Track) {
  const { queue, index } = playerState.get();
  if (!queue.length) return playTrack(track);
  const rest = queue.filter((t, i) => i <= index || t.id !== track.id);
  rest.splice(index + 1, 0, track);
  playerState.set({ queue: rest });
}

export function addToQueue(track: Track) {
  const { queue } = playerState.get();
  if (!queue.length) return playTrack(track);
  if (!queue.some((t) => t.id === track.id)) playerState.set({ queue: [...queue, track] });
}

export function cycleRepeat() {
  const order: Repeat[] = ['off', 'all', 'one'];
  playerState.set({ repeat: order[(order.indexOf(playerState.get().repeat) + 1) % 3] });
}

export function toggleShuffle() {
  const { shuffle, queue, index } = playerState.get();
  if (!shuffle && queue.length > index + 2) {
    playerState.set({ queue: [...queue.slice(0, index + 1), ...shuffled(queue.slice(index + 1))] });
  }
  playerState.set({ shuffle: !shuffle });
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
