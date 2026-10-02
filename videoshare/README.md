# VideoShare: Private Mobile App with Text-Transported Video

VideoShare is a private mobile application designed for **exactly two paired devices**. It features a streamlined two-option pairing interface, a WhatsApp-style private chat, and an experimental core: **transferring high-resolution video files over our own text-based chat transport without third-party messaging services**.

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
     - Sender receives receiver's available storage details
     - Compares receiver free space vs video required size
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
- **Video Selection**: Choose from predefined quality presets (5.0 MB, 12.5 MB, 25.0 MB, 1.0 MB) or enter custom video metadata.
- **Immediate Video Pre-Processing**: Before generating the code, the app computes the SHA-256 cryptographic checksum, slices the video into 64 KB progressive chunks, and prepares Base64 text-safe representations with progress feedback.
- **6-Figure Pairing Code**: The backend creates an ephemeral 6-digit code (valid for 10 minutes) displayed with a countdown timer.
- **Receiver Storage Verification**: Upon pairing, the sender receives the receiver's available storage metrics. If the receiver has sufficient free space, the sender clicks **"Start Video Transfer"**. If space is insufficient, the transfer is blocked to prevent failed and unwanted transfers.

### 2. "Receive" Option (Receiver Flow)
- **Enter 6-Digit Code**: Large numeric input field to enter the sender's pairing code.
- **Available Storage Display**: Directly below the code input, the receiver's current available storage (e.g. `24.5 GB Free / 64.0 GB Total`) is shown alongside a visual capacity bar.
- **Automated Storage Reporting**: On `pair:join`, the receiver securely transmits its available disk space to the sender.
- **Transfer Reception & Reassembly**: Chunks arrive over WebSocket, are written to `/VideoShare/transfers/{transferId}/`, reassembled in sequence, verified against the sender's SHA-256 checksum (`Verified ✓`), and made available for instant playback.

---

## 📦 How to Get the APK File

The mobile application is a native React Native project configured for Android in [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile).

### Prerequisites
1. **Node.js**: Version >= 22.11.0 and npm
2. **JDK**: Java Development Kit 17 (e.g. OpenJDK 17 or Eclipse Temurin 17)
3. **Android SDK**: Android API 34+ and Android Build-Tools 34.0.0+
4. **Environment Variables**:
   - `ANDROID_HOME`: e.g. `C:\Users\<user>\AppData\Local\Android\Sdk`
   - `JAVA_HOME`: e.g. `C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot`
   - Append `%ANDROID_HOME%\platform-tools` to your system `PATH`

---

### Method 1: Build Debug APK via Command Line (Fastest)

1. Open your terminal and change to the Android directory:
   ```bash
   cd videoshare/mobile/android
   ```

2. Execute the Gradle build:
   - **On Windows (PowerShell / Command Prompt)**:
     ```cmd
     gradlew.bat assembleDebug
     ```
   - **On macOS / Linux**:
     ```bash
     ./gradlew assembleDebug
     ```

3. **Locate your generated APK file**:
   ```
   videoshare/mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Install APK onto an Android device or emulator**:
   - Via ADB:
     ```bash
     adb install videoshare/mobile/android/app/build/outputs/apk/debug/app-debug.apk
     ```
   - Or copy `app-debug.apk` directly to your phone via USB cable or file transfer, and tap to install (ensure "Install from unknown sources" is enabled in Android settings).

---

### Method 2: Build via Android Studio (GUI)

1. Open **Android Studio**.
2. Click **Open** and select the folder:
   ```
   videoshare/mobile/android
   ```
3. Allow Android Studio to sync Gradle and download any required platform packages.
4. From the top menu, navigate to:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
5. Once completed, a notification popup in the bottom right corner will appear with a **"locate"** action button that directly opens the folder containing `app-debug.apk`.

---

### Method 3: Build Signed Release APK (For Distribution)

1. Generate a signing key (if not already done):
   ```bash
   keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Move `my-release-key.keystore` into `videoshare/mobile/android/app/`.
