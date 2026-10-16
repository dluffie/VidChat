# Convey: Private Mobile App with Text-Transported Video

> **v1.1.0** · formerly "VideoShare"

Convey is a private mobile application designed for **exactly two paired devices**. It features a streamlined two-option pairing interface, a private glass-styled chat, and an experimental core: **transferring high-resolution video files (up to 2 GB) over our own text-based chat transport without third-party messaging services**.

The UI is built on a "liquid glass" design language — a full-screen aurora canvas behind translucent panes, gradient call-to-action buttons and a monochrome, theme-tinted icon set — and ships with **four selectable themes plus a System option** (Aurora Dark, Aurora Light, Claude Warm, Midnight).

> **Name & version**: the app was renamed from *VideoShare* to **Convey** in v1.1.0. The Expo `slug`, the URL `scheme` and the Android/iOS application IDs remain `videoshare` / `com.videoshare.app`, because those are the identifiers the EAS project and any installed build are keyed on. The on-device storage root also moved from `VideoShare/` to `Convey/`, so partial transfers staged by an older build will not resume — finish or cancel them before updating.

---

## App Design & User Workflow

When opening the app, users are presented with two primary options: **"Select File"** (Sender) and **"Receive"** (Receiver).

```
                          ┌──────────────────────────┐
                          │    Convey Launch         │
                          └─────────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
       [ ↑ Select File (Send) ]                      [ ↓ Receive Video ]
                 │                                             │
                 ▼                                             ▼
  1. Pick Video (≤ 2 GB)                          1. Enter 6-Digit Pairing Code
  2. Prepare Transfer (streaming plan):                          │
     - Read file size                            2. Device Storage Display:
     - Plan chunks (link-aware size)                - Real free space (native)
     - Metadata fingerprint (SHA-256)               - Visual Capacity Bar
       (no full-file read!)                          - Storage shared on join
                 │                                             │
                 ▼                                             │
  3. Generate 6-Figure Pairing Code                            │
  4. Wait for Receiver to Join                                 │
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                         [ 6-Figure Code Matched ]
                                        │
                                        ▼
                  [ Receiver Storage Verification Gate ]
    - Sender compares receiver's real free space vs video size
    - If Insufficient: Transfer blocked to prevent failure
    - If Sufficient: Sender clicks "Start Video Transfer"
                                        │
                                        ▼
                       [ Streaming Text Transfer ]
    - Adaptive sliding window (4 → 32 chunks), ACK-gated
    - Timeouts, chunk size and window all follow the measured RTT
    - Chunks read from disk on demand (flat memory)
                                        │
                                        ▼
                  [ Receiver Streaming Reassembly ]
    - Each chunk verified by SHA-256, then written to disk
    - Chunk-by-chunk native copy into the final file
    - Temporary chunks deleted as they are consumed
                                        │
                                        ▼
                  [ Integrity Verified -> Play Video ]
```

### 1. "Select File" Option (Sender Flow)
- **Video Selection**: Choose a real video from the gallery (up to **2 GB**) or the file picker, plus in-chat demo sizes for testing the transport.
- **Instant Transfer Preparation**: The app **does not read the file** before pairing. It only inspects the file size, derives the chunk plan, and computes a small **metadata fingerprint**. Preparation therefore takes milliseconds even for a 2 GB video.
- **6-Figure Pairing Code**: The backend creates an ephemeral 6-digit code (valid for 10 minutes) displayed as digit tiles.
- **Receiver Storage Verification**: Upon pairing, the sender receives the receiver's available storage metrics. If the receiver has sufficient free space (file size + safety margin), the sender starts the transfer. If space is insufficient, the transfer is blocked.

### 2. "Receive" Option (Receiver Flow)
- **Enter 6-Digit Code**: Large numeric input field to enter the sender's pairing code.
- **Available Storage Display**: Directly below the code input, the receiver's current available storage (e.g. `48.2 GB Free / 128.0 GB Total`) is shown alongside a visual capacity bar. This value is read directly from the native filesystem.
- **Automated Storage Reporting**: On `pair:join`, the receiver securely transmits its available disk space to the sender.
- **Transfer Reception & Reassembly**: Chunks arrive over WebSocket, are hash-verified, written to `/Convey/transfers/{transferId}/`, then streamed one by one into the final video file. The transfer is confirmed once every chunk is present and the assembled file matches the expected byte length. A dropped connection resumes from what is already on disk rather than starting over.


---

## How to Get the APK File

The mobile application is an **Expo (managed workflow) project using expo-router**, located in [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile). There is **no checked-in `android/` folder** — native projects are generated on demand, either in the cloud (EAS Build) or locally (`expo run:android`).

