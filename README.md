# Radii 📡

> **Decentralized, Zero-Internet, Radio-Frequency Offline Mesh Chat & Nearby File Sharing for Android.**

[![Android](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white)](#download--try-it-now)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Zero Internet](https://img.shields.io/badge/Internet-0%25%20Required-00c20d?logo=signal&logoColor=white)](#core-architecture)

**Radii** is a high-performance offline mobile application that lets you discover nearby companions, exchange end-to-end direct messages, broadcast inside PIN-protected mesh rooms, and transfer photos, voice notes, and large files peer-to-peer **without cellular data, SIM cards, Wi-Fi routers, or internet access**.

---

## ⚡ Quick Download & Test (Pre-built APK)

Want to test Radii immediately on your Android phone without setting up a development environment? You can download the signed release APK directly from this repository:

| Build                         | Target Architecture                           | Direct Download Link                                                                                                            | Size   |
| :---------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :----- |
| **Release APK (Recommended)** | **ARM64-v8a** (All modern Android devices)    | [⬇️ **Download radii-release.apk**](https://github.com/AnmolDotX/radii-chat/raw/main/android/release/radii-release.apk)         | ~46 MB |
| **Repository File Link**      | **ARM64-v8a** (View in GitHub repo)           | [📁 `android/release/radii-release.apk`](android/release/radii-release.apk)                                                     | ~46 MB |
| **32-Bit Legacy APK**         | **ARMeabi-v7a** (Older 32-bit Android phones) | [⬇️ **Download radii-armeabi-v7a.apk**](https://github.com/AnmolDotX/radii-chat/raw/main/android/release/radii-armeabi-v7a.apk) | ~39 MB |

### How to Install:

1. Download **[radii-release.apk](https://github.com/AnmolDotX/radii-chat/raw/main/android/release/radii-release.apk)** on your Android phone.
2. When prompted by your browser or file manager, enable **"Allow from this source"** / **"Install unknown apps"**.
3. Tap **Install** and open **Radii**.
4. Grant the requested radio permissions (Nearby Devices, Location, and Wi-Fi Direct).
5. Open Radii on two devices within 10–50 meters and watch them instantly detect each other on the Radar!

---

## ✨ Key Features

### 1. 📡 Proximity Radar Sweep

- Real-time circular radar visualizing nearby radio nodes.
- Continuous RSSI tracking with distance brackets: **Immediate** (<2m), **Near** (2–10m), and **Far** (10–50m).
- Visual signal-strength indicators and pulse sweeps.

### 2. 💬 Direct 1-on-1 & Mesh Room Chats

- **Direct Companion Chats**: Low-latency radio messaging directly between paired devices.
- **Mesh Broadcast Rooms**: Create or join ephemeral local multi-peer broadcast channels with a custom 4-digit PIN.
- **Store-and-Forward Outbox**: If a companion walks out of radio range, outgoing messages are queued locally and automatically transmitted the moment they re-enter range.
- **Delivery Receipts**: Single tick (`✓`) for sent, double tick (`✓✓`) for radio delivery, blue double tick for read receipt, and clock icon (`⏱`) for queued offline messages.

### 3. 🚀 High-Speed Peer-to-Peer File & Media Sharing

- **Zero-Internet Media Transfer**: Stream high-res photos, voice notes, and documents over Wi-Fi Direct mesh links.
- **Accept / Reject Flow**: Receiver gets a clear prompt to Accept or Decline incoming files before any transfer begins.
- **Live Chunked Progress**: Real-time progress bar with transferred and total bytes displayed.
- **Clean Controls**: Non-intrusive floating chip buttons for cancelling or retrying stalled transfers.
- **Native Document Opener**: Tap any received PDF, APK, DOC, audio, or video file to trigger the Android system chooser and open with your preferred native viewer.

### 4. 🎙 WhatsApp-Style Push-to-Talk (PTT) Voice Notes

- Dynamic input bar: Shows **Send** arrow when text is entered, and switch to a 10-second audio recorder when empty.
- Hold to record voice notes with live audio waveform animation and timer, and release to transmit over the air.

### 5. 🚨 SOS Emergency Radio Beacon

- Broadcasts a priority distress signal with GPS coordinates (if available) and an emergency message to every Radii device within radio frequency reach.

### 6. 🎨 Material Apple Modern Design System

- Curated borderless styling with soft elevation shadows.
- System-wide **Dark Mode** and **Light Mode** with live switching from `Settings > Appearance & Theme`.
- Premium `#00c20d` emerald green brand accent matching the splash screen.

---

## 🛠 Tech Stack & Architecture

- **Framework**: [Expo SDK 57](https://expo.dev) + [React Native 0.86](https://reactnative.dev) with React Compiler enabled.
- **Language**: TypeScript & Kotlin.
- **Navigation**: Expo Router (file-based routing under `src/app`).
- **Native Radio Layer (`RadiiNativeRadioModule.kt`)**:
  - **Google Nearby Connections API** (`Strategy.P2P_CLUSTER`): High-throughput encrypted socket connections, Wi-Fi Direct, and multi-peer cluster topologies.
  - **Bluetooth Low Energy (BLE)**: BLE advertiser and scanner running continuous low-power peripheral announcements.
  - **Android FileProvider**: Secure `content://` URI generation with `FLAG_GRANT_READ_URI_PERMISSION` for cross-application file viewing.
- **State Management & Persistence**: React Context (`OrbitorContext.tsx`) + `@react-native-async-storage/async-storage`.
- **Package Manager**: Exclusively `pnpm`.

---

## 💻 Developer Setup & Local Build

### Prerequisites

- **Node.js**: v18.x or v20.x
- **Package Manager**: `pnpm` (`npm install -g pnpm`)
- **Java**: JDK 17
- **Android SDK & Build Tools**: Android Studio with SDK Platform 34 / 35 and NDK configured.
- A physical Android device with Developer Mode & USB Debugging enabled (emulators lack Bluetooth/Wi-Fi Direct hardware).

### 1. Clone the Repository

```bash
git clone https://github.com/AnmolDotX/radii-chat.git
cd radii-chat
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start the Metro Development Server

For active JavaScript/TypeScript and UI development with Fast Refresh:

```bash
pnpm run start
```

Press `a` in the terminal to launch on a connected Android phone or emulator.

### 4. Run on a Connected Android Device (Debug Build)

When modifying native Kotlin code (`RadiiNativeRadioModule.kt`) or testing real radio hardware (Bluetooth & Wi-Fi Direct):

```bash
pnpm run android:device
```

This compiles the native debug APK in ~20 seconds, installs it via ADB, and immediately connects to the Metro bundler.

---

## 🚀 Development & Release Lifecycle

Until Radii is deployed on the Google Play Store, releases are distributed directly via GitHub Releases and the official static landing page.

```
┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
│ 1. Daily Development    │  ───> │ 2. Build Release APK    │  ───> │ 3. Tag & Publish        │
│                         │       │                         │       │                         │
│ • pnpm run android:device│       │ • pnpm run build:apk    │       │ • git tag v1.0.x        │
│ • Fast Refresh & Metro  │       │   <version>             │       │ • git push origin v1.0.x│
│ • Standard git commits  │       │ • Outputs to            │       │ • GitHub Release created│
│                         │       │   android/release/      │       │   in ~8s with APKs      │
└─────────────────────────┘       └─────────────────────────┘       └─────────────────────────┘
```

### Phase 1: Daily Development & Code Commits

For everyday feature development, bug fixes, and refactoring:
1. Run `pnpm run android:device` to build and test on your physical phone.
2. Code your changes with instant Fast Refresh.
3. Commit and push your code to `main` normally:
   ```bash
   git add .
   git commit -m "feat: description of changes"
   git push origin main
   ```

### Phase 2: Building a Production Release APK Locally

We build release APKs **locally** rather than on cloud CI because local Apple Silicon / workstation hardware compiles in **~28 seconds**, avoiding CI runner queues and 10+ minute build limits:

```bash
# Build with a specific version name:
pnpm run build:apk 1.0.2

# Or build using package.json version:
pnpm run build:apk
```

This command automatically:
1. Compiles the native production release binaries via Gradle with `versionName` and auto-incremented `versionCode`.
2. Synchronizes the output APKs to the repository's `android/release/` folder:
   - `radii-arm64-v8a.apk` (46 MB — modern 64-bit phones, recommended)
   - `radii-release.apk` (46 MB — primary README & landing page link)
   - `radii-armeabi-v7a.apk` (39 MB — legacy 32-bit devices)
3. Excludes the 100MB+ universal fat APK so pushes never exceed GitHub's 100 MB file limit.

### Phase 3: Publishing a Permanent GitHub Release

To publish an official release accessible by users and the landing page:

```bash
# 1. Commit and push the newly generated release APKs to main
git add .
git commit -m "release: v1.0.2"
git push origin main

# 2. Tag the release and push the tag
git tag v1.0.2
git push origin v1.0.2
```

**What happens automatically in GitHub Actions:**
- The tag triggers [`.github/workflows/build-release-apk.yml`](file:///.github/workflows/build-release-apk.yml).
- Because the APKs are already built and committed, GitHub Actions **does NOT recompile** on CI.
- In **~8 seconds**, GitHub automatically creates the **v1.0.2 Release**, attaches the APKs permanently, and generates release notes from your commits.
- Users and the landing page can immediately download the updated release binaries.

---

## 🔒 Required Android Permissions

Radii operates strictly on local device hardware without network servers. The following Android permissions are utilized:

| Permission                                                     | Purpose                                                        |
| :------------------------------------------------------------- | :------------------------------------------------------------- |
| `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` / `BLUETOOTH_ADVERTISE` | Direct device discovery and BLE mesh pings                     |
| `NEARBY_WIFI_DEVICES`                                          | Wi-Fi Direct peer-to-peer data streaming                       |
| `ACCESS_FINE_LOCATION`                                         | Required by Android OS for Bluetooth & Wi-Fi hardware scanning |
| `RECORD_AUDIO`                                                 | Push-to-Talk voice notes                                       |
| `READ_MEDIA_IMAGES` / `READ_MEDIA_AUDIO` / `READ_MEDIA_VIDEO`  | Local file attachment and native document viewing              |

---

## 📁 Repository Structure

```
radii-chat/
├── android/                   # Native Android project
│   ├── app/src/main/
│   │   ├── java/com/radii/app/
│   │   │   ├── RadiiNativeRadioModule.kt  # Custom radio driver (Nearby + BLE)
│   │   │   └── RadiiNativeRadioPackage.kt # Expo/React Native package binding
│   │   ├── res/xml/file_paths.xml         # FileProvider configuration
│   │   └── AndroidManifest.xml
│   └── release/               # Pre-compiled release APKs
│       ├── radii-release.apk
│       ├── radii-arm64-v8a.apk
│       └── radii-armeabi-v7a.apk
├── src/
│   ├── app/                   # Expo Router screens (_layout.tsx, chat/[id].tsx)
│   ├── components/
│   │   ├── chat/              # Message bubbles, PTT voice button
│   │   ├── modals/            # Media sheets, Room details, Pin modal
│   │   └── radar/             # Radar sweep & peer indicators
│   ├── context/
│   │   └── OrbitorContext.tsx # Central state machine, chunking & transport
│   ├── theme/                 # Modern material design tokens, Light/Dark mode
│   └── transport/
│       ├── NativeRadioTransport.ts # JavaScript bridge to native radio module
│       └── TransportManager.ts     # Radio packet framing & store-and-forward
└── package.json
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Built with ❤️ by [Anmol](https://babacreates.in) from [Zarasana Labs](https://zarasana.com).
