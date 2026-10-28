# Melo: project handoff

Everything from the original build session (run from `~/Downloads/TN-project`, 2026-10-27) that isn't obvious from the code. Read this together with `README.md`, which covers how the app works and the code map.

## What Melo is
A personal, ad-free YouTube Music app for iPhone, inspired by ViMusic and Demus. It runs entirely on the phone and costs $0: no server, no paid API, no Expo Go. It plays, downloads and searches music and has a YouTube account login.

## Stack
- Expo SDK 58, React Native 0.88, Expo Router (`src/app`), Hermes. Needs **Xcode 26.4 or newer**.
- `youtubei.js` 18.3.0 (InnerTube) for search, home, artists, lyrics and account data.
- Playback uses `expo-audio`. Downloads use `expo-file-system` and are written as `songs/<id>.aac`.
- Credentials are stored in the Keychain through `expo-secure-store`, chunked under the keys `melo_account_N`.
- There are two local Expo modules:
  - `modules/web-cookies`: reads WKWebView cookies for Google login.
  - `modules/remote-commands`: shows next/previous instead of ±10 s on the lock screen and Dynamic Island.
- The user doesn't want any third-party library that collects data. The dependencies were scanned and contain no analytics.

## How audio works (the non-obvious part)
- The IOS, MWEB and YTMUSIC client stream URLs are blocked by PO-token enforcement: they return 403 after about 1 MB.
- `getAudioUrl` in `src/lib/yt.ts` uses the **visionOS client** instead: clientName `VISIONOS`, number 101, version 1.02, a Safari user agent and the `visitorData` header. That client returns an audio-only HLS stream. The app picks GROUP-ID 234 (high quality; 233 is low).
- Without `visitorData` the request returns LOGIN_REQUIRED.
- The user explicitly approved this workaround.
- Downloads take the HLS segments, strip the ID3 tags and join the ADTS AAC data into one `.aac` file.

## Sign-in
- **Google login (full account):** a WebView opens `src/app/google-login.tsx`. Cookies, including SAPISID, come from the web-cookies module and are passed to `Innertube.create({cookie})`. This login unlocks history, playlists, likes sync and rating.
- **TV-code login:** also supported, because the user finds it more secure. YouTube Music endpoints return 400 with TV tokens, so a TV login gets a notice instead of the account features.

## Lock screen, Dynamic Island, background
- `UIBackgroundModes` audio is enabled through the expo-audio plugin (`enableBackgroundPlayback`).
- On its own, expo-audio's single-file player only shows ±10 s skip buttons. `modules/remote-commands` swaps them for next/previous, and `showTrackButtons()` runs after every `setActiveForLockScreen` / `updateLockScreenMetadata` call.
- `isLiveStream: false` is passed explicitly. Otherwise the indefinite HLS duration shows "LIVE" with no seek bar.
- Session resume: `session.json` (queue, index, position) is saved and restored on launch, so Melo continues where it left off when it was the last app playing.
- Do not patch `node_modules`. Edits to expo-audio were blocked, which is why the local module exists.

## Installing on the iPhone
- Device: an iPhone 16 Pro Max on iOS 26.6.1. Expo needs the hardware UDID, not the CoreDevice ID shown by `xcrun devicectl list devices`, which expo rejects. With the phone plugged in, find the UDID with `xcrun xctrace list devices`; it is the ID in brackets after the phone name. Put it in `MELO_UDID`.
- Signing: free Apple ID, team `D55Z5HS72V`, set as `ios.appleTeamId` in `app.json`. **The app expires every 7 days**, so reinstall it before then.
- Install command (keep the phone unlocked and plugged in):
  ```bash
  cd ~/Downloads/melo && export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 CI=1 && npx expo run:ios --device "$MELO_UDID" --configuration Release
  ```
  Add `--no-bundler` if Metro is already running. A full rebuild can take more than 10 minutes. The automatic launch at the end fails if the phone is locked, but the install itself still succeeds.
