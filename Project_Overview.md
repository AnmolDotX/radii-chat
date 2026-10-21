# Radii: Comprehensive Architectural Walkthrough & Engineering Guide

> **Target Audience**: Full-Stack MERN (MongoDB, Express, React.js, Node.js) developers who have strong JavaScript/React experience but have **never worked with React Native, Expo, or Android native code (Kotlin)**.
>
> **Goal of this Document**: To provide a complete, deep-dive mental model, technical dissection, file-by-file navigation guide, and interview preparation manual for the Radii codebase. After reading this document, you should understand every design decision, every hardware interaction, and be able to answer any interview question about this project with senior-level confidence.

---

## Table of Contents

1. [Executive Summary: What is Radii?](#1-executive-summary-what-is-radii)
2. [The Mental Bridge: MERN Stack (React.js) to React Native & Mobile](#2-the-mental-bridge-mern-stack-reactjs-to-react-native--mobile)
   - 2.1 Web DOM vs Mobile Primitives
   - 2.2 Styling: CSS vs StyleSheet & Yoga Flexbox
   - 2.3 Bundlers: Vite/Webpack vs Metro & Hermes Engine
   - 2.4 Routing: React Router DOM vs Expo Router (File-Based Navigation)
   - 2.5 Storage: `localStorage` vs `@react-native-async-storage/async-storage`
   - 2.6 The React Native Threading Architecture (UI, JS, Shadow, Native Bridge/JSI)
3. [The Native Android Layer: Kotlin & Radio Hardware Demystified](#3-the-native-android-layer-kotlin--radio-hardware-demystified)
   - 3.1 What is Kotlin and Why Do We Need It Here?
   - 3.2 How React Native Communicates with Kotlin (The Native Module Bridge)
   - 3.3 Bluetooth Low Energy (BLE): Advertising, Scanning, and GATT
   - 3.4 Bluetooth Classic (RFCOMM): High-Throughput Streams
   - 3.5 Local Wi-Fi & Hotspot UDP Sockets (Unicast & Subnet Broadcast)
   - 3.6 Hardware Audio Recording & Playback (`MediaRecorder` & `MediaPlayer`)
   - 3.7 Android File System & `FileProvider` (Secure Native File Sharing)
   - 3.8 Android Runtime Permissions Matrix
4. [High-Level System Architecture & Multi-Tier Transport Flow](#4-high-level-system-architecture--multi-tier-transport-flow)
   - 4.1 Architectural Block Diagram
   - 4.2 Multi-Tier Transport Failover Strategy
   - 4.3 The Chunking & Reassembly Protocol (Sliding Window ARQ)
   - 4.4 Store-and-Forward Outbox Architecture
   - 4.5 Ephemeral Mesh Broadcast Rooms (PIN-Protected)
   - 4.6 SOS Emergency Distress Beacon
5. [Repository Structure & Complete File-by-File Breakdown](#5-repository-structure--complete-file-by-file-breakdown)
   - 5.1 Root Configuration Files
   - 5.2 Android Native Code (`android/`)
   - 5.3 Core Domain Logic (`src/core/`)
   - 5.4 Hardware Transport Bridge (`src/transport/`)
   - 5.5 State Machine Central: `OrbitorContext.tsx` (`src/context/`)
   - 5.6 Expo Router Screens (`src/app/` & `src/screens/`)
   - 5.7 UI Components & Modals (`src/components/`)
   - 5.8 Theme Engine & Design Tokens (`src/theme/`)
   - 5.9 Utilities & Permissions (`src/utils/`)
6. [End-to-End Business & Data Execution Flows](#6-end-to-end-business--data-execution-flows)
   - Flow 1: App Boot, Identity Initialization & Radio Startup
   - Flow 2: Peer Discovery & Dynamic Radar Visualization
   - Flow 3: Connection Handshake & Direct Radio Chat
   - Flow 4: Store-and-Forward Outbox (Walking Out of Range and Back)
   - Flow 5: High-Speed Peer-to-Peer File & Voice Note Transfer
   - Flow 6: Mesh Broadcast Room Creation & PIN Authorization
   - Flow 7: SOS Distress Beacon Broadcast
7. [Developer Setup, Building & Debugging](#7-developer-setup-building--debugging)
8. [Comprehensive Interview Preparation Guide (15+ Technical Q&As)](#8-comprehensive-interview-preparation-guide-15-technical-qas)

---

## 1. Executive Summary: What is Radii?

### The Core Problem
Modern mobile communication apps (WhatsApp, Telegram, Signal) are 100% dependent on centralized servers, telecom infrastructure, cellular SIM cards, and active internet connectivity. In scenarios such as:
- Dense music festivals, sports stadiums, and college campuses (where cell towers saturate),
- Hiking, trekking, or rural areas (where zero signal exists),
- Natural disasters (where power grids and fiber lines collapse),
- Total network blackouts,

traditional chat applications completely fail.

### The Solution: Radii
**Radii** is a **zero-internet, decentralized, peer-to-peer radio frequency (RF) mesh chat and file sharing application** built exclusively for Android. It transforms consumer smartphones into standalone radio transceivers. 

Two or more devices running Radii can:
1. **Discover each other passively** within a 10m–50m radius using Bluetooth Low Energy (BLE) advertisements.
2. **Visualize physical proximity** on a circular real-time Radar screen using Received Signal Strength Indication (RSSI).
3. **Exchange end-to-end text messages** over Bluetooth Classic (RFCOMM sockets) or direct UDP packets without any internet router.
4. **Transfer photos, documents, APKs, and Push-to-Talk (PTT) voice notes** using high-speed Wi-Fi Direct / Local Hotspot UDP streaming.
5. **Queue messages in an offline Store-and-Forward Outbox**: If your companion steps out of radio range, outgoing messages stay queued locally and automatically flush the instant their radio signal reappears.
6. **Form PIN-protected Mesh Broadcast Channels**: Ephemeral group rooms where anyone within radio reach can enter a 4-digit code to broadcast and receive messages.
7. **Broadcast an SOS Distress Beacon**: High-priority broadcast alerting all nearby devices during emergencies.

---

## 2. The Mental Bridge: MERN Stack (React.js) to React Native & Mobile

If you come from React.js (web), your brain is wired to think in terms of HTML DOM nodes, CSS stylesheets, browser window events, and HTTP/WebSocket communication with Node.js servers. 

Here is how each concept translates to React Native and mobile:

### 2.1 Web DOM vs Mobile Primitives

In standard React.js, React renders virtual DOM nodes that ReactDOM converts into actual browser HTML tags (`<div>`, `<span>`, `<p>`, `<img>`, `<input>`, `<button>`).

In React Native, **there is NO browser and NO HTML DOM**. Instead, React Native components compile directly to native Android UI widgets (e.g., `android.view.ViewGroup`, `android.widget.TextView`, `android.widget.ImageView`).

| React.js (Web DOM) | React Native (Mobile) | What It Actually Is Under the Hood |
| :--- | :--- | :--- |
| `<div>`, `<section>`, `<main>` | `<View>` | An Android `ViewGroup` / iOS `UIView`. The fundamental building block for layout and containers. |
| `<p>`, `<h1>`–`<h6>`, `<span>` | `<Text>` | An Android `TextView` / iOS `UILabel`. **Crucial Rule**: In React Native, raw text MUST be wrapped in a `<Text>` component. Plain strings inside `<View>` will crash the app. |
| `<button>`, `<a href="...">` | `<Pressable>` or `<TouchableOpacity>` | Touch responder wrappers that capture gestures, pointer down/up, and apply native ripple effects or opacity changes. |
| `<img src="...">` | `<Image>` (or `expo-image`) | Native image renderers that support hardware caching, bitmap decoding, and blurhashes. |
| `<input type="text">`, `<textarea>` | `<TextInput>` | An Android `EditText`. |
| `<div style={{ overflow: 'scroll' }}>` | `<ScrollView>` or `<FlatList>` | In React Native, `<View>` does **not** scroll by default. You must explicitly use `<ScrollView>` (for bounded content) or `<FlatList>` (virtualized recycling for lists). |
| Fixed headers under notch/pill | `<SafeAreaView>` (from `react-native-safe-area-context`) | Calculates the phone’s status bar height, notch, and bottom navigation bar insets so UI doesn't clip into hardware cutouts. |

### 2.2 Styling: CSS vs StyleSheet & Yoga Flexbox

In React.js, you write CSS classes, CSS modules, or Tailwind utilities.

In React Native:
1. **No CSS Files or Cascading**: Styles do not cascade down the component tree. A style applied to a `<View>` does not automatically style text inside it (except for text styles nested inside another `<Text>`).
2. **StyleSheet API**: Styles are written as JavaScript objects using `StyleSheet.create({ ... })`. Property names use `camelCase` (e.g., `backgroundColor`, `fontSize`, `paddingHorizontal`).
3. **Yoga Layout Engine**: React Native uses Meta's **Yoga** engine, a C++ implementation of Flexbox that runs on mobile.
   - **Key difference from Web**: On the web, `display: flex` defaults to `flexDirection: 'row'`. In React Native, every `<View>` is already `display: 'flex'`, and **`flexDirection` defaults to `'column'`** (vertical stacking for portrait phone screens).
   - **No percentage strings everywhere**: Dimensions are dimensionless numbers representing density-independent pixels (dp on Android, pt on iOS).

### 2.3 Bundlers: Vite/Webpack vs Metro & Hermes Engine

- **Web (Vite/Webpack)**: Compiles TypeScript/JSX into JavaScript chunks that a browser engine (V8, JavaScriptCore, Gecko) executes alongside HTML and CSS files.
- **React Native (Metro)**: Metro is a specialized JavaScript bundler for React Native. It resolves dependencies, transforms TypeScript/JSX via Babel/React Compiler, and produces a single monolithic JS bundle.
- **Hermes JavaScript Engine**: Instead of running a heavyweight browser JS engine, modern React Native apps use **Hermes**, a lightweight JS engine developed by Meta specifically optimized for Android. Metro compiles JS source code into **Hermes Bytecode (HBC)** ahead of time during the APK build process. This results in instant startup time, lower memory consumption, and smaller APK size.

### 2.4 Routing: React Router DOM vs Expo Router (File-Based Navigation)

In MERN, you typically use `react-router-dom`:
```jsx
// React.js Web
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/chat/:id" element={<ChatScreen />} />
  </Routes>
</BrowserRouter>
```

In Radii, we use **Expo Router** (built on top of `react-navigation`):
- Navigation is **file-based** (identical to Next.js App Router).
- Every file in `src/app/` represents a mobile screen route:
  - `src/app/index.tsx` ➔ Route `/` (Home Screen / Pager Shell)
  - `src/app/chat/[id].tsx` ➔ Route `/chat/:id` (Dynamic route with param `id`)
  - `src/app/settings.tsx` ➔ Route `/settings`
  - `src/app/_layout.tsx` ➔ The Root Navigator (Stack Navigator configuring screen transitions, card animations, and status bars).
- Screen transitions use physical mobile navigation paradigms: native stack pushes (sliding card from right), modal presentation sheets (sliding up from bottom), and hardware back button handling.
- Programmatic navigation uses `useRouter()`:
  ```ts
  import { useRouter } from 'expo-router';
  const router = useRouter();
  router.push(`/chat/${peerId}`);
  router.back();
  ```

### 2.5 Storage: `localStorage` vs `@react-native-async-storage/async-storage`

On the web, you use synchronous `window.localStorage.setItem(key, value)`.
In React Native:
- There is no `window` or `document`.
- Storage is asynchronous: `await AsyncStorage.setItem(key, stringValue)`.
- On Android, `AsyncStorage` persists key-value pairs directly to a local **SQLite database** or RocksDB inside the app's private sandbox directory (`/data/data/com.radii.app/databases/`).

### 2.6 The React Native Threading Architecture

Understanding how threads work in React Native is critical for any technical interview. React Native runs on **three primary threads**:

```
+---------------------------------------------------------------------------------+
|                                 REACT NATIVE                                    |
|                                                                                 |
|  1. JavaScript Thread (Hermes Engine)                                           |
|     - Runs your React components, hooks (useEffect, useState),                  |
|       state machine logic (OrbitorContext.tsx), and timers.                     |
|                                                                                 |
|                                      |                                          |
|                  React Native Bridge / JSI (JavaScript Interface)               |
|                                      |                                          |
|                                                                                 |
|  2. Shadow / Layout Thread (Yoga C++ Engine)                                    |
|     - Computes Flexbox styles (padding, margins, width, height)                 |
|       into concrete screen coordinates (dp).                                    |
|                                                                                 |
|                                      |                                          |
|  3. Main / UI Thread (Android Platform)                                         |
|     - Renders actual Android Views (buttons, text, layout).                     |
|     - Dispatches user touch gestures and 60fps/120fps screen animations.        |
|                                                                                 |
|  4. Native Worker Background Threads (Kotlin coroutines & Java threads)         |
|     - RadiiNativeRadioModule.kt spawns background threads for continuous        |
|       UDP socket listening, BLE packet parsing, and RFCOMM streaming.           |
+---------------------------------------------------------------------------------+
```

#### Why this matters in Radii:
If you do heavy radio packet parsing on the **JavaScript Thread**, UI scrolling or animations can stutter. That is why in `RadiiNativeRadioModule.kt`, all network socket I/O, audio encoding, file hashing, and media saving are executed on **native background daemon threads** (`thread(start = true, isDaemon = true)`), sending only clean, parsed JSON events to the JS thread via `DeviceEventManagerModule`.

---

## 3. The Native Android Layer: Kotlin & Radio Hardware Demystified

This is the most critical part of the codebase. Radii cannot function as a web app or as a plain React Native app because **no web browser or standard cross-platform library gives you simultaneous access to raw BLE Peripheral Advertising + BLE Scanning + RFCOMM Classic Sockets + Multicast UDP sockets**.

We wrote our own custom Android radio driver in Kotlin:
`android/app/src/main/java/com/radii/app/RadiiNativeRadioModule.kt` (1,744 lines).

### 3.1 What is Kotlin and Why Do We Need It Here?

- **Kotlin** is the modern, type-safe, expressive official programming language for Android (fully interoperable with Java).
- Android's hardware APIs for Bluetooth, Wi-Fi Direct, audio recording, and notification channels are native Android SDK classes.
- React Native allows you to write custom native code in Kotlin and expose it to JavaScript as a **Native Module**.

### 3.2 How React Native Communicates with Kotlin (The Native Module Bridge)

Let's look at how the connection is wired:

1. **The Native Module Class**:
   In `RadiiNativeRadioModule.kt`, the class extends `ReactContextBaseJavaModule`:
   ```kotlin
   package com.radii.app

   class RadiiNativeRadioModule(private val reactContext: ReactApplicationContext) :
       ReactContextBaseJavaModule(reactContext), ActivityEventListener {
       
       // 1. The name JS will use to find this module
       override fun getName(): String = "RadiiNativeRadio"
   ```

2. **Exposing Methods to JavaScript (`@ReactMethod`)**:
   Any Kotlin method marked with `@ReactMethod` can be invoked asynchronously from JavaScript. Methods receive JS arguments and return results via a `com.facebook.react.bridge.Promise`:
   ```kotlin
   @ReactMethod
   fun sendUdpMessage(ipAddress: String, messageJson: String, promise: Promise) {
       thread(start = true, isDaemon = true) {
           try {
               val socket = getSharedSendSocket()
               val bytes = messageJson.toByteArray(Charsets.UTF_8)
               val targetAddr = InetAddress.getByName(ipAddress)
               val packet = DatagramPacket(bytes, bytes.size, targetAddr, UDP_PORT)
               socket.send(packet)
               promise.resolve(true) // Resolves the JS Promise with true
           } catch (e: Exception) {
               promise.resolve(false) // Or rejects with promise.reject(...)
           }
       }
   }
   ```

3. **Packaging the Module**:
   `RadiiNativeRadioPackage.kt` bundles the module into React Native's module registry:
   ```kotlin
   class RadiiNativeRadioPackage : ReactPackage {
       override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
           return listOf(RadiiNativeRadioModule(reactContext))
       }
       override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
   }
   ```

4. **Registering in Application**:
   In `MainApplication.kt`, the package is registered into the `PackageList`:
   ```kotlin
   PackageList(this).packages.apply {
       add(RadiiNativeRadioPackage())
   }
   ```

5. **Consuming in JavaScript / TypeScript**:
   In `src/transport/NativeRadioTransport.ts`:
   ```typescript
   import { NativeModules, NativeEventEmitter } from 'react-native';

   // Access the exported Kotlin module
   const { RadiiNativeRadio } = NativeModules;

   // Call the Kotlin method like a regular async JS function!
   const success = await RadiiNativeRadio.sendUdpMessage('192.168.43.105', jsonString);
   ```

6. **Sending Events from Kotlin to JavaScript (Push Notifications / Discovery)**:
   When the native radio receives a packet over the air, it pushes an event to JavaScript:
   ```kotlin
   // Kotlin sends:
   private fun sendEvent(eventName: String, params: WritableMap?) {
       reactContext
           .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
           ?.emit(eventName, params)
   }

   // Dispatches "onPeerDiscovered" or "onMessageReceived"
   sendEvent("onPeerDiscovered", peerMap)
   ```
   In TypeScript:
   ```typescript
   const radioEmitter = new NativeEventEmitter(RadiiNativeRadio);
   radioEmitter.addListener('onPeerDiscovered', (rawPeer) => {
       console.log('Discovered nearby radio peer:', rawPeer);
   });
   ```

---

### 3.3 Bluetooth Low Energy (BLE): Advertising, Scanning, and GATT

BLE is designed for ultra-low power consumption. In Radii, BLE acts as the **discovery and heartbeat channel**.

#### A. BLE Peripheral Advertising (`startAdvertising`)
A phone running Radii acts as a **BLE Peripheral**. It broadcasts 31-byte advertisement packets into the air every few milliseconds:
- **Service UUID**: `0000fd11-0000-1000-8000-00805f9b34fb` (Radii reserved UUID).
- **Manufacturer Data**: Contains `RADII_COMPANY_ID` (`0x11FD`), protocol version (`0x01`), and the user's 6-character short peer ID (e.g. `peer_a1b2c3`).
- **Scan Response Packet**: Advertises the user's display name (e.g. "Anmol").

#### B. BLE Central Scanning (`startScanning`)
Simultaneously, the phone acts as a **BLE Central**. It turns on its BLE scanner using `ScanSettings.SCAN_MODE_LOW_LATENCY` to detect other Radii devices.

#### C. RSSI & Physical Distance Calculation
Every BLE packet received comes with an **RSSI (Received Signal Strength Indication)** value in decibels (dBm):
- `-30 dBm to -55 dBm`: **Immediate proximity** (< 2 meters)
- `-56 dBm to -72 dBm`: **Near** (2 – 10 meters)
- `-73 dBm to -85 dBm`: **Mid** (10 – 25 meters)
- `< -85 dBm`: **Far / Edge of radio range** (25 – 50 meters)

The native module computes this bracket and emits it to JavaScript to draw the circles on the Radar screen!

#### D. GATT Server (Generic Attribute Profile)
The module hosts a local GATT server with a dedicated Characteristic (`MESSAGE_CHAR_UUID`). For short text messages (<500 bytes) or handshake control packets, a peer can directly write to this GATT characteristic.

---

### 3.4 Bluetooth Classic (RFCOMM): High-Throughput Streams

BLE is limited to small packet payloads (~512 bytes MTU). For sending voice notes, images, or large message batches, Radii uses **Bluetooth Classic RFCOMM sockets**:
- **Listening**: An `rfcommServerSocket` runs continuously on an Android background thread using `listenUsingRfcommWithServiceRecord("RadiiMesh", SERVICE_UUID)`.
- **Connecting**: When sending a message to a peer's Bluetooth MAC address, `device.createRfcommSocketToServiceRecord(SERVICE_UUID)` establishes a direct 2 Mbps socket stream.
- **Framing**: Messages are framed with an integer length prefix:
  ```kotlin
  val dos = DataOutputStream(socket.outputStream)
  dos.writeInt(bytes.size) // 4 bytes indicating packet size
  dos.write(bytes)         // Actual JSON payload
  dos.flush()
  ```

---

### 3.5 Local Wi-Fi & Hotspot UDP Sockets (Unicast & Subnet Broadcast)

When phones are connected to the same Wi-Fi router (e.g. a college hostel, office, or coffee shop) OR when one phone turns on a portable hotspot and others connect:
- **No Internet Required**: Data does not leave the local router.
- **UDP Port**: `41234`.
- **Multicast Lock**: Android puts Wi-Fi chips into low-power sleep mode by default, which filters out broadcast UDP packets. Radii acquires a native `WifiManager.MulticastLock`:
  ```kotlin
  multicastLock = wifiManager.createMulticastLock("radii_udp_lock").apply {
      setReferenceCounted(true)
      acquire()
  }
  ```
- **Subnet Broadcast**: The native module inspects the phone's network interfaces (`NetworkInterface.getNetworkInterfaces()`), finds the assigned IPv4 address (e.g., `192.168.43.45`), calculates the subnet broadcast address (e.g., `192.168.43.255`), and blasts datagrams across the entire local network!

---

### 3.6 Hardware Audio Recording & Playback (`MediaRecorder` & `MediaPlayer`)

For Push-to-Talk (PTT) voice messages:
- `startAudioRecording()` activates Android's hardware `MediaRecorder`:
  - Audio Source: `MediaRecorder.AudioSource.MIC`
  - Output Format: `MPEG_4`
  - Encoder: `AAC` (64 kbps, 44.1 kHz sampling rate)
  - Output File: Cached in the app's internal sandbox: `cacheDir/voice_notes/voice_<id>.m4a`.
- `stopAudioRecording()` stops the recorder, reads the `.m4a` file, encodes it into Base64, and hands it to JavaScript to chunk and transmit over the air.
- `playAudio()` configures an Android `MediaPlayer` instance to play `.m4a` voice notes directly from local files.

---

### 3.7 Android File System & `FileProvider` (Secure Native File Sharing)

When a peer sends you an APK, PDF, or photo over the air:
1. The chunks arrive over UDP/RFCOMM and are reassembled in memory.
2. `saveMediaBase64()` writes the decoded bytes into the app's internal cache: `cacheDir/media/<filename>`.
3. To let the user open the file in another app (like Chrome, Google Drive PDF viewer, or the Android Package Installer for APKs), Android strictly forbids passing raw `file://` paths (which throws a `FileUriExposedException` on Android 7.0+).
4. Radii configures an **Android FileProvider** in `AndroidManifest.xml`:
   ```xml
   <provider
       android:name="androidx.core.content.FileProvider"
       android:authorities="${applicationId}.fileprovider"
       android:exported="false"
       android:grantUriPermissions="true">
       <meta-data
           android:name="android.support.FILE_PROVIDER_PATHS"
           android:resource="@xml/file_paths" />
   </provider>
   ```
5. `openFileWithIntent()` creates a secure `content://com.radii.app.fileprovider/...` URI, grants temporary read permission (`FLAG_GRANT_READ_URI_PERMISSION`), and opens the Android native system application chooser!

---

### 3.8 Android Runtime Permissions Matrix

Radii requires several sensitive hardware permissions. Understanding why each is required is a classic interview question:

| Permission in `AndroidManifest.xml` | Why Android Mandates It |
| :--- | :--- |
| `BLUETOOTH_SCAN` | Android 12+ (API 31+): Required to search for nearby Bluetooth devices. |
| `BLUETOOTH_ADVERTISE` | Android 12+: Required to turn the phone into a BLE peripheral beacon. |
| `BLUETOOTH_CONNECT` | Android 12+: Required to open RFCOMM sockets or connect GATT to paired devices. |
| `ACCESS_FINE_LOCATION` | Required by the Android OS for Bluetooth/Wi-Fi scanning because listening to radio beacons theoretically allows locating a device relative to known beacons. |
| `NEARBY_WIFI_DEVICES` | Android 13+ (API 33+): Required for Wi-Fi Direct and local peer discovery without location tracking. |
| `CHANGE_WIFI_MULTICAST_STATE` | Required to receive UDP broadcast packets on the local subnet. |
| `RECORD_AUDIO` | Required for the microphone during Push-to-Talk (PTT) voice messages. |
| `POST_NOTIFICATIONS` | Android 13+: Required to post notification shade alerts when messages arrive while the app is in the background. |
| `READ_MEDIA_IMAGES` / `READ_MEDIA_AUDIO` / `READ_MEDIA_VIDEO` | Android 13+: Required to pick files from device storage to share over the mesh. |

---

## 4. High-Level System Architecture & Multi-Tier Transport Flow

### 4.1 Architectural Block Diagram

```
+---------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER                                  |
|  Expo Router Screens:                                                                 |
|    - RadarScreen.tsx (Proximity Radar & Peer List)                                    |
|    - ChatsScreen.tsx (Direct Chats & Mesh Channels)                                   |
|    - chat/[id].tsx (Chat Room, Message Bubbles, PTT Voice Button)                    |
|    - SettingsScreen.tsx (Identity & Permissions Sheet)                                |
|    - FlingScreen.tsx (APK & File Drops)                                               |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                APPLICATION STATE MACHINE                              |
|  OrbitorContext.tsx (3,660+ lines React Context):                                     |
|    - Local User Profile (`peer_<6charId>`)                                            |
|    - Peer Discovery Store & RSSI distance brackets                                    |
|    - Conversation Message Stores (in-memory + AsyncStorage SQLite cache)              |
|    - Connection Handshake State Machine (idle -> waiting -> accepted)                 |
|    - Chunking & Sliding Window Protocol (Media transfers)                             |
|    - Store-and-Forward Outbox Dispatcher                                              |
|    - Mesh Room Announcement & PIN Sync State                                          |
+---------------------------------------------------------------------------------------+
                     |                                           |
                     v                                           v
+--------------------------------------+   +--------------------------------------------+
|         CORE SUBSYSTEMS              |   |             TRANSPORT ADAPTER              |
|  - identity.ts (Profile Generation)  |   |  NativeRadioTransport.ts                   |
|  - outbox.ts (Store-and-Forward)     |   |  TransportManager.ts                       |
|  - entitlements/ (Feature Gates)     |   |  - Peer caching & MAC/IP resolution        |
+--------------------------------------+   |  - Multi-tier message routing              |
                                           +--------------------------------------------+
                                                                 |
                                                                 v
+---------------------------------------------------------------------------------------+
|                             NATIVE BRIDGE INTERFACE (JSI)                             |
|  NativeModules.RadiiNativeRadio <----> DeviceEventManagerModule (EventEmitter)         |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                               KOTLIN DRIVER MODULE                                    |
|  RadiiNativeRadioModule.kt (1,744 lines):                                             |
|  - BLE Advertiser (0x11FD) & Scanner (LOW_LATENCY)                                    |
|  - Bluetooth Classic RFCOMM Server & Client Sockets                                   |
|  - UDP Datagram Sockets (Port 41234, Unicast + MulticastLock Subnet Broadcast)        |
|  - Hardware MediaRecorder (AAC) & MediaPlayer                                         |
|  - FileProvider content:// Intent Dispatcher                                          |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                  PHYSICAL HARDWARE                                    |
|  Bluetooth 5.x / BLE Chipset  |  Wi-Fi 802.11 b/g/n/ac/ax Chipset  |  Microphone/Storage |
+---------------------------------------------------------------------------------------+
```

---

### 4.2 Multi-Tier Transport Failover Strategy

When you tap **Send** in a chat with a companion, how does Radii decide whether to use Wi-Fi, Bluetooth Classic, or BLE?

In `src/transport/NativeRadioTransport.ts`, the `sendPacket` method executes an **intelligent 7-stage failover ladder**:

```
                              [ SEND PACKET ]
                                     |
               Is target 'broadcast' or a Mesh Room packet?
                                 /       \
                             YES          NO
                             /              \
         [Broadcast via UDP Subnet]    Does peer have known IP?
         [Iterate Discovered Peers]          /          \
         [Send via RFCOMM & BLE]          YES            NO
                                          /                \
                             [Try UDP Unicast]      Does peer have MAC?
                                (Direct IP)                /      \
                                     |                   YES       NO
                                Did it deliver?          /           \
                                 /       \       [Try RFCOMM Socket]  [Fallback UDP]
                             YES          NO      (2 Mbps Stream)
                             /              \            |
                        [SUCCESS]     [Fallback to    Did it deliver?
                                       Bluetooth]       /       \
                                                     YES         NO
                                                     /             \
                                                [SUCCESS]   Packet <= 500B?
                                                               /       \
                                                           YES          NO
                                                           /              \
                                                  [Try BLE GATT]   [Subnet UDP]
                                                    (Write Char)
```

1. **Broadcast / Room Packets**: Blasted over UDP subnet broadcast to every device connected to the local Wi-Fi / hotspot, and repeated over BLE/RFCOMM to every paired node.
2. **Direct UDP Unicast**: If the peer's local IP address (e.g. `192.168.43.105`) is known, a direct UDP packet is sent to port `41234`. This is lightning fast (<5ms latency).
3. **Bluetooth Classic RFCOMM**: If no IP exists or UDP fails, Radii attempts an RFCOMM socket connection using the peer's Bluetooth MAC address.
4. **BLE GATT Characteristic Write**: If RFCOMM fails and the payload is small (<= 500 bytes), Radii writes directly to the peer's BLE GATT characteristic.
5. **Subnet Fallback**: If still undelivered, it broadcasts to the subnet as a last-resort mesh beacon.

---

### 4.3 The Chunking & Reassembly Protocol (Sliding Window ARQ)

Wireless radio networks (especially Bluetooth and UDP) have strict payload limits and drop packets under radio interference. You cannot send a 5 MB photo or an audio voice note in a single packet.

Radii implements a **custom chunking and selective repeat Automatic Repeat reQuest (ARQ) protocol** inside `src/context/OrbitorContext.tsx`:

#### Step 1: Handshake (`MEDIA_TRANSFER_REQUEST`)
The sender transmits metadata:
```json
{
  "type": "MEDIA_TRANSFER_REQUEST",
  "transferId": "xfer_1729501234",
  "transferType": "image",
  "fileName": "photo_camping.jpg",
  "fileSizeBytes": 450000,
  "mimeType": "image/jpeg",
  "totalChunks": 45
}
```

#### Step 2: Receiver Prompt (`MEDIA_TRANSFER_ACCEPT`)
The receiver sees an **Accept / Decline** card in their chat bubble. If the receiver taps **Accept**, an acceptance packet is sent back:
```json
{
  "type": "MEDIA_TRANSFER_ACCEPT",
  "transferId": "xfer_1729501234"
}
```

#### Step 3: Chunk Streaming (`MEDIA_PAYLOAD_CHUNK`)
The sender slices the Base64 data into 10 KB chunks and streams them sequentially:
```json
{
  "type": "MEDIA_PAYLOAD_CHUNK",
  "transferId": "xfer_1729501234",
  "chunkIndex": 0,
  "totalChunks": 45,
  "chunkData": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```
Both sender and receiver update an animated progress bar (`transferProgress = chunkIndex / totalChunks`).

#### Step 4: End of Stream & Selective Repeat (`MEDIA_STREAM_END` & `MEDIA_REQUEST_MISSING`)
When the sender finishes sending all chunks, it sends:
```json
{
  "type": "MEDIA_STREAM_END",
  "transferId": "xfer_1729501234",
  "totalChunks": 45
}
```
The receiver checks its in-memory chunk map. If chunks `[12, 17, 34]` were lost in radio transit, the receiver replies with:
```json
{
  "type": "MEDIA_REQUEST_MISSING",
  "transferId": "xfer_1729501234",
  "missingIndices": [12, 17, 34]
}
```
The sender re-transmits **only** those missing chunks!

#### Step 5: Assembly & Completion (`MEDIA_TRANSFER_COMPLETE`)
Once all chunks are present, the receiver concatenates the chunks, calls native `saveMediaBase64()`, writes the file to disk, and emits `MEDIA_TRANSFER_COMPLETE`.

---

### 4.4 Store-and-Forward Outbox Architecture

When you're at a festival or trekking, your friend might wander 80 meters away behind a rock or tent. They are temporarily out of radio range.

In traditional apps, the send fails or hangs forever.
In Radii, the **Store-and-Forward Outbox** (`src/core/outbox.ts`) handles this:
1. When `sendMessage()` fails to deliver because the peer is unreachable, the message is tagged with status `'queued_offline'`.
2. The message is pushed to the `outbox` queue and saved to `AsyncStorage`.
3. In the UI, a clock icon (`⏱`) appears on the message bubble, and an **Outbox Banner** displays: *"1 message queued for when companion enters radio range"*.
4. When the companion walks back within 50 meters, the BLE scanner detects their `onPeerDiscovered` packet.
5. `OrbitorContext` immediately flushes the outbox queue, re-attempts transmission, updates the status to `'delivered'` (`✓✓`), and clears the outbox item!

---

### 4.5 Ephemeral Mesh Broadcast Rooms (PIN-Protected)

In addition to 1-on-1 direct chats, Radii supports **Local Event Rooms**:
- Anyone can create a room with a custom 4-digit PIN (e.g. `Room #8821`, "Basecamp Trekker Mesh").
- The host advertises the room via `ROOM_ANNOUNCE` packets over local broadcast.
- Nearby devices discover the room and display it in their **Active Rooms** list.
- To join, users enter the 4-digit PIN. The app validates the PIN locally against the room's verification hash without touching any external server.
- Once joined, all messages sent to `room_8821` are broadcast to all peers listening on that room channel.

---

### 4.6 SOS Emergency Distress Beacon

If a user triggers the **SOS Emergency Beacon**:
1. The app immediately formats a high-priority `SOSAlert` packet.
2. It acquires current GPS coordinates (if location service is available).
3. The packet is blasted across **every active radio interface** (UDP Subnet Broadcast + BLE Advertisements + RFCOMM connections).
4. Every Radii phone within radio reach receives the SOS, triggers a high-priority vibration pattern (`longArrayOf(0, 250, 150, 250)`), displays an emergency red banner, and shows the sender's name and distance!

---

## 5. Repository Structure & Complete File-by-File Breakdown

Here is your roadmap to navigate the entire codebase:

```
radii/
├── android/                               # Native Android project
│   ├── app/
│   │   ├── build.gradle                   # Android build config, SDK 35, release APK sync
│   │   └── src/main/
│   │       ├── AndroidManifest.xml        # Hardware permissions, FileProvider, activities
│   │       ├── java/com/radii/app/
│   │       │   ├── MainActivity.kt        # Entry Android Activity (boots React root view)
│   │       │   ├── MainApplication.kt     # Registers native packages & New Architecture
│   │       │   ├── RadiiNativeRadioModule.kt # 1,744 lines: BLE, RFCOMM, UDP, Media, Intent
│   │       │   └── RadiiNativeRadioPackage.kt # Exports RadiiNativeRadioModule to React Native
│   │       └── res/xml/file_paths.xml     # Internal cache paths exposed via FileProvider
│   └── release/                           # Pre-compiled signed release APKs
├── src/
│   ├── app/                               # Expo Router Screens (Navigation routes)
│   │   ├── _layout.tsx                    # Root stack navigator, theme & context provider
│   │   ├── index.tsx                      # Mounts PagerAppShell
│   │   ├── settings.tsx                   # Standalone settings route
│   │   └── chat/
│   │       └── [id].tsx                   # Chat screen (direct companion & room mesh)
│   ├── components/                        # Reusable UI widgets
│   │   ├── PagerAppShell.tsx              # Native 120fps hardware swipe pager for tabs
│   │   ├── chat/
│   │   │   ├── MessageBubble.tsx          # Chat bubbles, media cards, delivery ticks
│   │   │   └── PTTVoiceButton.tsx         # WhatsApp-style Push-to-Talk voice recorder button
│   │   ├── common/
│   │   │   ├── ActionIcons.tsx            # SVG / vector action icon helpers
│   │   │   ├── Badge.tsx                  # Status pill badges (ONLINE, NEAR, BLE, MESH)
│   │   │   ├── OutboxNotice.tsx           # Floating banner for pending offline outbox items
│   │   │   └── PeerAvatar.tsx             # Seed-based deterministic user avatars
│   │   ├── modals/                        # Interactive sheets & dialogs
│   │   │   ├── ConnectPeerDialog.tsx      # Pair / handshake dialog
│   │   │   ├── ConnectionRequestModal.tsx # Incoming connection prompt with verify code
│   │   │   ├── FullscreenMediaModal.tsx   # Fullscreen photo & document viewer
│   │   │   ├── JoinRoomPinModal.tsx       # 4-digit PIN entry sheet for rooms
│   │   │   ├── MediaAttachmentSheet.tsx   # Image picker & document picker trigger
│   │   │   ├── PeerDetailSheet.tsx        # Companion profile & connection inspector
│   │   │   ├── PermissionsManagerSheet.tsx# Real-time toggle sheet for OS permissions
│   │   │   ├── ProfileSetupModal.tsx      # First-launch username & avatar setup
│   │   │   ├── RadioPermissionModal.tsx   # Warning modal when Bluetooth/Location is off
│   │   │   ├── RoomDetailSheet.tsx        # Room members, code, and leave options
│   │   │   ├── RoomsModal.tsx             # Room browser & creator
│   │   │   ├── ShareApkModal.tsx          # Offline APK sharing beacon modal
│   │   │   ├── SOSModal.tsx               # Emergency SOS broadcast trigger
│   │   │   └── ThemeSelectionSheet.tsx    # Dark / Light / System theme chooser
│   │   └── radar/
│   │       ├── RadarSweep.tsx             # Circular canvas radar with sweep animation
│   │       └── RadioPillBar.tsx           # Live status bar showing active radios (BLE, UDP)
│   ├── context/
│   │   ├── OrbitorContext.tsx             # Central state machine (3,660 lines)
│   │   └── index.ts
│   ├── core/
│   │   ├── identity.ts                    # Device ID generation, persistent user profile
│   │   ├── outbox.ts                      # Store-and-forward outbox queue manager
│   │   ├── types.ts                       # TypeScript interfaces (Peer, Message, Room, etc.)
│   │   └── index.ts
│   ├── entitlements/
│   │   └── EntitlementManager.ts          # Feature gatekeeper for Orbitor Plus trials
│   ├── hooks/
│   │   ├── use-color-scheme.ts            # Detects OS system dark mode
│   │   └── useSwipeNavigation.ts          # Gesture navigation utilities
│   ├── screens/                           # Screen content components
│   │   ├── ChatsScreen.tsx                # Chat tab: direct chats list & mesh channels
│   │   ├── FlingScreen.tsx                # File drop tab: quick APK beam & media sharing
│   │   ├── RadarScreen.tsx                # Radar tab: proximity sweep, discovered peers
│   │   └── SettingsScreen.tsx             # Settings tab: profile editor, permissions, theme
│   ├── theme/                             # Design system
│   │   ├── ThemeContext.tsx               # Theme provider (Dark / Light mode switching)
│   │   ├── tokens.ts                      # Color palette, spacing, typography, radii tokens
│   │   └── index.ts
│   ├── transport/                         # Networking abstraction layer
│   │   ├── NativeRadioTransport.ts        # JS bridge wrapping NativeModules.RadiiNativeRadio
│   │   ├── TransportManager.ts            # Transport singleton delegating to active link
│   │   ├── MockTransport.ts               # Simulator for development without physical radios
│   │   └── types.ts                       # ITransport interface definitions
│   └── utils/
│       ├── audioPlayer.ts                 # Audio playback wrapper
│       └── permissions.ts                 # Android permission checker utilities
├── package.json                           # Dependencies (Expo 57, React Native 0.86, React 19)
└── OrbitorPRD.md                          # Original Product Requirements Document
```

---

## 6. End-to-End Business & Data Execution Flows

### Flow 1: App Boot, Identity Initialization & Radio Startup

```
[App Launched]
      |
      v
src/app/_layout.tsx mounts <OrbitorProvider>
      |
      v
src/context/OrbitorContext.tsx:
  1. Loads user profile from AsyncStorage ('@radii_persisted_profile')
     - If first launch, generates unique ID: `peer_${6_random_hex}`
     - Generates default name: "Radii·<shortId>"
  2. Loads saved peers and message history from SQLite cache
  3. Invokes `NativeRadioTransport.startAdvertising()`
     -> Kotlin: `RadiiNativeRadioModule.startAdvertising(peerId, name)`
     -> Starts BLE Advertiser broadcasting Service UUID `0x11FD`
  4. Invokes `NativeRadioTransport.startDiscovery()`
     -> Kotlin: `RadiiNativeRadioModule.startScanning()`
     -> Starts BLE Scanner with `SCAN_MODE_LOW_LATENCY`
     -> Starts UDP Listening thread on port `41234` with `MulticastLock`
  5. Mounts PagerAppShell (Page 0: RadarScreen)
```

---

### Flow 2: Peer Discovery & Dynamic Radar Visualization

```
[Nearby Phone B is Advertising]
      |
      v
Phone A's BLE Scanner receives advertisement packet
      |
      v
Kotlin `RadiiNativeRadioModule.kt` -> `ScanCallback.onScanResult`:
  1. Extracts Manufacturer Data: checks for `0x11FD` (Radii header)
  2. Extracts RSSI (e.g. -62 dBm)
  3. Maps RSSI to distance bracket: "near" (2m - 10m)
  4. Bundles data into WritableMap: { id, name, rssi, distanceBracket, macAddress }
  5. Calls `sendEvent("onPeerDiscovered", map)`
      |
      v
JS Thread (`NativeRadioTransport.ts`):
  1. Filters out loopback (discards self-advertisements)
  2. Updates internal `discoveredPeers` Map
  3. Notifies `OrbitorContext`
      |
      v
`OrbitorContext.tsx`:
  - Merges new peer into `peers` state array
  - Updates RadarScreen: renders blip on the circular Canvas radar with pulse animation!
```

---

### Flow 3: Connection Handshake & Direct Radio Chat

```
User taps peer blip on Radar -> Taps "Connect"
      |
      v
`requestConnection(peer)` sends a `CONNECTION_REQUEST` packet:
  - Generates a 6-digit numeric verification code (e.g. "492 817")
  - Packet sent via UDP or BLE GATT
      |
      v
Receiver's phone gets packet -> Emits `onMessageReceived`
      |
      v
Receiver's screen displays `ConnectionRequestModal`:
  - Shows: "Anmol wants to connect. Verification Code: 492 817"
  - Receiver compares digits and taps "Accept"
      |
      v
Receiver sends `CONNECTION_ACCEPTED` back to Sender
      |
      v
Both devices mark each other as `isPaired: true`, persist peer to saved list,
and router opens `src/app/chat/[id].tsx` ready for messaging!
```

---

### Flow 4: Store-and-Forward Outbox (Walking Out of Range and Back)

```
User types "See you at the main stage" and taps Send
      |
      v
`sendMessage()` in `OrbitorContext.tsx`
  - Calls `NativeRadioTransport.sendPacket(peerId, message)`
  - Direct UDP fails (Peer IP unreachable)
  - RFCOMM connection times out (Peer >50m away)
  - Return value: `delivered = false`
      |
      v
`sendMessage()` catches delivery failure:
  1. Message status set to `'queued_offline'` (Clock icon ⏱ rendered in bubble)
  2. Message pushed to `outbox.enqueue(message, 'peer_out_of_radio_range')`
  3. Floating banner appears: "1 message queued in outbox"
      |
      ~ [15 Minutes Pass — Peer walks back into 20m range] ~
      |
Kotlin BLE Scanner detects peer's advertisement packet -> `onPeerDiscovered`
      |
      v
`OrbitorContext.tsx` listener fires:
  - Checks `outbox.getItems()` for items targeting this peerId
  - Finds queued message -> Calls `sendPacket(peerId, item)`
  - RFCOMM connects successfully!
  - Outbox dequeues item
  - Message bubble updates from clock (⏱) to single tick (✓) then double tick (✓✓)!
```

---

## 7. Developer Setup, Building & Debugging

### Prerequisites
- **Node.js**: v18.x or v20.x
- **Package Manager**: `pnpm` (run `npm install -g pnpm`)
- **Java**: JDK 17 (mandatory for Android Gradle plugin)
- **Android Studio**: SDK Platform 34 / 35, Build-Tools, and Android NDK installed.
- **Physical Android Phone**: **Crucial Requirement**: Emulators in Android Studio **do not have real Bluetooth or Wi-Fi Direct hardware**. You must use a physical Android phone with USB Debugging enabled.

### Common Development & Build Commands

```bash
# 1. Install all dependencies
pnpm install

# 2. Start Metro Development Server (with Fast Refresh)
pnpm run start
# Press 'a' to open on connected Android device

# 3. Compile native Kotlin code and install debug build to connected phone
pnpm run android:device
# (or: npx expo run:android)

# 4. Compile a standalone release APK locally with specific version
pnpm run build:apk 1.0.2

# 5. Typecheck TypeScript code
pnpm tsc --noEmit

# 6. Check for dependency/SDK issues
npx expo-doctor
```

---

### The Development, Build & Deployment Lifecycle (Pre-PlayStore)

Until Radii is deployed on the Google Play Store, releases are distributed directly via GitHub Releases and the static landing page.

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│ 1. Daily Development (Metro)    │  ───> │ 2. Local Release Build (Gradle) │  ───> │ 3. Tag & GitHub Release Publish │
│                                 │       │                                 │       │                                 │
│ • pnpm run android:device        │       │ • pnpm run build:apk <version>  │       │ • git tag v1.0.x                │
│ • Fast Refresh & live debug     │       │ • Outputs to android/release/   │       │ • git push origin v1.0.x        │
│ • git commit & push to main     │       │ • Auto-increments versionCode   │       │ • CI attaches APKs in ~8 sec    │
└─────────────────────────────────┘       └─────────────────────────────────┘       └─────────────────────────────────┘
```

#### Phase 1: Daily Development & Metro Process
1. Connect physical Android phone with USB debugging enabled (`adb devices`).
2. Run `pnpm run android:device` to build and deploy the debug APK.
3. Keep the Metro bundler running (`pnpm run start`) for instantaneous Fast Refresh as you modify UI components and context logic.
4. Normal code edits follow standard git workflow:
   ```bash
   git add .
   git commit -m "feat: your feature"
   git push origin main
   ```

#### Phase 2: Local Release Build Process
Compiling React Native with Android NDK on cloud CI free runners takes 10+ minutes and hits resource limits. Radii builds production binaries **locally in ~28 seconds**:
1. Run the build script with the desired semver:
   ```bash
   pnpm run build:apk 1.0.2
   ```
2. The script triggers Gradle with dynamic `-PversionName=1.0.2` and automatically derives `-PversionCode`.
3. Output APKs are automatically filtered and copied into `android/release/`:
   - `radii-arm64-v8a.apk` (46 MB — 64-bit modern devices)
   - `radii-release.apk` (46 MB — primary release distribution)
   - `radii-armeabi-v7a.apk` (39 MB — 32-bit legacy devices)
   *(The 100MB+ universal fat APK is automatically omitted to keep all files below GitHub's 100MB commit ceiling).*

#### Phase 3: Release & Deployment Process (Tagging)
To publish an official downloadable release:
```bash
# 1. Stage and commit the updated code and release APKs
git add .
git commit -m "release: v1.0.2"
git push origin main

# 2. Create the semver tag and push it to GitHub
git tag v1.0.2
git push origin v1.0.2
```

**Automated CI Deployment:**
- GitHub Actions detects the `v*` tag and runs `.github/workflows/build-release-apk.yml`.
- Because the binaries are already committed locally in `android/release/`, **no cloud build is needed**.
- Within **~8 seconds**, GitHub automatically creates the release on GitHub Releases, generates release notes from your commits, and permanently hosts the APK files for users and the landing page to download.

---

## 8. Comprehensive Interview Preparation Guide (15+ Technical Q&As)

These questions and answers are structured so you can speak fluently about this project in any senior engineering or mobile architecture interview.

---

### Q1: "Walk me through the architecture of this project."
**Answer:**
> "Radii is a decentralized, zero-internet offline mesh communication app built with React Native 0.86 and Expo SDK 57 on Android. 
> 
> The architecture is strictly decoupled into three layers:
> 1. **Presentation & Routing**: Uses Expo Router with file-based routing and a native 120fps hardware pager shell (`PagerView`) for smooth tab swiping between the Radar, Chats, and Settings screens.
> 2. **State & Domain Machine**: Managed by `OrbitorContext.tsx`, which handles deterministic profile identities, peer RSSI tracking, conversation SQLite persistence, an ARQ chunking engine for media streaming, and an offline Store-and-Forward Outbox.
> 3. **Hardware Driver & Transport Layer**: Wrapped by `NativeRadioTransport.ts`, which interfaces with a custom 1,740-line native Kotlin module (`RadiiNativeRadioModule.kt`). This native module directly controls Android's hardware BLE advertiser and scanner, Bluetooth Classic RFCOMM sockets, and Wi-Fi Multicast UDP sockets, providing zero-internet peer-to-peer data transmission."

---

### Q2: "Why did you build a custom Kotlin Native Module instead of using existing npm libraries like `react-native-ble-plx`?"
**Answer:**
> "Most off-the-shelf React Native Bluetooth libraries only implement the **BLE Central mode** (scanning and connecting to smartwatches or sensors). They do not support **BLE Peripheral mode** (broadcasting your phone as a beacon) combined with an active GATT Server.
> 
> Furthermore, BLE has severe bandwidth limitations (~512 bytes MTU). To support voice notes, photos, and large files peer-to-peer without internet, we needed a hybrid radio stack: BLE for low-power discovery, Bluetooth Classic RFCOMM sockets for high-throughput direct streaming, and Local Wi-Fi Multicast UDP sockets for group mesh channels. No existing third-party library unified all three protocols with Android's modern background execution rules, so writing a purpose-built Kotlin module was the cleanest and most performant solution."

---

### Q3: "How does React Native communicate with your native Kotlin code?"
**Answer:**
> "We implement a standard React Native Native Module:
> 1. In Kotlin, `RadiiNativeRadioModule` extends `ReactContextBaseJavaModule`.
> 2. We expose async methods to JavaScript using the `@ReactMethod` annotation, accepting parameters and returning results through a `com.facebook.react.bridge.Promise`.
> 3. For asynchronous hardware events (like discovering a peer over radio or receiving an incoming message), Kotlin obtains `RCTDeviceEventEmitter` from the `ReactApplicationContext` and invokes `.emit(eventName, params)`.
> 4. In TypeScript, we wrap this with `NativeModules.RadiiNativeRadio` and `new NativeEventEmitter(RadiiNativeRadio)`, giving our React Context a clean, event-driven API."

---

### Q4: "How does Radii achieve peer discovery without any central server or internet connection?"
**Answer:**
> "We use **Bluetooth Low Energy (BLE) Advertisements**. Every device running Radii configures its `BluetoothLeAdvertiser` to transmit 31-byte advertising packets containing a custom 16-bit Service UUID (`0x11FD`) and the user's short peer ID. 
> 
> Concurrently, the phone's `BluetoothLeScanner` runs in low-latency mode listening for packets containing that UUID. When a packet is detected, the native module measures the RSSI (Received Signal Strength Indication), calculates whether the peer is in 'immediate' (<2m), 'near' (2-10m), or 'far' (10-50m) range, and pushes the peer data to the React UI to update the Radar sweep display."

---

### Q5: "How do you handle packet loss when transferring photos or voice notes over lossy radio channels?"
**Answer:**
> "We implemented a custom application-layer **chunking protocol with Selective Repeat Automatic Repeat reQuest (ARQ)**:
> 1. The sender initiates a `MEDIA_TRANSFER_REQUEST` containing metadata (total bytes, MIME type, total chunks).
> 2. The receiver accepts the transfer (`MEDIA_TRANSFER_ACCEPT`).
> 3. The sender chunks the Base64 file into 10 KB slices (`MEDIA_PAYLOAD_CHUNK`) and streams them sequentially.
> 4. Once all chunks are dispatched, the sender transmits `MEDIA_STREAM_END`.
> 5. The receiver audits its in-memory buffer. If any chunk indices are missing due to radio noise, it responds with `MEDIA_REQUEST_MISSING` specifying the lost indices.
> 6. The sender re-transmits only those missing chunks. Once complete, the receiver reassembles the buffer and saves it to local storage."

---

### Q6: "What is your Store-and-Forward Outbox and how does it work?"
**Answer:**
> "In an offline mesh network, nodes frequently move in and out of radio range. If a user sends a message to an out-of-range companion:
> 1. The transport layer attempts transmission across direct UDP, RFCOMM, and BLE. If all fail, it returns `delivered = false`.
> 2. The message is tagged with `'queued_offline'` status and enqueued in our `outbox` manager (`src/core/outbox.ts`).
> 3. The queue is persisted to SQLite via `AsyncStorage`.
> 4. When the companion re-enters physical range, our BLE scanner triggers `onPeerDiscovered`.
> 5. `OrbitorContext` listens for this event, inspects the outbox for pending messages matching that peer ID, and immediately flushes the queue over the newly established radio link."

---

### Q7: "Why does Android require Location Permission just to use Bluetooth and Wi-Fi?"
**Answer:**
> "Because Bluetooth beacons and Wi-Fi access points have fixed physical coordinates in the real world (e.g. stores, public beacons). By scanning for nearby radio identifiers, a malicious app could deduce the user's exact geographical location without ever asking for GPS access. Therefore, the Android OS mandates `ACCESS_FINE_LOCATION` for any app performing Bluetooth or Wi-Fi scans. On Android 12+ (API 31+), Google introduced `BLUETOOTH_SCAN` with the `neverForLocation` flag, which we support, but for older Android devices and Wi-Fi scanning, location permission remains mandatory."

---

### Q8: "How do you open received files (PDFs, APKs, Images) without running into Android's `FileUriExposedException`?"
**Answer:**
> "On Android 7.0 (API 24) and above, passing a raw `file:///` URI in an `ACTION_VIEW` Intent to an external app throws a `FileUriExposedException` for security reasons. 
> 
> To solve this, we configured an Android **`FileProvider`** in `AndroidManifest.xml` and `file_paths.xml`. When a file is received, our Kotlin module uses `FileProvider.getUriForFile()` to generate a secure `content://com.radii.app.fileprovider/...` URI, grants temporary read permissions with `Intent.FLAG_GRANT_READ_URI_PERMISSION`, and invokes `Intent.createChooser()` so the user can open the document in their preferred native viewer."

---

### Q9: "How does the app prevent UI freezing and frame drops during heavy radio data transfers?"
**Answer:**
> "React Native uses a multi-threaded architecture. All UI rendering and touch handling run on the **Android Main/UI Thread**, while React state and effects run on the **JavaScript Thread**.
> 
> If we did network socket listening, Base64 decoding, and file I/O on the JS thread, the UI would freeze. We solve this by offloading all heavy operations in `RadiiNativeRadioModule.kt` to **native background daemon threads** (`thread(start = true, isDaemon = true)`). Only small, structured JSON events are dispatched across the bridge to JavaScript, keeping the UI running at a silky 60 to 120 FPS."

---

### Q10: "How do Mesh Broadcast Rooms work without a central server?"
**Answer:**
> "Rooms are **ephemeral local broadcast channels**. When a user creates a room with a 4-digit PIN:
> 1. The room metadata is broadcast locally via UDP subnet broadcast and BLE GATT advertisements (`ROOM_ANNOUNCE`).
> 2. Nearby devices listen for these announcements and populate their 'Available Rooms' list.
> 3. When another user joins, the PIN is validated against the room's verification hash locally.
> 4. All room messages are tagged with the `roomId` and sent to the subnet broadcast address (`255.255.255.255` / `192.168.x.255`) on UDP port `41234`. Every device subscribed to that room ID parses the packet and appends it to their room chat thread."

---

### Q11: "What is the difference between Hermes Bytecode and standard V8 JavaScript execution?"
**Answer:**
> "Standard web browsers (V8) load plain JavaScript source code, parse the Abstract Syntax Tree (AST), and compile it to bytecode at runtime (JIT). This causes memory spikes and startup delays on mobile devices.
> 
> **Hermes** is an AOT (Ahead-of-Time) compiler developed by Meta for React Native. During our release build (`pnpm run build:apk`), the Metro bundler runs the Hermes compiler (`hermesc`) on our host machine to pre-compile all JavaScript/TypeScript into **Hermes Bytecode (HBC)**. The APK contains pre-compiled bytecode, allowing Android to execute it immediately upon launch with near-zero parse time and significantly reduced RAM consumption."

---

### Q12: "How do you handle Android's Wi-Fi packet filtering in sleep mode?"
**Answer:**
> "By default, Android Wi-Fi drivers discard multicast and broadcast UDP packets when the screen dims or the radio enters power-saving mode. To prevent missed messages, `RadiiNativeRadioModule.kt` obtains a `WifiManager.MulticastLock` using `wifiManager.createMulticastLock("radii_udp_lock")`. We acquire this lock whenever UDP discovery or room listening is active, ensuring the Wi-Fi chipset receives every inbound datagram."

---

### Q13: "What are the trade-offs of using UDP vs TCP for local peer-to-peer messaging?"
**Answer:**
> "TCP requires a 3-way handshake (`SYN`, `SYN-ACK`, `ACK`) and maintains a persistent connection state. In an offline ad-hoc mobile mesh, peers are constantly moving, connecting, and disconnecting. Maintaining hundreds of active TCP connections causes connection timeouts, socket leaks, and battery drain.
> 
> **UDP** is connectionless. We can instantly blast a packet to an IP or the entire subnet without any connection setup latency. To guarantee reliability for messages and files, we implemented our own lightweight acknowledgment (`MSG_ACK`) and selective-repeat chunking protocol on top of UDP at the application layer."

---

### Q14: "How does the app support dark and light mode dynamically?"
**Answer:**
> "We built a centralized design system token architecture in `src/theme/`:
> - `tokens.ts` defines structured color tokens for both dark (`#0c0f14` surface, `#00c20d` emerald accent) and light (`#ffffff` surface, `#008a09` accent) modes, alongside spacing, radius, and typography scales.
> - `ThemeContext.tsx` provides a `useThemeContext()` hook that reads system preferences or user overrides, dynamically re-rendering the app without requiring an application restart."

---

### Q15: "What would you improve or build next in Radii v2.0?"
**Answer:**
> "Three major architectural upgrades:
> 1. **Multi-hop Mesh Routing**: Currently, Radii operates in single-hop star/cluster topologies (direct peer-to-peer or local broadcast). In v2.0, we plan to implement a routing protocol like B.A.T.M.A.N. or AODV where Device A can send a packet to Device C by using Device B as an intermediate radio relay hop.
> 2. **Signal Protocol End-to-End Encryption (Double Ratchet)**: Adding X3DH (Extended Triple Diffie-Hellman) and Double Ratchet cryptographic ratcheting so that mesh broadcast relays cannot read messages intended for other recipients.
> 3. **Cross-Platform iOS Multipeer Connectivity**: Writing a Swift Expo Module wrapping Apple's `MultipeerConnectivity` framework to enable cross-platform mesh between iOS and Android."

---

## 9. Summary & Quick Reference Sheet

| Concept | File / Implementation |
| :--- | :--- |
| **Native Radio Module** | `android/app/src/main/java/com/radii/app/RadiiNativeRadioModule.kt` |
| **JS Hardware Bridge** | `src/transport/NativeRadioTransport.ts` |
| **Global State Machine** | `src/context/OrbitorContext.tsx` |
| **Store-and-Forward Outbox** | `src/core/outbox.ts` |
| **Screen Navigation** | `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/chat/[id].tsx` |
| **Hardware Tabs Pager** | `src/components/PagerAppShell.tsx` (using `react-native-pager-view`) |
| **Proximity Radar Sweep** | `src/screens/RadarScreen.tsx` & `src/components/radar/RadarSweep.tsx` |
| **PTT Audio Recording** | `src/components/chat/PTTVoiceButton.tsx` -> `RadiiNativeRadio.startAudioRecording` |
| **Native Document Opener**| `RadiiNativeRadio.openFileWithIntent` via Android `FileProvider` |
| **Release APK Build** | `pnpm run build:apk` -> `android/release/radii-release.apk` |

---
*Created for engineers mastering mobile systems architecture, native module bridges, and decentralized wireless networking.*