3. Configure `signingConfigs.release` in `videoshare/mobile/android/app/build.gradle`.
4. Run:
   ```cmd
   cd videoshare/mobile/android
   gradlew.bat assembleRelease
   ```
5. Output APK:
   ```
   videoshare/mobile/android/app/build/outputs/apk/release/app-release.apk
   ```

> **Troubleshooting Gradle Network Timeouts**:
> If the Gradle wrapper download of `gradle-9.4.1-bin.zip` times out during command line execution, opening `videoshare/mobile/android` in Android Studio once will handle the download using its built-in proxy and cache management.

---

## 🎯 The Core Experiment

Instead of relying on third-party services (WhatsApp, Telegram, SMS) or direct binary uploads to a cloud bucket, VideoShare proves that video can be transported through a lightweight, text-oriented messaging protocol:

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

> **Important Distinction**: Base64 is **not compression**; it is an encoding mechanism that increases payload size by ~33%. VideoShare clearly isolates binary-to-text encoding from compression.

---

## 🏗 Architecture & Tech Stack

### 1. Mobile Client (`mobile/`)
- **Framework**: React Native with TypeScript (Android-first, iOS-compatible)
- **Navigation**: React Navigation (`@react-navigation/native-stack`)
- **State Management**: Zustand (`chatStore`, `connectionStore`, `transferStore`)
- **Storage Management**: `StorageService` with native Android `StatFs` bridge (`StorageModule.kt`)
- **Filesystem**: Progressive chunking to local device storage (`/VideoShare/transfers/{transferId}/`)
- **Hashing**: SHA-256 file and chunk verification (`crypto-js`)
- **UI Components & Screens**:
  - `HomeScreen`: Two-option launchpad ("Select File" and "Receive") with device storage status
  - `PairScreen`: Video pre-processing, 6-figure pairing code display, available storage display, and receiver storage verification gate
  - `ChatScreen`: WhatsApp-style bubbles with delivery receipts (`SENT` ✓, `DELIVERED` ✓✓, `READ` ✓✓ blue)
  - `VideoBubble`: Dynamic transfer card with real-time percentage, byte counters, speed (MB/s), ETA, and "Verified ✓" badge
  - `VideoTransferScreen`: Video playback & experimental metrics
  - `ProgressBar`: High-precision progress indicator
  - `PairCode`: 6-digit code display with expiry timer

### 2. Backend Server (`server/`)
- **Runtime**: Node.js + TypeScript + Express
- **Real-time Communication**: WebSocket (`ws`) attached to HTTP server (`/ws`)
- **Validation**: Zod schema validation for all client events
- **Database**: MongoDB + Mongoose (`PairSessions`, `Messages`, `Transfers`)
- **Deployment**: Render-ready (`render.yaml`, `0.0.0.0`, port dynamic mapping, health check `GET /health`)
- **Low RAM Constraint**: The server acts strictly as an authenticator, message router, and metadata store. **Zero binary videos and zero Base64 chunks are retained in server RAM or MongoDB.**

---

## 📁 Project Structure