### Prerequisites
1. **Node.js**: Version >= 22.11.0 and npm
2. **Expo Go** for quick development runs ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))
3. *(Local builds only)* **JDK 17** and the **Android SDK** with `ANDROID_HOME` set

---

### Method 1: EAS Build — APK (Recommended)

EAS Build runs in the cloud, so no Android SDK or Xcode is needed locally.

1. Install the EAS CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Build an installable APK:
   ```bash
   cd videoshare/mobile
   eas build -p android --profile preview
   ```

   The `preview` profile is configured in [`eas.json`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/eas.json) as an internal-distribution **APK**; `production` produces a Play Store **app bundle**.

3. Download the resulting `.apk` from the link EAS prints and install it on the device (enable "Install from unknown sources").

> **Important**: Always rebuild after changing native dependencies (e.g. adding or removing an `expo-*` package). JavaScript-only edits are also baked into the bundle, so a fresh build is required to distribute them.

---

### Method 2: Expo Go (Fastest for development)

1. Install dependencies and start the dev server:
   ```bash
   cd videoshare/mobile
   npm install
   npx expo start
   ```
2. Scan the QR code with the **Expo Go** app.

All native modules used by this app (`expo-video`, `expo-file-system`, `expo-image-picker`, `expo-document-picker`) ship inside the Expo SDK, so Expo Go can run the full transfer flow.

---

### Method 3: Local Development Build

```bash
cd videoshare/mobile
npx expo run:android   # generates android/ and compiles — requires the Android SDK
npx expo run:ios       # requires Xcode (macOS only)
```

---

## The Core Experiment

Instead of relying on third-party services (WhatsApp, Telegram, SMS) or direct binary uploads to a cloud bucket, Convey proves that video can be transported through a lightweight, text-oriented messaging protocol:

```
[ Original Video Binary on Device ]
          │
          ▼
[ Transfer Preparation ] (stat + chunk plan + metadata fingerprint — no full read)
          │
          ▼
[ Streaming Chunk Read ] (16-128 KB read from disk at a time via a native file handle)
          │
          ▼
[ Text-Safe Encoding ] (Base64 representation: ~33% overhead)
          │
          ▼
[ Per-Chunk SHA-256 ] (Each chunk carries its own hash)
          │
          ▼
[ Receiver Storage Verification Gate ] (Real free space checked before streaming)
          │
          ▼
[ ChatTransport WebSocket ] (ACK-gated adaptive sliding window, 4 → 32 chunks in flight)
          │
          ▼
[ Receiver Local Filesystem ] (/Convey/transfers/{transferId}/chunk_XXXXXX)
          │
          ▼
[ Per-Chunk Hash Verification ] (Corrupt chunks are rejected and re-requested)
          │
          ▼
[ Streaming Reassembly ] (Chunk-by-chunk native copy; chunks deleted as consumed)
          │
          ▼
[ Final Verification ] (All chunks present + exact byte length + metadata fingerprint)
          │
          ▼
    [ Verified ] -> [ Play Video ]
```

> **Important Distinction**: Base64 is **not compression**; it is an encoding mechanism that increases payload size by ~33%. Convey clearly isolates binary-to-text encoding from compression.

---

## Architecture & Tech Stack

