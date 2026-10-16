# VideoShare: Private Mobile App with Text-Transported Video

VideoShare is a private mobile application designed for **exactly two paired devices**. It features a streamlined two-option pairing interface, a WhatsApp-style private chat, and an experimental core: **transferring high-resolution video files (up to 2 GB) over our own text-based chat transport without third-party messaging services**.

---

## 📱 App Design & User Workflow

When opening the app, users are presented with two primary options: **"Select File"** (Sender) and **"Receive"** (Receiver).

```
                          ┌──────────────────────────┐
                          │    VideoShare Launch     │
                          └─────────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
       [ 🎬 Select File (Send) ]                     [ 📥 Receive Video ]
                 │                                             │
                 ▼                                             ▼
  1. Pick Video (≤ 2 GB)                          1. Enter 6-Digit Pairing Code
  2. Prepare Transfer (streaming plan):                          │
     - Read file size                            2. Device Storage Display:
     - Compute chunk plan (64 KB chunks)            - Real free space (native)
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
                  [ 🛡️ Receiver Storage Verification Gate ]
    - Sender compares receiver's real free space vs video size
    - If Insufficient: Transfer blocked to prevent failure
    - If Sufficient: Sender clicks "Start Video Transfer"
                                        │
                                        ▼
                       [ Streaming Text Transfer ]
    - Sliding window (32 chunks ≈ 2 MB in flight), ACK-gated
    - Chunks read from disk on demand (flat memory)
                                        │
                                        ▼
                  [ Receiver Streaming Reassembly ]
    - Each chunk verified by SHA-256, then written to disk
    - Chunk-by-chunk native copy into the final file
    - Temporary chunks deleted as they are consumed
                                        │
                                        ▼
                  [ Integrity Verified ✓ ──▶ Play Video ]
```

### 1. "Select File" Option (Sender Flow)
- **Video Selection**: Choose a real video from the gallery (up to **2 GB**) or the file picker, plus in-chat demo sizes for testing the transport.
- **Instant Transfer Preparation**: The app **does not read the file** before pairing. It only inspects the file size, derives the chunk plan, and computes a small **metadata fingerprint**. Preparation therefore takes milliseconds even for a 2 GB video.
- **6-Figure Pairing Code**: The backend creates an ephemeral 6-digit code (valid for 10 minutes) displayed with a countdown timer.
- **Receiver Storage Verification**: Upon pairing, the sender receives the receiver's available storage metrics. If the receiver has sufficient free space (file size + safety margin), the sender clicks **"Start Video Transfer"**. If space is insufficient, the transfer is blocked.

### 2. "Receive" Option (Receiver Flow)
- **Enter 6-Digit Code**: Large numeric input field to enter the sender's pairing code.
- **Available Storage Display**: Directly below the code input, the receiver's current available storage (e.g. `48.2 GB Free / 128.0 GB Total`) is shown alongside a visual capacity bar. This value is read directly from the native filesystem.
- **Automated Storage Reporting**: On `pair:join`, the receiver securely transmits its available disk space to the sender.
- **Transfer Reception & Reassembly**: Chunks arrive over WebSocket, are hash-verified, written to `/VideoShare/transfers/{transferId}/`, then streamed one by one into the final video file. The transfer is confirmed once every chunk is present and the assembled file matches the expected byte length.

---

## 📦 How to Get the APK File

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

## 🎯 The Core Experiment

Instead of relying on third-party services (WhatsApp, Telegram, SMS) or direct binary uploads to a cloud bucket, VideoShare proves that video can be transported through a lightweight, text-oriented messaging protocol:

```
[ Original Video Binary on Device ]
          │
          ▼
[ Transfer Preparation ] (stat + chunk plan + metadata fingerprint — no full read)
          │
          ▼
[ Streaming Chunk Read ] (64 KB read from disk at a time via a native file handle)
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
[ ChatTransport WebSocket ] (ACK-gated sliding window, 32 chunks in flight)
          │
          ▼
[ Receiver Local Filesystem ] (/VideoShare/transfers/{transferId}/chunk_XXXXXX)
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
    [ Verified ✓ ] ──▶ [ ▶ Play Video ]
```

> **Important Distinction**: Base64 is **not compression**; it is an encoding mechanism that increases payload size by ~33%. VideoShare clearly isolates binary-to-text encoding from compression.

---

## 🏗 Architecture & Tech Stack