```
videoshare/
├── mobile/
│   ├── android/
│   │   ├── app/
│   │   │   ├── src/main/java/com/videoshare/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── MainApplication.kt    # Registers StoragePackage
│   │   │   │   ├── StorageModule.kt      # Native StatFs storage query
│   │   │   │   └── StoragePackage.kt     # React Native package export
│   │   │   └── build.gradle
│   │   ├── gradlew.bat                   # Gradle wrapper for Windows
│   │   └── gradlew                       # Gradle wrapper for Unix
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatBubble.tsx            # WhatsApp-style chat bubbles with status ticks
│   │   │   ├── VideoBubble.tsx           # Inline video transfer bubble with progress & play
│   │   │   ├── ProgressBar.tsx           # Progress percentage, speed & ETA
│   │   │   └── PairCode.tsx              # 6-digit pairing code display & countdown
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx            # Two options: Select File (Send) vs Receive
│   │   │   ├── PairScreen.tsx            # Pre-processing, 6-digit code & storage verification
│   │   │   ├── ChatScreen.tsx            # Main chat interface with video picker modal
│   │   │   └── VideoTransferScreen.tsx   # Video playback & experiment metrics
│   │   ├── services/
│   │   │   ├── api.ts                    # REST API & health check
│   │   │   ├── websocket.ts              # WebSocket client with auto-reconnect & heartbeat
│   │   │   ├── pairing.ts                # Pairing state, session auth & storage exchange
│   │   │   ├── storage.ts                # Available storage detection & transfer verification
│   │   │   ├── messages.ts               # Text chat service
│   │   │   ├── videoTransfer.ts          # Pre-processing, chunking, Base64 encoding & transport
│   │   │   ├── fileSystem.ts             # Progressive filesystem storage & reassembly
│   │   │   └── hashing.ts                # SHA-256 calculation & checksum verification
│   │   ├── store/
│   │   │   ├── chatStore.ts              # Zustand store for chat messages
│   │   │   ├── connectionStore.ts        # WebSocket & peer status store
│   │   │   └── transferStore.ts          # Active video transfers & metrics
│   │   ├── types/
│   │   │   ├── messages.ts               # ChatMessage, MessageStatus
│   │   │   ├── pairing.ts                # PairingState, DeviceStorageInfo, PairCreateResponse
│   │   │   └── transfers.ts              # VideoTransferMeta, VideoChunk, TransferMetrics
│   │   └── utils/
│   │       ├── chunking.ts               # Configurable chunk sizes (64KB, 128KB), ETA & speed
│   │       └── encoding.ts               # High-performance Uint8Array <-> Base64
│   ├── App.tsx                           # Navigation stack provider
│   ├── index.js                          # React Native entry point
│   ├── package.json
│   └── tsconfig.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   └── index.ts                  # Server environment variables & defaults
│   │   ├── models/
│   │   │   ├── PairSession.ts            # 6-digit pairing session & device auth
│   │   │   ├── Message.ts                # Text messages & delivery statuses
│   │   │   └── Transfer.ts               # Video metadata & completion tracking
│   │   ├── routes/
│   │   │   ├── health.ts                 # GET /health -> { "status": "ok" }
│   │   │   └── api.ts                    # REST endpoints for message history & transfers
│   │   ├── services/
│   │   │   ├── pairingService.ts         # 6-digit code generator & auth validation
│   │   │   ├── messageService.ts         # Message persistence & offline catchup
│   │   │   └── transferService.ts        # Transfer metadata tracking
│   │   ├── websocket/
│   │   │   ├── schemas.ts                # Zod schemas (including storage:info & pair:join storage)
│   │   │   └── wsManager.ts              # WebSocket router, pipelined chunks & storage relay
│   │   ├── app.ts                        # Express app with Helmet, CORS & JSON limits
│   │   └── server.ts                     # Bootstrap server with MongoDB & WebSocket
│   ├── tests/
│   │   └── test_suite.ts                 # 39 automated tests covering all requirements
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── render.yaml                           # Render deployment blueprint
└── README.md                             # Complete documentation & developer roadmap
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
- **Health check**: `http://localhost:3000/health`
- **WebSocket**: `ws://localhost:3000/ws`

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

### 3. Run the Mobile App