### 1. Mobile Client (`mobile/`)
- **Framework**: React Native 0.86 + TypeScript on **Expo SDK 57** (Android-first, iOS-compatible)
- **Routing**: `expo-router` (typed routes) with thin route files in `app/`
- **State Management**: Zustand (`chatStore`, `connectionStore`, `transferStore`)
- **Theming**: A runtime theme system (`src/theme/`) with **four selectable themes plus a "System" option** — *Aurora Dark*, *Aurora Light*, *Claude Warm* and *Midnight*. Every colour lives in a token object; screens consume it through `useTheme()`, and the choice is persisted to `prefs.json`. Gradients come from `expo-linear-gradient`.
- **Design language**: "Liquid glass" — a full-screen aurora canvas (gradient wash plus soft light blooms) behind translucent panes with hairline borders, top-edge specular highlights and coloured glows. Primitives live in `src/components/ui/` (`GlassCard`, `GradientButton`, `ScreenHeader`, `SegmentedControl`, `Pill`, `ThemePicker`, `Icon`, `ProgressTrack`).
- **Iconography**: A single monochrome icon set (`src/components/ui/Icon.tsx`) that inherits the active theme colour. There is **no emoji anywhere in the interface**; shapes without a dependable system glyph are drawn from plain views, and the only glyphs used are ASCII/Basic-Latin (`→`, `×`, `+`, `↑`, `↓`).
- **Keyboard handling**: Screens with a text field use `KeyboardAvoidingView` with `behavior="padding"` on both platforms (see *Keyboard-Safe Inputs* below). Because the component measures the overlap against its own frame, this is self-correcting on any device where the window still resizes natively.
- **Video Playback**: **`expo-video`** (`useVideoPlayer` / `VideoView`)
- **Storage Management**: `StorageService` reads `Paths.availableDiskSpace` / `Paths.totalDiskSpace` from `expo-file-system`
- **Filesystem**: `expo-file-system` — base64 chunk writes on receive, and native `File` / `FileHandle` random access for streaming reads, appends and deletes
- **Hashing**: SHA-256 per chunk and a metadata fingerprint (`crypto-js`)
- **UI Components & Screens**:
  - `HomeScreen`: Glass launchpad with a hero headline, live relay/link/storage pills, and two action cards ("Select File" / "Receive")
  - `PairScreen`: Guided 3-step send flow (choose → prepare → share code), pairing code display, and the receiver storage verification gate
  - `ChatScreen`: Glass header with peer presence, unified message + transfer feed, a keyboard-safe composer, and a test-video sheet with an editable file name and a **transport profile selector** (Auto / Fast / Balanced / Data saver)
  - `VideoBubble`: Transfer card with real-time percentage, byte counters, speed, ETA, cancel/resume and a "Verified" state
  - `VideoTransferScreen`: Playback plus transport metrics and the integrity fingerprint
  - `ProgressBar` / `PairCode` / `SafeScreen`: gradient progress meter, digit-tile pairing code, aurora screen shell

> **Migration note**: the app previously used `expo-av`. That package was **removed from the Expo SDK in v54+**; leaving it in `package.json` autolinked stale native code into the APK and crashed it on launch. Playback is now handled by `expo-video`.


### 2. Backend Server (`server/`)
- **Runtime**: Node.js + TypeScript + Express
- **Real-time Communication**: WebSocket (`ws`) attached to the HTTP server at `/ws`
- **Validation**: Zod schema validation for all client events
- **Database**: MongoDB + Mongoose (`PairSessions`, `Messages`, `Transfers`)
- **Deployment**: Render-ready (`render.yaml`, `0.0.0.0`, dynamic port mapping, health check `GET /health`)
- **Low RAM Constraint**: The server acts strictly as an authenticator, message router, and metadata store. **Zero binary videos and zero Base64 chunks are retained in server RAM or MongoDB.**
- **Pass-through relay**: Chunks are forwarded as they arrive. The server does **not** buffer, so a receiver that is not listening has no way to recover a missed chunk — the client-side watchdog handles repair.

---

## Streaming & Reliability Design

This is the part that makes multi-gigabyte transfers viable on a phone.

### Sender
1. **`preProcessVideo()`** never loads the file. It resolves a local `file://` path (copying once out of a `content://` URI if needed), reads the size, and derives `totalChunks`.
2. **`pump()`** fills an **adaptive sliding window** that starts at 4 chunks and grows to a ceiling of 32 (~2 MB at 64 KB/chunk) as acknowledgements prove the link can take it. Only 4 chunks are encoded per event-loop tick, then it yields, so the UI never freezes.
3. Each chunk is read straight off disk with `handle.offset = start; handle.readBytes(chunkSize)`, base64-encoded, hashed, and sent.
4. **ACK-driven flow control**: window slots only free up when the receiver acknowledges. `ws` never queues `video:chunk` frames — if the socket is closed the chunk is simply retried later.
5. **Watchdog** (2 s sweep): if no ACK arrives within `max(25 s, 6 × measured RTT)` the in-flight chunks are re-read from disk and retransmitted, and the window is **halved** (a stall means we were pushing harder than the link could take). After 8 stalled rounds the transfer fails with a clear message rather than hanging forever.

### Receiver
1. `video:start` registers the transfer **synchronously, before any `await`** — a chunk arriving in the same burst can otherwise be dropped (there is no server buffering).
2. A **repeated** `video:start` is idempotent: it keeps everything already on disk so a reconnect resumes instead of restarting a multi-gigabyte transfer.
3. Every chunk's SHA-256 is verified against the sender's hash **before** it is accepted. Corrupt chunks are rejected and re-requested.
4. Received index tracking is an in-memory `Set` — no directory scan per chunk.
5. **Watchdog**: after `max(12 s, 4 × RTT)` without new chunks it computes the missing index list and asks the sender to resend. The request is capped by **bytes** (~3 MB worth of indices), not by a fixed chunk count, so the repair payload stays sane at any chunk size.
6. On completion it streams the chunks into the final file through a **native `FileHandle`**, deleting each chunk immediately after it is copied. **Peak memory = one chunk. Peak disk ≈ one copy of the video** (not two).

