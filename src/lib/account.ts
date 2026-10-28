// Two ways to connect a YouTube account:
//  - Google: the user signs in on Google's own page inside a WebView; we keep its youtube.com
//    cookies, which gives the full YouTube Music account (home, history, likes, playlists).
//  - TV code: Google's device flow — enter a code at google.com/device, no password in the app.
// Credentials are stored in the iOS Keychain / Android Keystore via expo-secure-store.
import * as SecureStore from 'expo-secure-store';
import WebCookies from '../../modules/web-cookies/src/WebCookiesModule';
import { createStore } from './store';
import { setCookie, yt } from './yt';

type Method = 'google' | 'tv';
type Saved = { method: 'google'; cookie: string } | { method: 'tv'; credentials: unknown };

type Account = {
  status: 'signed-out' | 'pending' | 'signed-in';
  method?: Method;
  code?: string;
  verifyUrl?: string;
  name?: string;
  photo?: string;
  error?: string;
};

export const account = createStore<Account>({ status: 'signed-out' });

// SecureStore values should stay under ~2 KB, and Google cookies are larger, so split them.
const KEY = 'melo_account';
const CHUNK = 1800;

async function save(data: Saved) {
  const text = JSON.stringify(data);
  const n = Math.ceil(text.length / CHUNK);
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${KEY}_${i}`, text.slice(i * CHUNK, (i + 1) * CHUNK));
  await SecureStore.setItemAsync(`${KEY}_n`, String(n));
}

async function load(): Promise<Saved | null> {
  const n = Number(await SecureStore.getItemAsync(`${KEY}_n`));
  if (!n) return null;
  let text = '';
  for (let i = 0; i < n; i++) text += (await SecureStore.getItemAsync(`${KEY}_${i}`)) ?? '';
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function clear() {
  const n = Number(await SecureStore.getItemAsync(`${KEY}_n`)) || 0;
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${KEY}_${i}`);
  await SecureStore.deleteItemAsync(`${KEY}_n`);
}

async function loadProfile() {
  try {
    const info: any = await (await yt()).account.getInfo();
    const header = info?.contents?.contents?.[0] ?? info?.contents?.[0] ?? info?.header;
    const name = header?.account_name?.toString?.() ?? header?.title?.toString?.();
    const photos: any[] = header?.account_photo ?? header?.thumbnail ?? [];
    account.set({ name: name || 'Signed in', photo: photos[photos.length - 1]?.url });
  } catch {
    account.set({ name: 'Signed in' });
  }
}

// ---- Google (WebView) sign-in ------------------------------------------------------------

/** Called by the Google sign-in screen once Google has redirected back to YouTube Music. */
export async function finishGoogleSignIn(): Promise<boolean> {
  const cookie = await WebCookies.getCookieHeader('youtube.com');
  if (!/(^|; )SAPISID=/.test(cookie)) return false;
  setCookie(cookie);
  await save({ method: 'google', cookie });
  account.set({ status: 'signed-in', method: 'google', error: undefined });
  await loadProfile();
  return true;
}

// ---- TV code sign-in ---------------------------------------------------------------------

async function tvSignIn(credentials?: unknown) {
  const session = (await yt()).session;
  session.on('auth-pending', (d: any) => account.set({ status: 'pending', method: 'tv', code: d.user_code, verifyUrl: d.verification_url }));
  session.on('auth', ({ credentials: c }: any) => save({ method: 'tv', credentials: c }));
  session.on('update-credentials', ({ credentials: c }: any) => save({ method: 'tv', credentials: c }));
  await session.signIn(credentials as any);
  account.set({ status: 'signed-in', method: 'tv', code: undefined, verifyUrl: undefined, error: undefined });
  await loadProfile();
}

/** Starts the TV code flow; `account.code` is set while waiting for approval. */
export async function signInWithCode() {
  try {
    account.set({ status: 'pending', method: 'tv', error: undefined });
    await tvSignIn();
  } catch (e: any) {
    account.set({ status: 'signed-out', code: undefined, error: e?.message ?? 'Sign-in failed' });
  }
}

// ---- Shared ------------------------------------------------------------------------------

/** Restores a saved sign-in at startup. */
export async function restoreSignIn() {
  const saved = await load();
  if (!saved) return;
  try {
    if (saved.method === 'google') {
      setCookie(saved.cookie);
      account.set({ status: 'signed-in', method: 'google' });
      await loadProfile();
    } else {
      await tvSignIn(saved.credentials);
    }
  } catch {
    await signOut();
  }
}

export async function signOut() {
  const { method, status } = account.get();
  try {
    if (method === 'tv' && status === 'signed-in') await (await yt()).session.signOut();
  } catch {}
  try {
    if (method === 'google') await WebCookies.clearAll();
  } catch {}
  await clear();
  setCookie(undefined);
  account.set({ status: 'signed-out', method: undefined, code: undefined, verifyUrl: undefined, name: undefined, photo: undefined });
}
