// Talks to YouTube Music through InnerTube (the private API YouTube's own apps use)
// via youtubei.js, and maps its parser nodes into the small plain types the UI uses.
import { Innertube, Log, YTNodes } from 'youtubei.js';

export type Track = {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration?: number; // seconds
  thumb: string;
};

export type Collection = {
  kind: 'album' | 'playlist' | 'artist';
  id: string;
  title: string;
  subtitle: string;
  thumb: string;
};

export type Shelf = { title: string; tracks: Track[]; collections: Collection[] };

export type CollectionPage = {
  title: string;
  subtitle: string;
  thumb: string;
  tracks: Track[];
};

export type ArtistPage = {
  name: string;
  thumb: string;
  description: string;
  topSongs: Track[];
  shelves: Shelf[];
};

export type SearchResults = { songs: Track[]; artists: Collection[]; albums: Collection[]; playlists: Collection[] };

Log.setLevel(Log.Level.NONE);

let client: Promise<Innertube> | null = null;
let cookie: string | undefined;

/** Uses YouTube cookies from a Google sign-in (or none) for all following requests. */
export function setCookie(value?: string) {
  cookie = value;
  client = null;
}

/** The shared InnerTube client. Signing in (see account.ts) authenticates this same session. */
export function yt(): Promise<Innertube> {
  // The player script is only needed to decipher URLs, which our audio source doesn't use.
  client ??= Innertube.create({ retrieve_player: false, cookie }).catch((e) => {
    client = null;
    throw e;
  });
  return client;
}

const str = (t: any): string => (t == null ? '' : typeof t === 'string' ? t : (t.text ?? t.toString?.() ?? ''));

// Thumbnails come in tiny sizes; googleusercontent URLs can be resized by rewriting the suffix.
export function bigThumb(url: string, size = 544): string {
  if (!url) return url;
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    return url.replace(/=w\d+-h\d+.*$/, `=w${size}-h${size}-l90-rj`).replace(/=s\d+.*$/, `=s${size}`);
  }
  return url.replace(/\/(default|mqdefault|sddefault)\.jpg/, '/hqdefault.jpg');
}

function thumbOf(node: any): string {
  const list: any[] = node?.thumbnail?.contents ?? node?.thumbnails ?? node?.thumbnail ?? [];
  const arr = Array.isArray(list) ? list : [];
  const url = arr.length ? arr[arr.length - 1].url : '';
  return bigThumb(url ?? '');
}

function artistsOf(node: any): { name: string; id?: string } {
  const a: any[] = node?.artists ?? node?.authors ?? (node?.author ? [node.author] : []);
  if (a.length) return { name: a.map((x) => x.name).join(', '), id: a[0].channel_id };
  // Fall back to the first part of a "Song • Artist • Album" subtitle.
  const sub = str(node?.subtitle).split(' • ').filter((s) => !/^(Song|Video|Album|Single|EP)$/.test(s));
  return { name: sub[0] ?? '' };
}

function toTrack(node: any, fallbackThumb = ''): Track | null {
  const id = node?.video_id ?? (node?.item_type === 'song' || node?.item_type === 'video' ? node?.id : undefined) ?? node?.id;
  if (!id || typeof id !== 'string' || id.length !== 11) return null;
  const { name, id: artistId } = artistsOf(node);
  return {
    id,
    title: str(node.title) || str(node.name),
    artist: name,
    artistId,
    album: node.album?.name,
    albumId: node.album?.id,
    duration: node.duration?.seconds || undefined,
    thumb: thumbOf(node) || fallbackThumb,
  };
}

function toCollection(node: any): Collection | null {
  const type = node?.item_type;
  if (!node?.id) return null;
  const kind: Collection['kind'] | null =
    type === 'album' ? 'album' : type === 'playlist' ? 'playlist' : type === 'artist' ? 'artist' : null;
  if (!kind) return null;
  return { kind, id: node.id, title: str(node.title) || str(node.name), subtitle: str(node.subtitle), thumb: thumbOf(node) };
}

function toShelf(section: any): Shelf | null {
  const title = str(section?.header?.title) || str(section?.title);
  const items: any[] = section?.contents ?? [];
  const tracks: Track[] = [];
  const collections: Collection[] = [];
  for (const it of items) {
    if (it.item_type === 'song' || it.item_type === 'video' || it.type === 'MusicResponsiveListItem') {
      const t = toTrack(it);
      if (t) tracks.push(t);
      else {
        const c = toCollection(it);
        if (c) collections.push(c);
      }
    } else {
      const c = toCollection(it);
      if (c) collections.push(c);
    }
  }
  if (!title || (!tracks.length && !collections.length)) return null;
  return { title, tracks, collections };
}

let anonymous: Promise<Innertube> | null = null;