### Working on a bad connection (2G / EDGE / flaky Wi-Fi)

This was the app's weakest area and is now designed for explicitly. A fixed timeout cannot serve both Wi-Fi (RTT ~50 ms) and 2G (RTT of several seconds at ~10 KB/s), so **every timing decision is derived from a measured round-trip time**:

- **RTT measurement.** The client pings every 15 s and smooths the pong latency into an EWMA. Each chunk is also timestamped at hand-off, so the ACK latency — which includes the time the frame spent queued behind the rest of the window — feeds back into the estimate. The result is a measurement of *how congested the link actually is*, not just raw latency.
- **Link-aware chunk sizing.** `recommendedChunkSize()` picks 128 KB / 64 KB / 32 KB / **16 KB** from the measured RTT. On 2G a 16 KB chunk becomes a ~22 KB frame that completes in a couple of seconds; an 87 KB frame would take ~9 s and be thrown away entirely if the connection dropped mid-frame.
- **Adaptive window.** Starts small (4) and grows by one every 6 acknowledgements, halving on any stall. A 32-chunk window on a 10 KB/s link is two minutes of queued data before the first ACK can even return — the old fixed window was the direct cause of false stalls.
- **No false stalls.** The watchdog skips stall accounting entirely while the socket is down (a blip is not a stall), and the confirm timeout for a fully-ACKed transfer was raised to an hour.
- **Never gives up reconnecting.** The client reconnects forever with a capped 15 s backoff instead of stopping after 10 attempts, and it detects **half-open sockets** (which never fire `onclose`, a classic 2G failure) by force-rebuilding the connection when pongs stop.
- **Re-authentication on reconnect.** The server only knows which socket belongs to which device after it sees `auth` on *that* socket, so the client re-runs `authenticateActiveSession()` on every reconnect. Without it, a single dropped connection left both peers online but unroutable, and a running transfer would stall silently.
- **Resume, don't restart.** On reconnect the sender replays `video:start` (re-establishing server routing even across a server restart) and resets its stall counters; the receiver re-requests whatever is missing. The receiver's idempotent `video:start` handler keeps existing chunks.
- **Transient vs fatal errors.** The server tags recoverable conditions (`PEER_OFFLINE`, `TRANSFER_NOT_FOUND`, `REGISTER_FAILED`) with `fatal: false`. The client pauses and retries instead of failing the transfer; `TRANSFER_NOT_FOUND` also triggers an automatic `video:start` replay.
- **Silent chunk drops.** When the receiver's socket is momentarily gone, the server drops the chunk **without** emitting an error. An error per dropped chunk would flood a 2G uplink and turn a brief blip into a failed transfer; the sender's watchdog notices and the receiver re-requests what it missed.
- **Server heartbeat that respects busy sockets.** The server pings every 30 s but only terminates a connection that is *both* unanswered *and* completely silent for 120 s. A phone pushing a multi-gigabyte transfer over 2G can easily take longer than one ping interval to return the pong — the old 30 s heartbeat was killing healthy transfers.

### Integrity Model
A whole-file SHA-256 over a 2 GB video cannot be computed on-device without either buffering the whole file or re-reading it end-to-end before the transfer may begin, so integrity is guaranteed **per chunk** instead:

- Every chunk carries its own SHA-256; the receiver verifies it before accepting.
- Anything unverified is re-requested until it arrives intact.
- Final verification checks that **all chunks were received**, that the assembled file is **exactly `fileSize` bytes**, and that both sides agree on a **metadata fingerprint** (`SHA-256(fileName|fileSize|totalChunks|chunkSize)`).

This covers every byte of the file and is equivalent to an end-to-end hash for tamper/corruption detection.

### Performance Notes
- Base64 encoding uses a batched code-buffer encoder (`String.fromCharCode` in 4096-char flushes) rather than per-character string concatenation; decoding on receive is done natively by `expo-file-system`.
- Throughput is roughly `window × chunkSize / RTT`. The window now adapts, so a good link converges towards 32 × chunk size while a poor one settles at whatever it can actually sustain.
- The Mongo-per-chunk bottleneck that previously capped throughput at ~425 KB/s has been removed server-side (see below).
- A 1 MB transfer over a working connection completes in well under a second; multi-gigabyte transfers are network-bound, not CPU-bound.


---

## Project Structure