### 1. Mobile Client (`mobile/`)
- **Framework**: React Native 0.86 + TypeScript on **Expo SDK 57** (Android-first, iOS-compatible)
- **Routing**: `expo-router` (typed routes) with thin route files in `app/`
- **State Management**: Zustand (`chatStore`, `connectionStore`, `transferStore`)
- **Video Playback**: **`expo-video`** (`useVideoPlayer` / `VideoView`)
- **Storage Management**: `StorageService` reads `Paths.availableDiskSpace` / `Paths.totalDiskSpace` from `expo-file-system`
- **Filesystem**: `expo-file-system` — base64 chunk writes on receive, and native `File` / `FileHandle` random access for streaming reads, appends and deletes
- **Hashing**: SHA-256 per chunk and a metadata fingerprint (`crypto-js`)
- **UI Components & Screens**:
  - `HomeScreen`: Two-option launchpad ("Select File" and "Receive") with device storage status
  - `PairScreen`: Transfer preparation, 6-figure pairing code display, available storage display, and receiver storage verification gate
  - `ChatScreen`: WhatsApp-style bubbles with delivery receipts (`SENT` ✓, `DELIVERED` ✓✓, `READ` ✓✓ blue) plus the in-chat test-video modal
  - `VideoBubble`: Dynamic transfer card with real-time percentage, byte counters, speed (MB/s), ETA, and "Verified ✓" badge
  - `VideoTransferScreen`: Video playback & experimental metrics
  - `ProgressBar` / `PairCode` / `SafeScreen`: progress indicator, 6-digit code with expiry timer, safe-area wrapper

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

## 🔄 Streaming & Reliability Design

This is the part that makes multi-gigabyte transfers viable on a phone.

### Sender
1. **`preProcessVideo()`** never loads the file. It resolves a local `file://` path (copying once out of a `content://` URI if needed), reads the size, and derives `totalChunks`.
2. **`pump()`** fills a **32-chunk sliding window** (~2 MB at 64 KB/chunk). Only 4 chunks are encoded per event-loop tick, then it yields, so the UI never freezes.
3. Each chunk is read straight off disk with `handle.offset = start; handle.readBytes(64 KB)`, base64-encoded, hashed, and sent.
4. **ACK-driven flow control**: window slots only free up when the receiver acknowledges. `ws` never queues `video:chunk` frames — if the socket is closed the chunk is simply retried later.
5. **Watchdog** (2 s sweep): if no ACK arrives for 6 s, in-flight chunks are re-read from disk and retransmitted. After 6 stalled rounds the transfer fails with a clear message rather than hanging forever.

### Receiver
1. `video:start` registers the transfer **synchronously, before any `await`** — a chunk arriving in the same burst can otherwise be dropped (there is no server buffering).
2. Every chunk's SHA-256 is verified against the sender's hash **before** it is accepted. Corrupt chunks are rejected and re-requested.
3. Received index tracking is an in-memory `Set` — no directory scan per chunk.
4. **Watchdog**: after 4 s without new chunks it computes the missing index list (capped at 2000 per request) and asks the sender to resend.
5. On completion it streams the chunks into the final file through a **native `FileHandle`**, deleting each chunk immediately after it is copied. **Peak memory = one 64 KB chunk. Peak disk ≈ one copy of the video** (not two).

### Integrity Model
A whole-file SHA-256 over a 2 GB video cannot be computed on-device without either buffering the whole file or re-reading it end-to-end before the transfer may begin, so integrity is guaranteed **per chunk** instead:

- Every 64 KB chunk carries its own SHA-256; the receiver verifies it before accepting.
- Anything unverified is re-requested until it arrives intact.
- Final verification checks that **all chunks were received**, that the assembled file is **exactly `fileSize` bytes**, and that both sides agree on a **metadata fingerprint** (`SHA-256(fileName|fileSize|totalChunks|chunkSize)`).

This covers every byte of the file and is equivalent to an end-to-end hash for tamper/corruption detection.

### Performance Notes
- Base64 encoding uses a batched code-buffer encoder (`String.fromCharCode` in 4096-char flushes) rather than per-character string concatenation; decoding on receive is done natively by `expo-file-system`.
- Throughput is roughly `window × chunkSize / RTT`. With 32 × 64 KB and a ~600 ms round trip that is on the order of a few MB/s, so a 2 GB file takes **minutes, not seconds** — the transport is network-bound, not CPU-bound.
- The Mongo-per-chunk bottleneck that previously capped throughput at ~425 KB/s has been removed server-side (see below).