export async function getHome(): Promise<Shelf[]> {
  const shelves = async (c: Innertube) =>
    ((await c.music.getHomeFeed()).sections ?? []).map(toShelf).filter((s): s is Shelf => !!s);
  const c = await yt();
  try {
    return await shelves(c);
  } catch (e) {
    // If YouTube Music rejects the signed-in session, fall back to a signed-out feed.
    if (!c.session.logged_in) throw e;
    anonymous ??= Innertube.create({ retrieve_player: false });
    return shelves(await anonymous);
  }
}

export async function search(query: string): Promise<SearchResults> {
  const r: any = await (await yt()).music.search(query);
  // Results arrive as a flat list of sections holding items tagged with item_type, in relevance order.
  const items: any[] = (r.contents ?? []).flatMap((s: any) => s.contents ?? []);
  const songs: Track[] = [];
  const videos: Track[] = [];
  const out: SearchResults = { songs, artists: [], albums: [], playlists: [] };
  for (const it of items) {
    if (it.item_type === 'song' || it.item_type === 'video') {
      const t = toTrack(it);
      if (t) (it.item_type === 'song' ? songs : videos).push(t);
    } else {
      const c = toCollection(it);
      if (c) out[`${c.kind}s`].push(c);
    }
  }
  // Official audio tracks first; music videos after them.
  out.songs = dedupe([...songs, ...videos]);
  return out;
}

export type SearchKind = 'song' | 'album' | 'playlist' | 'artist';
export type SearchPage = { tracks: Track[]; collections: Collection[]; next: (() => Promise<SearchPage>) | null };

function toSearchPage(res: any, items: any[]): SearchPage {
  const tracks: Track[] = [];
  const collections: Collection[] = [];
  for (const it of items) {
    if (it.item_type === 'song' || it.item_type === 'video') {
      const t = toTrack(it);
      if (t) tracks.push(t);
    } else {
      const c = toCollection(it);
      if (c) collections.push(c);
    }
  }
  return {
    tracks,
    collections,
    next: res.has_continuation
      ? async () => {
          const more: any = await res.getContinuation();
          return toSearchPage(more, more.contents?.contents ?? []);
        }
      : null,
  };
}

/** One category of results (like the Songs/Albums/... chips in YouTube Music), with paging. */
export async function searchFiltered(query: string, kind: SearchKind): Promise<SearchPage> {
  const res: any = await (await yt()).music.search(query, { type: kind });
  return toSearchPage(res, res.contents?.[0]?.contents ?? []);
}

export async function getSuggestions(query: string): Promise<string[]> {
  const sections: any[] = await (await yt()).music.getSearchSuggestions(query);
  return sections
    .flatMap((s) => s.contents ?? [])
    .map((c: any) => str(c.suggestion))
    .filter(Boolean)
    .slice(0, 8);
}

// Audio comes from the stream YouTube serves its visionOS app: an HLS playlist of audio-only
// AAC segments. Unlike the iOS/web clients (whose direct URLs stop after ~1 MB without a
// PO token), it needs no token or deciphering, and iOS plays HLS natively. Playing the
// stream with our own player is what skips ads: ads are served by YouTube's player.
const VISIONOS_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const VISIONOS_CLIENT = {
  clientName: 'VISIONOS',
  clientVersion: '1.02',
  deviceMake: 'Apple',
  deviceModel: 'RealityDevice17,1',
  userAgent: VISIONOS_UA,
  osName: 'visionOS',
  osVersion: '26.5.23O471',
  hl: 'en',
  gl: 'US',
};

/** Returns the URL of the song's best audio-only HLS playlist. */
export async function getAudioUrl(id: string): Promise<{ url: string; expiresAt: number }> {
  const visitorData: string = (await yt()).session.context.client.visitorData ?? '';
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': VISIONOS_UA,
      'X-Youtube-Client-Name': '101',
      'X-Youtube-Client-Version': VISIONOS_CLIENT.clientVersion,
      'X-Goog-Visitor-Id': visitorData,
    },
    body: JSON.stringify({
      videoId: id,
      context: { client: { ...VISIONOS_CLIENT, visitorData } },
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });
  const data: any = await res.json();
  const master = data.streamingData?.hlsManifestUrl;
  if (!master) throw new Error(data.playabilityStatus?.reason ?? 'This song is not available');
  const manifest = await (await fetch(master)).text();
  // Audio renditions: GROUP-ID 234 is high quality (~130 kbps AAC), 233 is low.
  const audio = manifest.split('\n').filter((l) => l.includes('TYPE=AUDIO'));
  const line = audio.find((l) => l.includes('GROUP-ID="234"')) ?? audio[audio.length - 1];
  const url = line?.match(/URI="([^"]+)"/)?.[1];
  if (!url) throw new Error('No audio stream found');
  const ttl = Number(data.streamingData.expiresInSeconds) || 6 * 3600;
  return { url, expiresAt: Date.now() + ttl * 1000 };
}