```
videoshare/
├── mobile/                              # Expo SDK 57, managed workflow, expo-router
│   ├── app/                             # File-based routes
│   │   ├── _layout.tsx                  # Root layout — registers WS listeners at app start
│   │   ├── index.tsx                    # Launch route
│   │   ├── pair.tsx                     # Pairing route
│   │   ├── chat.tsx                     # Chat route
│   │   └── videotransfer.tsx            # Playback route
│   ├── assets/                          # icon.png, splash-icon.png, adaptive-icon.png, favicon.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatBubble.tsx           # Glass message bubble with status ticks
│   │   │   ├── VideoBubble.tsx          # Inline transfer card with progress, play, cancel
│   │   │   ├── ProgressBar.tsx          # Gradient progress meter with speed & ETA
│   │   │   ├── PairCode.tsx             # Digit-tile pairing code
│   │   │   ├── SafeScreen.tsx           # Aurora canvas + safe-area shell
│   │   │   └── ui/                      # Design-system primitives
│   │   │       ├── AuroraBackground.tsx # Gradient wash + soft light blooms
│   │   │       ├── GlassCard.tsx        # Translucent pane, hairline border, sheen, glow
│   │   │       ├── GradientButton.tsx   # Primary / ghost / subtle / warm / danger buttons
│   │   │       ├── Icon.tsx             # Monochrome icon set (theme-tinted, no emoji)
│   │   │       ├── Pill.tsx             # Status chips
│   │   │       ├── Primitives.tsx       # SectionLabel, InfoRow, Divider, ProgressTrack
│   │   │       ├── ScreenHeader.tsx     # Header + circular glass icon button
│   │   │       ├── SegmentedControl.tsx # Glass segmented control
│   │   │       └── ThemePicker.tsx      # Appearance bottom sheet
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx           # Hero launchpad: Send vs Receive
│   │   │   ├── PairScreen.tsx           # Guided prepare flow, code display & storage gate
│   │   │   ├── ChatScreen.tsx           # Chat + transfers, transport profile selector
│   │   │   └── VideoTransferScreen.tsx  # expo-video playback & transport metrics
│   │   ├── services/
│   │   │   ├── api.ts                   # REST API & health check
│   │   │   ├── websocket.ts             # WS client: RTT sampling, endless reconnect, dead-socket detection
│   │   │   ├── pairing.ts               # Pairing state, session auth, reconnect re-auth
│   │   │   ├── storage.ts               # Native free/total space & transfer gate
│   │   │   ├── messages.ts              # Text chat service
│   │   │   ├── videoTransfer.ts         # Streaming engine: adaptive window, RTT timeouts, repair
│   │   │   ├── fileSystem.ts            # Chunk storage, streaming reassembly, file handles
│   │   │   ├── hashing.ts               # SHA-256 & metadata fingerprint
│   │   │   └── prefs.ts                 # JSON preference store (theme selection)
│   │   ├── theme/
│   │   │   ├── types.ts                 # Theme contract
│   │   │   ├── tokens.ts                # Spacing, radii, typography, elevation, glow
│   │   │   ├── themes.ts                # Aurora Dark/Light, Claude Warm, Midnight
│   │   │   ├── ThemeProvider.tsx        # Context, system-follow, persistence
│   │   │   └── index.ts                 # Barrel
│   │   ├── store/
│   │   │   ├── chatStore.ts             # Zustand store for chat messages
│   │   │   ├── connectionStore.ts       # WebSocket & peer status store
│   │   │   └── transferStore.ts         # Active video transfers & metrics
│   │   ├── types/
│   │   │   ├── messages.ts              # ChatMessage, MessageStatus
│   │   │   ├── pairing.ts               # PairingState, DeviceStorageInfo, PairCreateResponse
│   │   │   └── transfers.ts             # VideoTransferMeta, VideoChunk, TransferMetrics
│   │   └── utils/
│   │       ├── chunking.ts              # Chunk sizes, total chunks, ETA & speed formatting
│   │       ├── encoding.ts              # High-throughput Uint8Array <-> Base64
│   │       ├── polyfills.ts             # crypto polyfill for uuid on Hermes
│   │       └── routeMap.ts              # Typed route helpers
│   ├── app.json                         # Expo config (plugins, permissions, icons)
│   ├── eas.json                         # preview = APK, production = app bundle
│   ├── metro.config.js
│   ├── babel.config.js
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   └── index.ts                 # Environment variables & defaults
│   │   ├── models/
│   │   │   ├── PairSession.ts           # 6-digit pairing session & device auth
│   │   │   ├── Message.ts               # Text messages & delivery statuses
│   │   │   └── Transfer.ts              # Video metadata & completion tracking
│   │   ├── routes/
│   │   │   ├── health.ts                # GET /health -> { status, database, uptimeSeconds }
│   │   │   └── api.ts                   # REST endpoints for message history & transfers
│   │   ├── services/
│   │   │   ├── pairingService.ts        # 6-digit code generator & auth validation
│   │   │   ├── messageService.ts        # Message persistence & offline catchup
│   │   │   └── transferService.ts       # Transfer metadata tracking
│   │   ├── websocket/
│   │   │   ├── schemas.ts               # Zod schemas (pairing, storage, video:*)
│   │   │   └── wsManager.ts             # Serialized router, in-memory transfer routes
│   │   ├── app.ts                       # Express app with Helmet, CORS & JSON limits
│   │   └── server.ts                    # Bootstrap server with MongoDB & WebSocket
│   ├── tests/
│   │   └── test_suite.ts               # 39 standalone transport/verification tests
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── render.yaml                          # Render deployment blueprint
└── README.md                            # This file
```

