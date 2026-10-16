# Convey — Private Mobile App with Text-Transported Video

> **v1.2.0** · formerly "VideoShare"

> **What's new in v1.2.0**: a one-tap copy button on the sender's pairing code with a live expiry countdown, a rewritten landing headline, and the new launcher icon set. Full list in [What We Have Done](videoshare/README.md#what-we-have-done).

Convey is a private mobile application designed for **exactly two paired devices**. It features a streamlined two-option pairing interface, a private chat, and an experimental core: **transferring high-resolution video files up to 2 GB over our own text-based chat transport without third-party messaging services**.

The app is designed for **poor connections**: every timing decision (timeouts, chunk size, in-flight window) is derived from a live round-trip measurement, so a 2G-class link transfers slowly instead of failing. It ships with a **"liquid glass" UI and four selectable themes plus a System option** (Aurora Dark, Aurora Light, Claude Warm, Midnight).

---

## App Design & Workflow

When opening the app, users are greeted with two primary, distinct options:

```
                          ┌──────────────────────────┐
                          │      Convey Launch       │
                          └─────────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
       [ Select File (Send) ]                        [ Receive Video ]
                 │                                             │
                 ▼                                             ▼
  1. Pick Video File (≤ 2 GB)                     1. Enter 6-Digit Pairing Code
  2. Prepare Transfer (no full read!):                          │
     - File size + link-aware chunk plan            2. Device Storage Display:
     - Metadata fingerprint (SHA-256)                  - Real free space (native)
                 │                                      - Visual Capacity Bar
                 ▼                                      - Storage details shared on join
  3. Generate 6-Figure Pairing Code                             │
  4. Wait for Receiver to Join                                  │
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                         [ 6-Figure Code Matched ]
                                        │
                                        ▼
                  [ Receiver Storage Verification Gate ]
    - Sender verifies receiver's real free space against video size
    - If Insufficient: Transfer blocked to prevent failure
    - If Sufficient: Sender clicks "Start Transfer"
                                        │
                                        ▼
                       [ Streaming Text Transfer ]
    - Adaptive sliding window (4 → 32 chunks), ACK-gated
    - Timeouts, chunk size and window all follow the measured RTT
    - Chunks read from disk on demand
                                        │
                                        ▼
                  [ Receiver Streaming Reassembly ]
    - Each chunk hash-verified, written to disk, then copied into the video
                                        │
                                        ▼
                  [ Integrity Verified — Play Video ]
```

### 1. "Select File" Option (Sender Flow)
1. **File Selection**: Choose a real video from the gallery or file picker (up to **2 GB**), or pick one of the demo sizes for testing the transport.
2. **Instant Transfer Preparation**: The app **does not read the file** — it inspects the size, derives the chunk plan, and computes a small metadata fingerprint. This takes milliseconds even for a 2 GB video, because the bytes are streamed off disk later.
3. **6-Figure Pairing Code**: The backend generates a 6-digit code displayed as digit tiles, with a one-tap **Copy code** button and a live countdown of the server-issued expiry (10 minutes by default). Tapping the digits copies too.
4. **Receiver Storage Verification**: When the receiver joins, the sender receives the receiver's real available storage. The sender verifies `availableBytes >= requiredBytes` (+ safety margin) before starting, eliminating doomed transfers.

### 2. "Receive" Option (Receiver Flow)
1. **Enter 6-Digit Code**: Numeric input field to enter the sender's pairing code.
2. **Available Storage Display**: Directly below the code input, the receiver's available device storage (e.g., `48.2 GB Free / 128.0 GB Total`) is displayed with a graphical capacity meter, read straight from the native filesystem.
3. **Storage Reporting**: Upon pairing, storage metrics are securely shared with the sender for verification.
4. **Transfer Reception**: Chunks stream across the WebSocket text transport, each is SHA-256 verified before being written to disk, then reassembled and confirmed. If the connection drops mid-transfer, both sides resume from what is already on disk instead of restarting.

### 3. Themes

An appearance picker (palette icon, top-right of every screen) offers:

| Theme | Character |
|---|---|
| **System** | Follows the device light/dark setting, resolving to Aurora Light or Aurora Dark |
| **Aurora Dark** | Deep indigo canvas with violet/cyan glass accents |
| **Aurora Light** | Bright, airy glass over a soft pastel wash |
| **Claude Warm** | Cream paper with terracotta accents |
| **Midnight** | Near-black with a single electric accent |

The choice is persisted on device and applied instantly across every screen, including the status bar.

### 4. Iconography

There are **no emoji anywhere in the interface**. Every in-app icon comes from a single monochrome set (`src/components/ui/Icon.tsx`) that inherits the active theme colour, so icons always match the surrounding text. Shapes that have no dependable system glyph — chevrons, the checkmark, the clock, the play triangle, the lock, signal bars, the framed video glyph, the database stack, the copy sheets — are drawn from plain views. Only ASCII and Basic-Latin glyphs are used where a glyph is needed at all, which avoids two common Android problems: pictographic characters being replaced by a colour emoji font, and geometric characters missing from the device font.

### 5. App Icon & Splash

The launcher icon is a **gradient play triangle with two motion beams** — the triangle says "video", the beams say "in transit". It is drawn in the Aurora Dark palette (`#7C6BFF → #3FD0E0`) so the icon matches the app's default theme, and it stays legible down to 24 px.

All five assets are generated from `videoshare/mobile/assets/generate-icons.py`, which also encodes the Android adaptive-icon safe zone (the mark is emitted at 0.86 scale so it survives a circular mask, a squircle mask and the tight 66 dp safe zone without clipping) and provides the Android 13+ `monochromeImage` for themed icons. The splash is the mark alone on `#0A0F1D` with no wordmark, so there is no flash between the splash and the first screen.

### 6. Keyboard Handling

Every screen with a text field uses `KeyboardAvoidingView` with **`behavior="padding"` on Android as well as iOS**. Since edge-to-edge became the default in Expo SDK 53+, Android no longer honours `windowSoftInputMode="adjustResize"`, so the previous Android-specific "no avoidance" branch left the chat composer and the pairing-code input hidden behind the keyboard. `KeyboardAvoidingView` measures the overlap against its own frame, which makes this self-correcting: on a device where the window *does* resize, the overlap is zero and no extra padding is added. The chat also scrolls to the newest message when the keyboard opens.

### 7. Working on a Bad Connection

A fixed timeout cannot serve both Wi-Fi (RTT ~50 ms) and 2G (RTT of several seconds at ~10 KB/s), so **every timing decision is derived from a measured round-trip time**:

- **Adaptive chunk sizing** — 128 KB / 64 KB / 32 KB / **16 KB** chosen from the measured RTT. On 2G a 16 KB chunk becomes a ~22 KB frame that completes in a couple of seconds; a larger frame would be discarded entirely if the link dropped mid-frame.
- **Adaptive window** — starts at 4 chunks and grows to 32 as acknowledgements prove the link, halving on any stall. A 32-chunk window on a 10 KB/s link is minutes of queued data before the first ACK can return.
- **No false stalls** — stall accounting is skipped while the socket is down, and the RTT-scaled stall timeout is clamped to 25 s–240 s.
- **Endless reconnect** — the client reconnects forever with a capped backoff and detects half-open sockets (which never fire `onclose`), then re-authenticates so the server can route to the new socket again.
- **Resume, don't restart** — the sender replays the handshake and the receiver keeps every chunk already on disk.
- **Transient vs fatal errors** — recoverable server conditions pause and retry the transfer instead of failing it.
- **Activity-aware server heartbeat** — a busy but slow connection is never terminated for missing a pong.

---

## Running & Building the App

The mobile application is an **Expo (managed workflow)** project using **expo-router**, located in [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile). Playback uses **`expo-video`** (`expo-av` was removed from the Expo SDK and had to be dropped).

> **Identifier note**: the app's display name is **Convey**, but the Expo `slug`, the URL `scheme` and the Android/iOS application IDs remain `videoshare` / `com.videoshare.app`. Those identifiers are what the EAS project and any installed build are keyed on, so changing them would re-link the EAS project and install as a separate app. Change them only if you intend a hard fork.

### Prerequisites
- **Node.js**: >= 22.11.0 and npm
- **Expo Go** app installed on your phone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)) — every native module used is part of the Expo SDK, so Expo Go runs the full flow

