# VideoShare: Private Mobile App with Text-Transported Video

VideoShare is a private mobile application designed for **exactly two paired devices**. It features a streamlined two-option pairing interface, a WhatsApp-style private chat, and an experimental core: **transferring high-resolution video files up to 2 GB over our own text-based chat transport without third-party messaging services**.

---

## 📱 App Design & Workflow

When opening the app, users are greeted with two primary, distinct options:

```
                          ┌──────────────────────────┐
                          │   VideoShare Launch      │
                          └─────────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
       [ 🎬 Select File (Send) ]                     [ 📥 Receive Video ]
                 │                                             │
                 ▼                                             ▼
  1. Pick Video File (≤ 2 GB)                     1. Enter 6-Digit Pairing Code
  2. Prepare Transfer (no full read!):                          │
     - File size + chunk plan (64 KB)               2. Device Storage Display:
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
                  [ 🛡️ Receiver Storage Verification Gate ]
    - Sender verifies receiver's real free space against video size
    - If Insufficient: Transfer blocked to prevent failure
    - If Sufficient: Sender clicks "Start Video Transfer"
                                        │
                                        ▼
                       [ Streaming Text Transfer ]
    - 32-chunk sliding window, ACK-gated; chunks read from disk on demand
                                        │
                                        ▼
                  [ Receiver Streaming Reassembly ]
    - Each chunk hash-verified, written to disk, then copied into the video
                                        │
                                        ▼
                  [ Integrity Verified ✓ ──▶ Play Video ]
```

### 1. "Select File" Option (Sender Flow)
1. **File Selection**: Choose a real video from the gallery or file picker (up to **2 GB**), or pick one of the demo sizes for testing the transport.
2. **Instant Transfer Preparation**: The app **does not read the file** — it inspects the size, derives the 64 KB chunk plan, and computes a small metadata fingerprint. This takes milliseconds even for a 2 GB video, because the bytes are streamed off disk later.
3. **6-Figure Pairing Code**: The backend generates a 6-digit code (valid for 10 minutes) displayed with a countdown timer.
4. **Receiver Storage Verification**: When the receiver joins, the sender receives the receiver's real available storage. The sender verifies `availableBytes >= requiredBytes` (+ safety margin) before starting, eliminating doomed transfers.

### 2. "Receive" Option (Receiver Flow)
1. **Enter 6-Digit Code**: Numeric input field to enter the sender's pairing code.
2. **Available Storage Display**: Directly below the code input, the receiver's available device storage (e.g., `48.2 GB Free / 128.0 GB Total`) is displayed with a graphical capacity meter, read straight from the native filesystem.
3. **Storage Reporting**: Upon pairing, storage metrics are securely shared with the sender for verification.
4. **Transfer Reception**: Chunks stream across the WebSocket text transport, each is SHA-256 verified before being written to disk, then reassembled and confirmed (`Verified ✓`).

---

## 📦 Running & Building the App

The mobile application is an **Expo (managed workflow)** project using **expo-router**, located in [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile). Playback uses **`expo-video`** (`expo-av` was removed from the Expo SDK and had to be dropped).

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

> **Note**: EAS Build runs in the cloud — no Android SDK or Xcode required locally. Any change to native dependencies requires a fresh build.

---

### Method 3: Local Development Build (Expo + native)

```bash
cd videoshare/mobile
npx expo run:android   # generates android/ and compiles — requires Android SDK
npx expo run:ios       # requires Xcode (macOS only)
```

---

## 🎯 The Core Experiment: Video Over Text Transport

```
[ Original Video Binary on Device ]
          │
          ▼
[ Transfer Preparation ] (size + chunk plan + metadata fingerprint — no full read)
          │
          ▼
[ Streaming Chunk Read ] (64 KB at a time via a native file handle)
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
[ ChatTransport WebSocket ] (ACK-gated sliding window, 32 chunks ≈ 2 MB in flight)
          │
          ▼
[ Receiver Local Filesystem ] (/VideoShare/transfers/{transferId}/chunk_XXXXXX)
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
    [ Verified ✓ ] ──▶ [ ▶ Play Video ]
```

---

## 📁 Repository Structure

- [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile): React Native TypeScript application (Android-first, iOS-compatible) on Expo SDK 57
  - `app/`: `expo-router` route files (`_layout.tsx` registers the transfer/WebSocket listeners at app start)
  - Screens:
    - [`HomeScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/HomeScreen.tsx): Main landing screen with two options: "Select File" and "Receive" + device storage badge.
    - [`PairScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/PairScreen.tsx): Transfer preparation, 6-figure pairing code display, available storage display, and receiver storage verification gate.
    - [`ChatScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/ChatScreen.tsx): Two-party private chat with inline video transfer bubbles and receipts.
    - [`VideoTransferScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/VideoTransferScreen.tsx): `expo-video` playback plus real-time metrics and verification details.
  - Services:
    - [`storage.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/storage.ts): Native free/total disk reporting & transfer capacity verification.
    - [`videoTransfer.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/videoTransfer.ts): Streaming transfer engine — sliding window, watchdog, repair, progress.
    - [`pairing.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/pairing.ts): 6-digit pairing and device storage metadata exchange.
    - [`fileSystem.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/fileSystem.ts): Chunk storage, streaming reassembly, native file handles.
    - [`hashing.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/hashing.ts): SHA-256 per-chunk verification & metadata fingerprint.
- [`videoshare/server/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/server): Node.js + TypeScript + Express + WebSocket + MongoDB backend
  - WebSocket routing: serialized per-connection handling, in-memory transfer route cache (no DB query per chunk), acknowledgement windows, receiver storage relay.
  - Automated Tests: **39 tests passing** (`npx tsx tests/test_suite.ts`).
- [`render.yaml`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/render.yaml): Render deployment configuration blueprint.

---

## ⚡ Quick Start

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