---

## Quick Start Guide

### 1. Run the Backend Server Locally

```bash
cd videoshare/server
npm install
npm run dev
```

The server will start listening at:
- **HTTP**: `http://localhost:3000`
- **Health check**: `http://localhost:3000/health` → `{ "status": "ok", "database": "connected", "uptimeSeconds": 12 }`
- **WebSocket**: `ws://localhost:3000/ws`

A MongoDB connection is required (set `MONGODB_URI` in `.env`).

### 2. Run Automated Test Suite

```bash
cd videoshare/server
npx tsx tests/test_suite.ts
```

Output:
```
====================================================
TEST SUMMARY: 39 PASSED, 0 FAILED
====================================================
```

> The suite is self-contained (no database or server needed): it exercises the pairing, chunking, encoding, hash-verification, corruption-rejection, resume, cancellation and storage-gate logic directly.

### 3. Run the Mobile App

```bash
cd videoshare/mobile
npm install
npx expo start          # scan the QR code with Expo Go
```

> **Any change to the app's JavaScript requires a fresh APK.** This project has no OTA update channel configured, so the JS bundle is baked into the build — including a pure styling change. Adding `expo-linear-gradient` (used for the aurora canvas and gradient buttons) is likewise picked up by the next build; it is a first-party Expo SDK module, so no extra native configuration is needed.

### 4. Type-check

```bash
cd videoshare/mobile  && npx tsc --noEmit
cd videoshare/server  && npx tsc --noEmit && npm run build
```

---

## WebSocket Event Protocol

| Action | Direction | Payload Description |
|---|---|---|
| `pair:create` | Client → Server | `{ deviceId }` |
| `pair:created` | Server → Client | `{ sessionId, pairingCode, expiresAt, sessionToken }` |
| `pair:join` | Client → Server | `{ deviceId, pairingCode, storage: { freeBytes, totalBytes, freeFormatted } }` |
| `pair:success` | Server → Client | `{ sessionId, deviceA, deviceB, sessionToken, role, receiverStorage? }` |
| `storage:info` | Bidirectional | `{ sessionId, senderDeviceId, storage: { freeBytes, freeFormatted } }` |
| `auth` | Client → Server | `{ sessionId, sessionToken, deviceId }` |
| `auth:success` | Server → Client | `{ sessionId, partnerDeviceId, partnerOnline }` |
| `message:send` | Client → Server | `{ messageId, sessionId, senderDeviceId, text, timestamp }` |
| `message:new` | Server → Client | Routed to partner with status `DELIVERED` |
| `message:read` | Client → Server | `{ sessionId, deviceId, messageIds }` |
| `video:start` | Client → Server | `{ transferId, fileName, fileSize, mimeType, totalChunks, chunkSize, encoding, checksum }` |
| `video:chunk` | Client → Server | `{ transferId, chunkIndex, totalChunks, data, hash }` (~22 KB frame at 16 KB chunks, ~87 KB at 64 KB) |
| `video:ack` | Client → Server | `{ transferId, chunkIndex, status: "received" }` |
| `video:request_missing` | Client → Server | `{ transferId, missingIndices: number[] }` (resume / repair) |
| `video:complete` | Client → Server | `{ transferId, checksumVerified: boolean }` |
| `video:cancel` | Client → Server | `{ transferId, reason }` |
| `video:error` | Server → Client | `{ transferId, error, code?, fatal? }` — `fatal: false` means retryable (paused, not failed) |
| `peer:status` | Server → Client | `{ status: "online" \| "offline", peerDeviceId }` |
| `ping` / `pong` | Bidirectional | Client pings every 15 s; server pings every 30 s |