---

### Method 1: Expo Go (Fastest — no build needed)

1. Install dependencies:
   ```bash
   cd videoshare/mobile
   npm install
   ```

2. Start the Expo dev server:
   ```bash
   npx expo start
   ```

3. Scan the QR code with **Expo Go** on your phone.

---

### Method 2: EAS Build — APK / IPA (Production)

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Configure the build (config is already committed in [`eas.json`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/eas.json)):
   ```bash
   cd videoshare/mobile
   eas build:configure
   ```

3. Build for Android (installable **APK**):
   ```bash
   eas build -p android --profile preview
   ```

4. Build for iOS:
   ```bash
   eas build -p ios
   ```

> **Note**: EAS Build runs in the cloud — no Android SDK or Xcode required locally. **Any change to the app's JavaScript or native dependencies requires a fresh build**, since no OTA update channel is configured; the JS bundle is baked into the APK.

---

### Method 3: Local Development Build (Expo + native)

```bash
cd videoshare/mobile
npx expo run:android   # generates android/ and compiles — requires Android SDK
npx expo run:ios       # requires Xcode (macOS only)
```

---

## The Core Experiment: Video Over Text Transport

```
[ Original Video Binary on Device ]
          │
          ▼
[ Transfer Preparation ] (size + chunk plan + metadata fingerprint — no full read)
          │
          ▼
[ Streaming Chunk Read ] (16-128 KB at a time via a native file handle)
          │
          ▼
[ Text-Safe Encoding ] (Base64 representation: ~33% overhead)
          │
          ▼
[ Per-Chunk SHA-256 ] (Every chunk carries its own hash)
          │
          ▼
[ Receiver Storage Verification Gate ] (Real free space verified before streaming)
          │
          ▼
[ ChatTransport WebSocket ] (ACK-gated adaptive sliding window, 4 → 32 chunks)
          │
          ▼
[ Receiver Local Filesystem ] (/Convey/transfers/{transferId}/chunk_XXXXXX)
          │
          ▼
[ Per-Chunk Hash Verification ] (Corrupt chunks rejected and re-requested)
          │
          ▼
[ Streaming Reassembly ] (Native chunk-by-chunk copy; chunks deleted as consumed)
          │
          ▼
[ Final Verification ] (All chunks present + exact byte length + metadata fingerprint)
          │
          ▼
    [ Verified ] ──▶ [ Play Video ]
```

