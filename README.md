# Melo

Ad-free YouTube Music player for iPhone (and Android), built with Expo / React Native.

## How it works

- **youtubei.js** talks to InnerTube, the same internal API that youtube.com and the YouTube Music app use. No API key, no server, no cost.
- Audio is requested as YouTube's visionOS client, which returns an audio-only HLS stream (AAC) that needs no PO token and that iOS plays natively. (The iOS/web clients now stop after ~1 MB without a PO token.)
- **expo-audio** plays that stream directly. Ads come from YouTube's player, which this app never loads.
- Background playback, lock-screen controls and the Dynamic Island come from iOS "Now Playing" (`setActiveForLockScreen`).
- Downloads join the HLS segments into one .aac file in the app's Documents folder and play offline. Likes, recents and downloads are stored in `library.json`.

## Code map

| Path | What it does |
|---|---|
| `src/lib/yt.ts` | YouTube Music: home, search, suggestions, audio URL, up-next, lyrics, album, playlist, artist |
| `src/lib/player.ts` | Queue, radio (auto-adds similar songs), shuffle, repeat, lock screen |
| `src/lib/library.ts` | Likes, recently played, downloads |
| `src/lib/polyfills.ts` | Web APIs youtubei.js needs on React Native (loaded first by `index.js`) |
| `src/app/` | Screens (Expo Router): tabs (Home, Search, Library), `player`, `album/[id]`, `playlist/[id]`, `artist/[id]` |
| `src/ui/` | Shared components, mini player, theme |

## Install on your iPhone (free)

Requires **Xcode 26.4+** (Mac App Store) and an iPhone on iOS 16.4+.

1. Open Xcode once → Settings → Accounts → add your Apple ID.
2. Plug in the iPhone, tap **Trust**, and enable **Settings → Privacy & Security → Developer Mode**.
3. Build a standalone release (JavaScript is bundled inside the app, so no Mac is needed afterwards):
   ```bash
   npx expo run:ios --device --configuration Release
   ```
   Pick your iPhone when asked. If signing fails, open `ios/Melo.xcworkspace`, select the Melo target → Signing & Capabilities → choose your "Personal Team".
4. On the iPhone: **Settings → General → VPN & Device Management** → trust your Apple ID.

With a free Apple ID the app expires after 7 days. Re-run step 3 to refresh it (or use SideStore, or a paid developer account).

## Development

```bash
npx expo run:ios          # simulator, with live reload
npx tsc --noEmit          # typecheck
```

Personal use only: downloading from YouTube is against YouTube's Terms of Service.