---

## 📁 Project Structure

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
│   │   │   ├── ChatBubble.tsx           # WhatsApp-style bubbles with status ticks
│   │   │   ├── VideoBubble.tsx          # Inline transfer card with progress & play
│   │   │   ├── ProgressBar.tsx          # Progress percentage, speed & ETA
│   │   │   ├── PairCode.tsx             # 6-digit pairing code display & countdown
│   │   │   └── SafeScreen.tsx           # Safe-area wrapper
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx           # Two options: Select File (Send) vs Receive
│   │   │   ├── PairScreen.tsx           # Preparation, 6-digit code & storage verification
│   │   │   ├── ChatScreen.tsx           # Chat interface with video picker modal
│   │   │   └── VideoTransferScreen.tsx  # expo-video playback & experiment metrics
│   │   ├── services/
│   │   │   ├── api.ts                   # REST API & health check
│   │   │   ├── websocket.ts             # WS client with auto-reconnect & heartbeat
│   │   │   ├── pairing.ts               # Pairing state, session auth & storage exchange
│   │   │   ├── storage.ts               # Native free/total space & transfer gate
│   │   │   ├── messages.ts              # Text chat service
│   │   │   ├── videoTransfer.ts         # Streaming transfer engine (window, watchdog, repair)
│   │   │   ├── fileSystem.ts            # Chunk storage, streaming reassembly, file handles
│   │   │   └── hashing.ts               # SHA-256 & metadata fingerprint
│   │   ├── store/
│   │   │   ├── chatStore.ts             # Zustand store for chat messages
│   │   │   ├── connectionStore.ts       # WebSocket & peer status store
│   │   │   └── transferStore.ts         # Active video transfers & metrics
│   │   ├── types/
│   │   │   ├── messages.ts              # ChatMessage, MessageStatus
│   │   │   ├── pairing.ts               # PairingState, DeviceStorageInfo, PairCreateResponse
│   │   │   └── transfers.ts             # VideoTransferMeta, VideoChunk, TransferMetrics
│   │   └── utils/
│   │       ├── chunking.ts              # Configurable chunk sizes (64 KB, 128 KB), ETA & speed
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

## ⚡ Quick Start Guide

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

