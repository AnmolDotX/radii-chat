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

| Build | Target Architecture | Direct Download Link | Size |
| :--- | :--- | :--- | :--- |
| **Release APK (Recommended)** | **ARM64-v8a** (All modern Android devices) | [⬇️ **Download radii-release.apk**](https://github.com/AnmolDotX/radii-chat/raw/main/android/release/radii-release.apk) | ~46 MB |
| **Repository File Link** | **ARM64-v8a** (View in GitHub repo) | [📁 `android/release/radii-release.apk`](android/release/radii-release.apk) | ~46 MB |
| **32-Bit Legacy APK** | **ARMeabi-v7a** (Older 32-bit Android phones) | [⬇️ **Download radii-armeabi-v7a.apk**](https://github.com/AnmolDotX/radii-chat/raw/main/android/release/radii-armeabi-v7a.apk) | ~39 MB |

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
```bash
pnpm run start
```

### 4. Run on a Connected Android Device
Ensure your phone is connected via USB and verified with `adb devices`:
```bash
npx expo run:android
```
This builds and installs the native Android app package directly onto your phone.

### 5. Build a Release APK Locally
To build a standalone production release APK without a dev client:
```bash
cd android
./gradlew assembleRelease
```
The output APKs will be generated in:
```
android/app/build/outputs/apk/release/
├── radii-arm64-v8a.apk     # 64-bit devices (modern phones)
├── radii-armeabi-v7a.apk   # 32-bit devices (legacy phones)
└── radii.apk               # Universal fat APK
```

---

## 🔒 Required Android Permissions

Radii operates strictly on local device hardware without network servers. The following Android permissions are utilized:

| Permission | Purpose |
| :--- | :--- |
| `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` / `BLUETOOTH_ADVERTISE` | Direct device discovery and BLE mesh pings |
| `NEARBY_WIFI_DEVICES` | Wi-Fi Direct peer-to-peer data streaming |
| `ACCESS_FINE_LOCATION` | Required by Android OS for Bluetooth & Wi-Fi hardware scanning |
| `RECORD_AUDIO` | Push-to-Talk voice notes |
| `READ_MEDIA_IMAGES` / `READ_MEDIA_AUDIO` / `READ_MEDIA_VIDEO` | Local file attachment and native document viewing |

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
Built with ❤️ by [Zarasana Labs](https://github.com/AnmolDotX).