---

## Repository Structure

- [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile): React Native TypeScript application (Android-first, iOS-compatible) on Expo SDK 57
  - `app/`: `expo-router` route files (`_layout.tsx` mounts the theme provider and registers the transfer/WebSocket listeners at app start)
  - Screens:
    - [`HomeScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/HomeScreen.tsx): Glass launchpad with a hero headline, live relay/link/storage pills and two action cards ("Select File" / "Receive").
    - [`PairScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/PairScreen.tsx): Guided send flow, digit-tile pairing code display, and the receiver storage verification gate.
    - [`ChatScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/ChatScreen.tsx): Two-party private chat with inline video transfer bubbles, receipts, a transport profile selector and a keyboard-safe composer.
    - [`VideoTransferScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/VideoTransferScreen.tsx): `expo-video` playback plus real-time metrics and verification details.
  - Theme system:
    - `src/theme/`: token contract, spacing/typography tokens, the four theme definitions, and the `ThemeProvider` (system-follow + persisted selection).
    - `src/components/ui/`: design-system primitives — `GlassCard`, `GradientButton`, `ScreenHeader`, `SegmentedControl`, `Pill`, `ThemePicker`, `Icon`, `AuroraBackground`, `ProgressTrack` and friends.
  - Services:
    - [`storage.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/storage.ts): Native free/total disk reporting & transfer capacity verification.
    - [`videoTransfer.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/videoTransfer.ts): Streaming transfer engine — adaptive window, RTT-scaled timeouts, watchdog, repair, progress, link-quality reporting.
    - [`websocket.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/websocket.ts): Resilient WS client — RTT sampling, endless capped-backoff reconnect, half-open socket detection.
    - [`pairing.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/pairing.ts): 6-digit pairing, device storage metadata exchange, reconnect re-authentication.
    - [`fileSystem.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/fileSystem.ts): Chunk storage, streaming reassembly, native file handles.
    - [`hashing.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/hashing.ts): SHA-256 per-chunk verification & metadata fingerprint.
    - `prefs.ts`: Small JSON-backed preference store (theme selection).
- [`videoshare/server/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/server): Node.js + TypeScript + Express + WebSocket + MongoDB backend
  - WebSocket routing: serialized per-connection handling, in-memory transfer route cache (no DB query per chunk), acknowledgement windows, receiver storage relay, activity-aware heartbeat, transient vs fatal error tagging.
  - Automated Tests: **39 tests passing** (`npx tsx tests/test_suite.ts`).
- [`render.yaml`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/render.yaml): Render deployment configuration blueprint.

---

## Quick Start

### 1. Run the Backend Server
```bash
cd videoshare/server
npm install
npm run dev
```

### 2. Run Automated Test Suite (39 Tests Passing)
```bash
cd videoshare/server
npx tsx tests/test_suite.ts
```

### 3. Run the Mobile App
```bash
cd videoshare/mobile
npm install
npx expo start      # scan QR with the Expo Go app
```

For in-depth architecture details, the streaming/reliability design, the WebSocket protocol table and the developer roadmap, see [`videoshare/README.md`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/README.md).