/** Downloads a song's HLS segments and joins them into a single ADTS .aac file's bytes. */
export async function downloadAudio(id: string, onProgress?: (fraction: number) => void): Promise<Uint8Array> {
  const { url } = await getAudioUrl(id);
  const playlist = await (await fetch(url)).text();
  const segments = playlist.split('\n').filter((l) => l && !l.startsWith('#'));
  const parts: Uint8Array[] = [];
  for (let i = 0; i < segments.length; i++) {
    const res = await fetch(new URL(segments[i], url).toString());
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    let bytes = new Uint8Array(await res.arrayBuffer());
    // Each segment starts with ID3 timestamp tags before the AAC frames; drop them.
    while (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
      bytes = bytes.subarray(10 + size);
    }
    parts.push(bytes);
    onProgress?.((i + 1) / segments.length);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export async function getUpNext(id: string): Promise<Track[]> {
  const panel: any = await (await yt()).music.getUpNext(id, true);
  return (panel.contents ?? [])
    .map((n: any) => toTrack(n))
    .filter((t: Track | null): t is Track => !!t && t.id !== id);
}

export async function getLyrics(id: string): Promise<string | null> {
  try {
    const l: any = await (await yt()).music.getLyrics(id);
    return str(l?.description) || null;
  } catch {
    return null;
  }
}

export async function getAlbum(id: string): Promise<CollectionPage> {
  const a: any = await (await yt()).music.getAlbum(id);
  const h = a.header ?? {};
  const thumb = thumbOf(h);
  const artist = str(h.strapline_text_one) || str(h.author?.name);
  return {
    title: str(h.title),
    subtitle: [artist, str(h.subtitle)].filter(Boolean).join(' • '),
    thumb,
    tracks: (a.contents ?? [])
      .map((n: any) => {
        const t = toTrack(n, thumb);
        if (t && !t.artist) t.artist = artist;
        if (t) t.album = str(h.title);
        return t;
      })
      .filter(Boolean),
  };
}

export async function getPlaylist(id: string): Promise<CollectionPage> {
  const p: any = await (await yt()).music.getPlaylist(id);
  const h = p.header ?? {};
  return {
    title: str(h.title),
    subtitle: [str(h.strapline_text_one) || str(h.author?.name), str(h.second_subtitle)]
      .join(' • ')
      .split(' • ')
      .filter((s) => s && s !== 'N/A')
      .join(' • '),
    thumb: thumbOf(h),
    tracks: (p.items ?? p.contents ?? []).map((n: any) => toTrack(n)).filter(Boolean),
  };
}

export async function getArtist(id: string): Promise<ArtistPage> {
  const a: any = await (await yt()).music.getArtist(id);
  const h = a.header ?? {};
  const shelves = (a.sections ?? []).map(toShelf).filter(Boolean) as Shelf[];
  const songsIdx = shelves.findIndex((s) => s.tracks.length && /song/i.test(s.title));
  const topSongs = songsIdx >= 0 ? shelves.splice(songsIdx, 1)[0].tracks : [];
  return { name: str(h.title), thumb: thumbOf(h), description: str(h.description), topSongs, shelves };
}

// ---- Signed-in account data -------------------------------------------------------------

/** Playlists saved in the user's YouTube Music library. */
export async function getMyPlaylists(): Promise<Collection[]> {
  const lib: any = await (await yt()).music.getLibrary();
  const items: any[] = (lib.contents ?? []).flatMap((s: any) => s.items ?? s.contents ?? []);
  return items.map(toCollection).filter((c): c is Collection => !!c && c.kind === 'playlist');
}

/** Songs the user liked on YouTube Music ("LM" is the Liked Music playlist). */
export const getLikedMusic = () => getPlaylist('LM');

/** Recently played on the user's YouTube Music account. */
export async function getHistory(): Promise<CollectionPage> {
  const res: any = await (await yt()).actions.execute('/browse', { browseId: 'FEmusic_history', client: 'YTMUSIC', parse: true });
  const items: any[] = res.contents_memo?.getType(YTNodes.MusicResponsiveListItem) ?? [];
  const tracks = dedupe(items.map((n) => toTrack(n)).filter((t): t is Track => !!t));
  return { title: 'History', subtitle: `${tracks.length} songs`, thumb: tracks[0]?.thumb ?? '', tracks };
}

/** Mirrors a like/unlike to the YouTube account (needs a Google sign-in's cookies). */
export async function rateSong(id: string, liked: boolean) {
  if (!cookie) return;
  const c = await yt();
  await (liked ? c.interact.like(id) : c.interact.removeRating(id));
}

function dedupe(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => !seen.has(t.id) && seen.add(t.id));
}