```bash
cd videoshare/mobile
npm install

# For Android (Device or Emulator):
npm run android

# For iOS Simulator:
npm run ios
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
| `video:start` | Client → Server | `{ transferId, fileName, fileSize, totalChunks, chunkSize, checksum }` |
| `video:chunk` | Client → Server | `{ transferId, chunkIndex, totalChunks, data, hash }` |
| `video:ack` | Client → Server | `{ transferId, chunkIndex, status: "received" }` |
| `video:request_missing` | Client → Server | `{ transferId, missingIndices: number[] }` (Resume) |
| `video:complete` | Client → Server | `{ transferId, checksumVerified: boolean }` |
| `video:cancel` | Client → Server | `{ transferId, reason }` |
| `ping` / `pong` | Bidirectional | 30s heartbeat keep-alive |

---

## 🧪 Experimental Metrics (Section 29)

For every video transfer, VideoShare measures:
1. **Original Binary Size**: (e.g., 12.5 MB = 13,107,200 bytes)
2. **Encoded Size**: (e.g., ~16.6 MB Base64 representation)
3. **Representation Ratio**: 1.33x (~33% expansion overhead)
4. **Number of Chunks**: (e.g., 200 chunks of 64 KB each)
5. **Transfer Time & Average Speed**: (e.g., 1.8 MB/s)
6. **Retransmitted Data**: Tracks resends upon packet loss or reconnection
7. **SHA-256 Verification Result**: Cryptographic equality check ensuring zero corruption

---

## ✅ What We Have Done

- [x] **Backend Architecture**: Node.js + Express + WebSocket + MongoDB + Mongoose + Zod + Helmet + CORS.
- [x] **Two-Option App Design**: Main landing screen with "Select File" and "Receive" cards + live device storage badge.
- [x] **Video Pre-Processing Pipeline**: Immediate SHA-256 cryptographic hashing and 64 KB Base64 chunk slicing before pairing code generation.
- [x] **6-Digit Pairing System**: Ephemeral 6-digit codes (10 mins), automatic invalidation, secure token generation.
- [x] **Receiver Available Storage Display**: Real-time display of available and total disk space directly below the 6-digit pairing code input.
- [x] **Receiver Storage Verification Gate**: Receiver transmits disk space upon pairing; sender verifies sufficient capacity before initiating transfer, eliminating unwanted or aborted transfers.
- [x] **Low RAM Server Compliance**: Zero video bytes buffered in server RAM or MongoDB; streamed directly to recipient.
- [x] **Filesystem Chunk Storage on Receiver**: Temporary `/VideoShare/transfers/{transferId}/chunk_XXXXXX` writing.
- [x] **Sequential Reassembly & Integrity Verification**: File reconstructed in byte order, SHA-256 calculated and compared to sender hash (`Verified ✓`).
- [x] **Transfer Resume**: Seamless reconnect without restarting from zero; receiver queries missing chunks, sender re-transmits only missing slices.
- [x] **Lightweight WhatsApp Chat**: SENDING, SENT, DELIVERED, READ statuses, real-time message routing.
- [x] **39 Automated Tests Passing**: All tests passing including pairing, wrong code, expired code, message delivery, offline queuing, 1MB chunking, 10MB simulation, corrupted chunk rejection, resume, cancellation, and storage verification gates.
- [x] **APK Build Pipeline Documented**: Step-by-step instructions for Debug and Release APK creation using Gradle CLI and Android Studio.

---

## 🔮 What Is Left To Do (Roadmap for Future AI Agents & Developers)

1. **Native FFmpeg Compression Integration (Milestone 30)**:
   - Integrate `ffmpeg-kit-react-native` to run pre-encoding compression (e.g. H.264/H.265 CRF 28) before chunking, allowing users to choose between "Original Quality" and "Compressed".
2. **Adaptive Sliding Window Congestion Control**:
   - Dynamically adjust the number of unacknowledged in-flight chunks based on measured round-trip time (RTT) and network packet loss.
3. **Android Foreground Service**:
   - Add a native Android Foreground Service with notification progress so multi-hundred-megabyte transfers continue uninterrupted if the user switches apps.
4. **iOS Background Processing & APNs Wakeup**:
   - Implement silent VoIP/Background push notifications via Apple Push Notification service to wake the paired device when a new transfer begins.
5. **Optional WebRTC Peer-to-Peer DataChannel Sidecar**:
   - Utilize the included STUN configuration (`STUN_URL`) to allow paired devices on the same local Wi-Fi to establish a direct P2P text data channel as a fallback or high-speed local mode.
