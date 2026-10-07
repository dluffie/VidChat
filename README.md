# VideoShare: Private Mobile App with Text-Transported Video

VideoShare is a private mobile application designed for **exactly two paired devices**. It features a streamlined two-option pairing interface, a WhatsApp-style private chat, and an experimental core: **transferring high-resolution video files over our own text-based chat transport without third-party messaging services**.

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
  1. Pick Video File                             1. Enter 6-Digit Pairing Code
  2. Local Video Pre-Processing:                               │
     - SHA-256 Checksum Calculation                            ▼
     - 64 KB Binary Chunk Slicing                2. Device Storage Display:
     - Base64 Text-Safe Slicing                     - Free Space (e.g. 24.5 GB)
                 │                                  - Visual Capacity Bar
                 ▼                                  - Storage details shared on join
  3. Generate 6-Figure Pairing Code                            │
  4. Wait for Receiver to Join                                 │
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                         [ 6-Figure Code Matched ]
                                        │
                                        ▼
                   [ 🛡️ Receiver Storage Verification Gate ]
     - Sender verifies receiver's free space against video file size
     - If Insufficient: Transfer blocked to eliminate unwanted failure
     - If Sufficient: Sender clicks "Start Video Transfer"
                                        │
                                        ▼
                       [ Progressive Text Transfer ]
                                        │
                                        ▼
                    [ Receiver Sequential Reassembly ]
                                        │
                                        ▼
                   [ SHA-256 Verified ✓ ──▶ Play Video ]
```

### 1. "Select File" Option (Sender Flow)
1. **File Selection**: Choose from preset demo clips (5 MB, 12.5 MB, 25 MB, 1 MB) or specify custom video files.
2. **Instant Video Pre-Processing**: Before generating the pairing code, the app computes the file's SHA-256 cryptographic checksum, slices the video into 64 KB chunks, and prepares Base64 text-safe encoding.
3. **6-Figure Pairing Code**: The backend generates a 6-digit code (valid for 10 minutes) displayed with a countdown timer.
4. **Receiver Storage Verification**: When the receiver joins, the sender receives the receiver's available storage details. The sender verifies if the receiver has enough space (`availableBytes >= requiredBytes`) before starting the transfer, eliminating unwanted or failing transfers.

### 2. "Receive" Option (Receiver Flow)
1. **Enter 6-Digit Code**: Numeric input field to enter the sender's pairing code.
2. **Available Storage Display**: Directly below the code input, the receiver's available device storage (e.g., `24.5 GB Free / 64.0 GB Total`) is displayed with a graphical capacity meter.
3. **Storage Reporting**: Upon pairing, storage metrics are securely shared with the sender for verification.
4. **Transfer Reception**: Once the sender initiates transfer, chunks stream across WebSocket text transport, write sequentially to local storage, reassemble, and verify integrity via SHA-256 (`Verified ✓`).

---

## 📦 Running & Building the App

The mobile application is an **Expo (managed workflow)** project using **expo-router**, located in [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile).

### Prerequisites
- **Node.js**: >= 22.11.0 and npm
- **Expo Go** app installed on your phone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

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

2. Configure the build:
   ```bash
   cd videoshare/mobile
   eas build:configure
   ```

3. Build for Android (APK):
   ```bash
   eas build -p android --profile preview
   ```

4. Build for iOS:
   ```bash
   eas build -p ios
   ```

> **Note**: EAS Build runs in the cloud — no Android SDK or Xcode required locally.

---

### Method 3: Local Development Build (Expo + native)

```bash
cd videoshare/mobile
npx expo run:android   # requires Android SDK
npx expo run:ios       # requires Xcode (macOS only)
```

---

## 🎯 The Core Experiment: Video Over Text Transport

```
[ Original Video Binary ]
          │
          ▼
[ Pre-Processing & SHA-256 Hashing ] (Checksum calculated before transfer)
          │
          ▼
[ Progressive Chunking ] (Configurable: 64 KB or 128 KB binary chunks)
          │
          ▼
[ Text-Safe Encoding ] (Base64 representation: ~33% overhead)
          │
          ▼
[ Receiver Storage Verification Gate ] (Verified free space before streaming)
          │
          ▼
[ ChatTransport WebSocket ] (Custom text message events)
          │
          ▼
[ Receiver Local Filesystem ] (/VideoShare/transfers/{transferId}/chunk_XXXXXX)
          │
          ▼
[ Base64 Decode & Sequential Reassembly ]
          │
          ▼
[ SHA-256 Integrity Verification ] (originalHash === reconstructedHash)
          │
          ▼
    [ Verified ✓ ] ──▶ [ ▶ Play Video ]
```

---

## 📁 Repository Structure

- [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile): React Native TypeScript application (Android-first, iOS-compatible)
  - Screens:
    - [`HomeScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/HomeScreen.tsx): Main landing screen with two options: "Select File" and "Receive" + device storage badge.
    - [`PairScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/PairScreen.tsx): Video pre-processing, 6-figure pairing code display, available storage display, and receiver storage verification gate.
    - [`ChatScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/ChatScreen.tsx): Two-party private chat with inline video transfer bubbles and receipts.
    - [`VideoTransferScreen.tsx`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/screens/VideoTransferScreen.tsx): Real-time metrics and verification details.
  - Services:
    - [`storage.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/storage.ts): Device storage detection & transfer capacity verification.
    - [`videoTransfer.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/videoTransfer.ts): Video pre-processing, chunking, Base64 encoding, transport & resume engine.
    - [`pairing.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/pairing.ts): 6-digit pairing and device storage metadata exchange.
    - [`fileSystem.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/fileSystem.ts): Progressive chunk filesystem storage & reassembly.
    - [`hashing.ts`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile/src/services/hashing.ts): SHA-256 cryptographic verification.
- [`videoshare/server/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/server): Node.js + TypeScript + Express + WebSocket + MongoDB backend
  - WebSocket routing: real-time streaming, acknowledgement windows, receiver storage relay.
  - Automated Tests: **39 end-to-end tests passing**.
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
npx expo start      # scan QR with Expo Go app
```

For in-depth architecture details and protocol specifications, see [`videoshare/README.md`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/README.md).