**Server-side routing**
- Messages from a single connection are **serialized** through a promise chain, so a `video:chunk` can never be processed before its `video:start`.
- `video:start` populates an **in-memory transfer route cache** (`transferId → { sender, receiver }`), removed on `video:complete` / `video:cancel`. Chunk, ack, repair and completion messages resolve their destination from that cache instead of a MongoDB round trip per chunk.
- If persisting `video:start` fails, the server emits a **retryable** `video:error` (`fatal: false`) instead of failing the transfer.
- If the receiver's socket is not open, a `video:chunk` is **dropped silently** rather than answered with an error. The sender's watchdog backs off and the receiver re-requests what it missed — an error per dropped chunk would flood a slow uplink.
- A connection is only terminated by the heartbeat when it is **both** unanswered **and** has had no inbound frame for 120 s, so a busy but slow transfer is never killed.


---

## Experimental Metrics

For every video transfer, Convey measures:
1. **Original Binary Size**: (e.g., 12.5 MB = 13,107,200 bytes)
2. **Encoded Size**: (e.g., ~16.6 MB Base64 representation)
3. **Representation Ratio**: 1.33x (~33% expansion overhead)
4. **Number of Chunks**: derived from the link-aware chunk size (e.g. 200 chunks of 64 KB; 32,768 chunks for 2 GB at 64 KB, or 131,072 at 16 KB)
5. **Transfer Time & Average Speed**: derived from live ACK timing
6. **Retransmitted Data**: tracks resends triggered by the watchdog / repair requests
7. **Integrity Result**: per-chunk SHA-256 verification plus the final metadata-fingerprint and byte-length check
8. **Live Link Quality**: round-trip time and the current congestion window, surfaced in the Home, Chat and test-video screens


---

## What We Have Done

- [x] **Backend Architecture**: Node.js + Express + WebSocket + MongoDB + Mongoose + Zod + Helmet + CORS.
- [x] **Renamed to "Convey" (v1.1.0)**: Display name, on-device storage root (`Convey/`) and all user-facing copy updated. Build identifiers (`slug`, `scheme`, `com.videoshare.app`) are deliberately unchanged so the EAS project and existing installs stay linked.
- [x] **Keyboard-Safe Inputs**: Every text field — the chat composer, the test-video file-name field and the pairing-code input — now uses `KeyboardAvoidingView` with `behavior="padding"` on **Android as well as iOS**. Since edge-to-edge became the default in Expo SDK 53+, Android no longer honours `adjustResize`, so the previous Android-specific "no avoidance" branch left inputs hidden behind the keyboard.
- [x] **Emoji-Free Icon Set**: Every colour emoji and dingbat glyph was removed and replaced by a single monochrome, theme-tinted `Icon` component. Geometric shapes (chevrons, checkmark, clock, play triangle, lock, signal bars, framed video glyph, half-filled theme control, refresh arc, database stack) are drawn from plain views, so nothing depends on a font glyph or an emoji fallback font.
- [x] **Complete UI Redesign ("liquid glass")**: Aurora canvas, translucent glass panes, gradient CTAs and a monochrome icon set replacing colour emoji — applied to every screen.
- [x] **Multi-Theme System**: Four selectable themes (*Aurora Dark*, *Aurora Light*, *Claude Warm*, *Midnight*) plus a **System** option that follows the device, with an in-app appearance picker and persisted selection.
- [x] **Low-Connection Support (2G / EDGE / flaky Wi-Fi)**: RTT-aware timeouts, adaptive chunk sizing (down to 16 KB), adaptive congestion window, half-open socket detection, endless capped-backoff reconnects and automatic re-authentication.
- [x] **Two-Option App Design**: Hero landing screen with "Select File" and "Receive" cards, live relay/link/storage status pills.
- [x] **Streaming Transfer Engine (up to 2 GB)**: Chunks are read from disk on demand and never buffered in memory. Peak memory is a single chunk on both sides.
- [x] **Adaptive ACK-Gated Sliding Window**: Starts at 4 chunks, grows to 32 (~2 MB) as the link proves itself, halves on every stall, with batched encoding that yields to the UI.
- [x] **Watchdog Recovery**: Stalled in-flight chunks are retransmitted; missing chunks are re-requested; both sides self-heal across brief disconnects and resume rather than restart.
- [x] **Transient vs Fatal Error Handling**: Recoverable server conditions are tagged `fatal: false` and pause/retry the transfer instead of ending it.
- [x] **6-Digit Pairing System**: Ephemeral 6-digit codes (10 mins), automatic invalidation, secure token generation.
- [x] **Real Storage Reporting**: `expo-file-system` `Paths.availableDiskSpace` / `totalDiskSpace` replace deprecated calls that fabricated a fake "24.5 GB".
- [x] **Receiver Storage Verification Gate**: Receiver transmits disk space upon pairing; sender verifies sufficient capacity before initiating transfer.
- [x] **Low RAM Server Compliance**: Zero video bytes buffered in server RAM or MongoDB.
- [x] **Filesystem Chunk Storage on Receiver**: Temporary `/Convey/transfers/{transferId}/chunk_XXXXXX` writing.
- [x] **Streaming Reassembly**: Chunks are copied through a native file handle and deleted as they are consumed, halving peak disk usage.
- [x] **Per-Chunk Integrity Verification**: Every chunk's SHA-256 is checked before acceptance; corrupt chunks are rejected and re-requested.
- [x] **Removed `expo-av`**: Replaced with `expo-video` after `expo-av` was dropped from the Expo SDK, fixing a native crash on launch in built APKs.
- [x] **Server Message Ordering & Route Caching**: Serialized per-connection handling plus an in-memory transfer route cache (no MongoDB query per chunk).
- [x] **Activity-Aware Server Heartbeat**: A busy-but-slow connection is never terminated for missing a pong.
- [x] **Glass Chat**: SENDING, SENT, DELIVERED, READ statuses, real-time message routing, unified message + transfer feed.
- [x] **39 Automated Tests Passing**: Pairing, wrong code, expired code, message delivery, offline queuing, 1 MB chunking, 10 MB simulation, corrupted chunk rejection, resume, cancellation and storage verification gates.
- [x] **APK Build Pipeline Documented**: Step-by-step EAS Build instructions for APK and app-bundle output.