- First install on a device: Settings → General → VPN & Device Management → Nithin Chowdary → Trust.
- Simulator: iPhone 17 Pro. The simulator doesn't render Now Playing.
- **SideStore** is the install method that avoids the Mac. The free-account 7-day limit still applies, but you refresh from the phone over Wi-Fi.
  - Build an unsigned `.ipa` (SideStore signs it with your Apple ID):
    ```bash
    cd ~/Downloads/melo/ios && export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && xcodebuild -workspace Melo.xcworkspace -scheme Melo -configuration Release -destination 'generic/platform=iOS' -archivePath build/Melo.xcarchive archive CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""
    ```
    Then copy `build/Melo.xcarchive/Products/Applications/Melo.app` into a `Payload/` folder and zip it as `Melo.ipa`. The last build is in `~/Downloads/Melo-SideStore/Melo.ipa`.
  - Phone setup: install LocalDevVPN from the App Store and Connect. On the Mac, use iloader (https://iloader.app) → sign in → Install SideStore (Stable). Trust the Apple ID in VPN & Device Management.
  - Add Melo: SideStore → My Apps → + → pick `Melo.ipa`. Refresh by tapping the "7 DAYS" counter, with LocalDevVPN connected and on Wi-Fi.
  - A free Apple ID allows 3 active sideloaded apps, and SideStore counts as one of them.

## Environment gotchas
- Xcode 26.6 is at `/Applications/Xcode.app`. The old Xcode is kept as `/Applications/Xcode-16.2.app`. The Mac runs macOS 26.3, which is too old for App Store Xcode 27.1.
- CocoaPods crashes unless `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` is set.
- `.npmrc` sets `legacy-peer-deps=true` to get past a react-dom peer conflict.
- A stale Metro process on port 8081 serves old code. Kill it with `lsof -i :8081` before restarting.

## App icon
- The icon is an original drawing: a cartoon monkey with headphones and sunglasses on Melo's purple-to-pink gradient. It's drawn in code by `scripts/make_icon.py` (Pillow), so there are no licence or attribution requirements.
- Regenerate it with `python3 scripts/make_icon.py assets/icon.png`. Then copy the result to `ios/Melo/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`, or run prebuild.
- It replaced an earlier VectorStock preview image, which was never licensed.

## Status as of 2026-10-28
- Installed and working on the iPhone with the monkey icon:
  - playback, background playback, lock screen and Dynamic Island with next/previous and a seek bar
  - session resume
  - search with infinite scroll
- The user said it is "good enough for now".
- Not yet verified on the device: Google WebView login and the account features (history, playlists, like sync).

## Open offers (ask the user before doing any of these)
- Report Melo plays to YouTube history. This is a privacy trade-off.
- Free Siri App Shortcuts: "Play in Melo", "Resume Melo", "Shuffle my liked songs", "Play my downloads". SiriKit media intents would need a paid account.
- "Because you listened to…" shelves on Home.
- A SideStore `.ipa` build.

## Not possible on iOS
- Setting Melo as the default music app.
- Resuming from AirPods after the app was swiped away.

## Melodi AI (added 2026-10-28)
- An AI DJ: Home card `src/ui/MelodiCard.tsx` → `src/lib/context.ts` (time, weather, activity, city labels) → `src/lib/melodi.ts` → the Python server in `melodi-ai/` (FastAPI + Claude + ytmusicapi). The design is in `melodi-ai/README.md`.
- Pipeline: Claude reads the context → code narrows ~3,400 curated YouTube Music mood playlists → Claude picks 3–6 → code collects and scores real tracks → Claude orders the mix. Claude only returns numbers that code validates.
- Setup: `melodi-ai/.env` needs `ANTHROPIC_API_KEY`. The app reads `EXPO_PUBLIC_MELODI_URL` (and optionally `EXPO_PUBLIC_MELODI_TOKEN`) from the root `.env` at build time. `expo-location` is a native module, so the app needs a rebuild.
- The user wanted LangChain at first. We chose plain Anthropic SDK structured outputs as simpler and more reliable. A separately-defined-tools agent is on the roadmap.
- Ideas not built yet: evals in CI, Supabase pgvector taste embeddings, "🎬 Shot here" (Wikidata filming locations → soundtracks), audio mood features (Essentia, CLAP), saved places.
