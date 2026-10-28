// Liked songs, recently played, and downloaded songs, persisted as JSON in the app's documents folder.
import { Directory, File, Paths } from 'expo-file-system';
import { createStore } from './store';
import { downloadAudio, getLikedMusic, rateSong, type Track } from './yt';

type Download = { track: Track; uri: string };

type Library = {
  liked: Track[];
  recent: Track[];
  downloads: Record<string, Download>;
  downloading: Record<string, number>; // id -> progress 0..1 (not persisted)
};

export const library = createStore<Library>({ liked: [], recent: [], downloads: {}, downloading: {} });

const dbFile = new File(Paths.document, 'library.json');
const songsDir = new Directory(Paths.document, 'songs');

export function loadLibrary() {
  try {
    if (dbFile.exists) {
      const saved = JSON.parse(dbFile.textSync());
      // Drop entries whose audio file has gone missing.
      const downloads: Record<string, Download> = {};
      for (const [id, d] of Object.entries<Download>(saved.downloads ?? {})) {
        if (new File(d.uri).exists) downloads[id] = d;
      }
      library.set({ liked: saved.liked ?? [], recent: saved.recent ?? [], downloads });
    }
  } catch (e) {
    console.warn('Could not load library', e);
  }
}

function save() {
  const { liked, recent, downloads } = library.get();
  try {
    if (!dbFile.exists) dbFile.create();
    dbFile.write(JSON.stringify({ liked, recent, downloads }));
  } catch (e) {
    console.warn('Could not save library', e);
  }
}

export const isLiked = (id: string) => library.get().liked.some((t) => t.id === id);

export function toggleLike(track: Track) {
  const { liked } = library.get();
  const nowLiked = !isLiked(track.id);
  library.set({ liked: nowLiked ? [track, ...liked] : liked.filter((t) => t.id !== track.id) });
  save();
  // Keep the YouTube account's likes in sync when signed in.
  rateSong(track.id, nowLiked).catch(() => {});
}

/** Merges songs liked on the YouTube Music account into the local Liked list. */
export async function syncYouTubeLikes() {
  const { tracks } = await getLikedMusic();
  const { liked } = library.get();
  const have = new Set(liked.map((t) => t.id));
  const fromYouTube = tracks.filter((t) => !have.has(t.id));
  if (!fromYouTube.length) return;
  library.set({ liked: [...liked, ...fromYouTube] });
  save();
}

export function addRecent(track: Track) {
  const recent = [track, ...library.get().recent.filter((t) => t.id !== track.id)].slice(0, 50);
  library.set({ recent });
  save();
}

export const localUri = (id: string): string | undefined => library.get().downloads[id]?.uri;

export async function download(track: Track) {
  const { downloads, downloading } = library.get();
  if (downloads[track.id] || track.id in downloading) return;
  library.set({ downloading: { ...downloading, [track.id]: 0 } });
  try {
    songsDir.create({ idempotent: true, intermediates: true });
    const bytes = await downloadAudio(track.id, (p) => {
      library.set({ downloading: { ...library.get().downloading, [track.id]: p } });
    });
    const file = new File(songsDir, `${track.id}.aac`);
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
    library.set({ downloads: { ...library.get().downloads, [track.id]: { track, uri: file.uri } } });
    save();
  } finally {
    const { [track.id]: _, ...rest } = library.get().downloading;
    library.set({ downloading: rest });
  }
}

export function removeDownload(id: string) {
  const { [id]: d, ...rest } = library.get().downloads;
  if (!d) return;
  try {
    new File(d.uri).delete();
  } catch {}
  library.set({ downloads: rest });
  save();
}
