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

## 📦 How to Get the APK File

The mobile application is a native React Native project located in [`videoshare/mobile/`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/mobile).

### Prerequisites
- **Node.js**: >= 22.11.0 and npm
- **Java Development Kit (JDK)**: JDK 17 (e.g. Eclipse Temurin 17 or OpenJDK 17)
- **Android SDK**: Android API level 34+ and build-tools installed via Android Studio or command-line tools
- **Environment Variables**:
  - `ANDROID_HOME`: e.g. `C:\Users\<user>\AppData\Local\Android\Sdk`
  - `JAVA_HOME`: e.g. `C:\Program Files\Eclipse Adoptium\jdk-17...`
  - Add `%ANDROID_HOME%\platform-tools` to your system `PATH`

---

### Method 1: Build Debug APK via Command Line (Fastest)

1. Open a terminal in the Android directory:
   ```bash
   cd videoshare/mobile/android
   ```

2. Run the Gradle build task:
   - **On Windows (PowerShell / Command Prompt)**:
     ```cmd
     gradlew.bat assembleDebug
     ```
   - **On macOS / Linux**:
     ```bash
     ./gradlew assembleDebug
     ```

3. **Locate your generated APK**:
   ```
   videoshare/mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Install on Device or Emulator**:
   - Connect your Android phone with USB Debugging enabled, or start an emulator:
     ```bash
     adb install videoshare/mobile/android/app/build/outputs/apk/debug/app-debug.apk
     ```
   - Or transfer `app-debug.apk` directly to your phone via USB / Google Drive and tap to install.

---

### Method 2: Build APK via Android Studio (GUI)

1. Open **Android Studio**.
2. Select **File > Open** (or "Open Project") and choose the folder:
   ```
   videoshare/mobile/android
   ```
3. Wait for the Gradle project sync to finish.
4. From the top menu bar, select:
   **Build > Build Bundle(s) / APK(s) > Build APK(s)**
5. When the build completes, click the **"locate"** link in the bottom-right notification popup to open the folder containing `app-debug.apk`.

---

### Method 3: Build Signed Release APK (Production Distribution)

1. Generate a keystore (if not already generated):
   ```bash
   keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Place the keystore in `videoshare/mobile/android/app/`.
3. Configure `android/app/build.gradle` with your release signing credentials.
4. Run:
   ```cmd
   cd videoshare/mobile/android
   gradlew.bat assembleRelease
   ```
5. Output APK:
   ```
   videoshare/mobile/android/app/build/outputs/apk/release/app-release.apk
   ```

> **Note on Gradle Wrapper Download**: If running `gradlew` for the first time and the download of `gradle-9.4.1-bin.zip` times out due to network restrictions, open `videoshare/mobile/android` in Android Studio once—it will automatically download and cache Gradle components reliably.

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
npm run android   # or npm run ios
```

For in-depth architecture details and protocol specifications, see [`videoshare/README.md`](file:///c:/Users/devan/OneDrive/Desktop/VidChat/videoshare/README.md).