# or build/run natively:
npm run android         # expo run:android (generates android/)
npm run ios             # expo run:ios (macOS only)
```

### 4. Type-check

```bash
cd videoshare/mobile  && npx tsc --noEmit
cd videoshare/server  && npx tsc --noEmit && npm run build
```

---

## 📡 WebSocket Event Protocol

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
| `video:chunk` | Client → Server | `{ transferId, chunkIndex, totalChunks, data, hash }` (~87 KB frame at 64 KB chunks) |
| `video:ack` | Client → Server | `{ transferId, chunkIndex, status: "received" }` |
| `video:request_missing` | Client → Server | `{ transferId, missingIndices: number[] }` (resume / repair) |
| `video:complete` | Client → Server | `{ transferId, checksumVerified: boolean }` |
| `video:cancel` | Client → Server | `{ transferId, reason }` |
| `video:error` | Server → Client | `{ transferId, error }` |
| `ping` / `pong` | Bidirectional | 25 s heartbeat keep-alive |

**Server-side routing**
- Messages from a single connection are **serialized** through a promise chain, so a `video:chunk` can never be processed before its `video:start`.
- `video:start` populates an **in-memory transfer route cache** (`transferId → { sender, receiver }`), removed on `video:complete` / `video:cancel`. Chunk, ack, repair and completion messages resolve their destination from that cache instead of a MongoDB round trip per chunk.
- If persisting `video:start` fails, the server emits `video:error` to the client instead of failing silently.

---

## 🧪 Experimental Metrics

For every video transfer, VideoShare measures:
1. **Original Binary Size**: (e.g., 12.5 MB = 13,107,200 bytes)
2. **Encoded Size**: (e.g., ~16.6 MB Base64 representation)
3. **Representation Ratio**: 1.33x (~33% expansion overhead)
4. **Number of Chunks**: (e.g., 200 chunks of 64 KB each; 32,768 chunks for 2 GB)
5. **Transfer Time & Average Speed**: derived from live ACK timing
6. **Retransmitted Data**: tracks resends triggered by the watchdog / repair requests
7. **Integrity Result**: per-chunk SHA-256 verification plus the final metadata-fingerprint and byte-length check

---

## ✅ What We Have Done

- [x] **Backend Architecture**: Node.js + Express + WebSocket + MongoDB + Mongoose + Zod + Helmet + CORS.
- [x] **Two-Option App Design**: Main landing screen with "Select File" and "Receive" cards + live device storage badge.
- [x] **Streaming Transfer Engine (up to 2 GB)**: Chunks are read from disk on demand and never buffered in memory. Peak memory is a single 64 KB chunk on both sides.
- [x] **ACK-Gated Sliding Window**: 32 chunks in flight (~2 MB), batched encoding that yields to the UI, and back-pressure from receiver acknowledgements.
- [x] **Watchdog Recovery**: Stalled in-flight chunks are retransmitted; missing chunks are re-requested; both sides self-heal across brief disconnects.
- [x] **6-Digit Pairing System**: Ephemeral 6-digit codes (10 mins), automatic invalidation, secure token generation.
- [x] **Real Storage Reporting**: `expo-file-system` `Paths.availableDiskSpace` / `totalDiskSpace` replace deprecated calls that fabricated a fake "24.5 GB".
- [x] **Receiver Storage Verification Gate**: Receiver transmits disk space upon pairing; sender verifies sufficient capacity before initiating transfer.
- [x] **Low RAM Server Compliance**: Zero video bytes buffered in server RAM or MongoDB.
- [x] **Filesystem Chunk Storage on Receiver**: Temporary `/VideoShare/transfers/{transferId}/chunk_XXXXXX` writing.
- [x] **Streaming Reassembly**: Chunks are copied through a native file handle and deleted as they are consumed, halving peak disk usage.
- [x] **Per-Chunk Integrity Verification**: Every chunk's SHA-256 is checked before acceptance; corrupt chunks are rejected and re-requested.
- [x] **Removed `expo-av`**: Replaced with `expo-video` after `expo-av` was dropped from the Expo SDK, fixing a native crash on launch in built APKs.
- [x] **Server Message Ordering & Route Caching**: Serialized per-connection handling plus an in-memory transfer route cache (no MongoDB query per chunk).
- [x] **Lightweight WhatsApp Chat**: SENDING, SENT, DELIVERED, READ statuses, real-time message routing.
- [x] **39 Automated Tests Passing**: Pairing, wrong code, expired code, message delivery, offline queuing, 1 MB chunking, 10 MB simulation, corrupted chunk rejection, resume, cancellation and storage verification gates.
- [x] **APK Build Pipeline Documented**: Step-by-step EAS Build instructions for APK and app-bundle output.

---

## 🔮 What Is Left To Do (Roadmap for Future AI Agents & Developers)

1. **Native FFmpeg Compression Integration**:
   - Integrate `ffmpeg-kit-react-native` to run pre-encoding compression (e.g. H.264/H.265 CRF 28) before chunking, allowing users to choose between "Original Quality" and "Compressed". This is the single biggest win for large files.
2. **Adaptive Sliding Window Congestion Control**:
   - The window is currently fixed at 32 chunks. Adjust it dynamically from measured RTT and loss to push throughput higher on fast links and avoid overwhelming slow ones.
3. **Android Foreground Service**:
   - Add a native Android Foreground Service with notification progress so long transfers continue uninterrupted if the user switches apps or the screen locks.
4. **Wire-Format Upgrade (binary frames)**:
   - `video:chunk` currently carries Base64 text (~33% overhead) and the sender must base64-encode each chunk in JS. Streaming raw binary frames over the WebSocket would remove both the bandwidth cost and the encode/decode CPU. A protocol version negotiation would be needed for compatibility.
5. **Source File Staging**:
   - `expo-image-picker` hands back a file inside the app **cache**. Android may reclaim cache under memory pressure, which would break a very long send. Staging the file into the documents directory first removes that risk at the cost of extra sender disk space.
6. **iOS Background Processing & APNs Wakeup**:
   - Implement silent VoIP/Background push notifications via Apple Push Notification service to wake the paired device when a new transfer begins.
7. **Optional WebRTC Peer-to-Peer DataChannel Sidecar**:
   - Allow paired devices on the same local Wi-Fi to establish a direct P2P text data channel as a fallback or high-speed local mode. This would require adding STUN/TURN configuration (there is none today) and a signalling path through the existing `/ws` server.