---

## What Is Left To Do (Roadmap for Future AI Agents & Developers)

1. **Native FFmpeg Compression Integration**:
   - Integrate `ffmpeg-kit-react-native` to run pre-encoding compression (e.g. H.264/H.265 CRF 28) before chunking, allowing users to choose between "Original Quality" and "Compressed". This is the single biggest win for large files.
2. **Real Backdrop Blur**:
   - The glass look is currently built from layered translucency, gradients and soft light blooms rather than a genuine backdrop blur. `expo-blur` was deliberately not used: on Android 11 (below the RenderEffect threshold) it falls back to an experimental path that is both slower and less predictable, and this app targets low-end devices. Revisit once the minimum Android version is 12+, or gate it behind a device-capability check.
3. **Android Foreground Service**:
   - Add a native Android Foreground Service with notification progress so long transfers continue uninterrupted if the user switches apps or the screen locks.
4. **Wire-Format Upgrade (binary frames)**:
   - `video:chunk` currently carries Base64 text (~33% overhead) and the sender must base64-encode each chunk in JS. Streaming raw binary frames over the WebSocket would remove both the bandwidth cost and the encode/decode CPU — a significant win on 2G. A protocol version negotiation would be needed for compatibility.
5. **Source File Staging**:
   - `expo-image-picker` hands back a file inside the app **cache**. Android may reclaim cache under memory pressure, which would break a very long send. Staging the file into the documents directory first removes that risk at the cost of extra sender disk space.
6. **iOS Background Processing & APNs Wakeup**:
   - Implement silent VoIP/Background push notifications via Apple Push Notification service to wake the paired device when a new transfer begins.
7. **Optional WebRTC Peer-to-Peer DataChannel Sidecar**:
   - Allow paired devices on the same local Wi-Fi to establish a direct P2P text data channel as a fallback or high-speed local mode. This would require adding STUN/TURN configuration (there is none today) and a signalling path through the existing `/ws` server.
8. **Parallel / Multi-Stream Transfers (fast links only)**:
   - Today a single ordered stream carries every chunk. On a strong 4G/5G link the limiting factor is no longer bandwidth but the **single WebSocket's serialised send path and the round-trip cost of the ACK window** — throughput is roughly `window × chunkSize / RTT`, so latency, not bandwidth, caps it. Opening 2–4 parallel `video:chunk` streams (interleaved index ranges) would hide that latency and could approach a linear speed-up on a clean link.
   - The reason it is *not* implemented yet is that it is a poor fit for the app's stated goal: on 2G/EDGE extra streams make congestion **worse** (they compete for the same tiny uplink and amplify loss), and the relay would need per-stream ordering, larger receive buffers and a more complex repair/resume path. It should be **opt-in and gated on the measured RTT** (e.g. enable only when RTT < 150 ms and the adaptive window is already at its 32-chunk ceiling), with a hard cap of ~4 streams and the same per-chunk hashing so integrity is unchanged.

