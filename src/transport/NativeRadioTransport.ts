import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { ITransport, TransportCapabilities } from './types';
import { Peer, Message, TransportType, NetworkMode } from '../core/types';
import { getLocalProfile } from '../core/identity';

const { RadiiNativeRadio } = NativeModules;
const radioEmitter = RadiiNativeRadio ? new NativeEventEmitter(RadiiNativeRadio) : null;

export function normalizePeerId(id: string): string {
  if (!id) return '';
  const clean = id.trim();
  if (clean.startsWith('room_')) return clean;
  if (clean.startsWith('peer_') && clean.length === 11) return clean;
  const shortId = clean.slice(-6).toLowerCase();
  return `peer_${shortId}`;
}

export class NativeRadioTransport implements ITransport {
  public name = 'NativeRadioTransport';
  public type: TransportType = 'ble';

  private peerDiscoveredListeners: Set<(peer: Peer) => void> = new Set();
  private peerLostListeners: Set<(peerId: string) => void> = new Set();
  private messageListeners: Set<(msg: Message) => void> = new Set();

  private isScanning = false;
  private isAdvertising = false;
  private mode: NetworkMode = 'offline';
  private peerSubscription: any = null;
  private msgSubscription: any = null;

  private discoveredPeers: Map<string, Peer> = new Map();
  private persistentPeerCache: Map<
    string,
    { ipAddress?: string; macAddress?: string; name?: string; lastSeen: number }
  > = new Map();
  private pruneTimer: any = null;

  constructor() {
    this.setupListeners();
  }

  public findPeer(peerId: string): Peer | undefined {
    if (!peerId) return undefined;
    const clean = peerId.trim();
    if (this.discoveredPeers.has(clean)) {
      return this.discoveredPeers.get(clean);
    }
    const shortId = clean.slice(-6).toLowerCase();
    for (const [id, peer] of this.discoveredPeers.entries()) {
      if (
        id === clean ||
        id.toLowerCase().endsWith(shortId) ||
        peer.id.toLowerCase().endsWith(shortId) ||
        (peer.macAddress && peer.macAddress.replace(/:/g, '').toLowerCase().endsWith(shortId))
      ) {
        return peer;
      }
    }
    // Fallback: Check persistent peer cache for last-known addresses even if evicted from UI
    const cached =
      this.persistentPeerCache.get(clean) ||
      this.persistentPeerCache.get(`peer_${shortId}`) ||
      this.persistentPeerCache.get(shortId);
    if (cached && (cached.ipAddress || cached.macAddress)) {
      return {
        id: `peer_${shortId}`,
        name: cached.name || `Radii·${shortId}`,
        platform: 'android',
        activeTransport: cached.ipAddress ? 'nearby' : 'ble',
        availableTransports: [cached.ipAddress ? 'nearby' : 'ble'],
        avatarSeed: cached.name || shortId,
        rssi: -65,
        distanceBracket: 'immediate',
        lastSeen: cached.lastSeen,
        isPaired: true,
        ipAddress: cached.ipAddress,
        macAddress: cached.macAddress,
      };
    }
    return undefined;
  }

  private setupListeners(): void {
    if (radioEmitter) {
      this.peerSubscription = radioEmitter.addListener('onPeerDiscovered', (rawPeer: any) => {
        if (!rawPeer || !rawPeer.id) return;

        const myProfile = getLocalProfile();
        const rawId = String(rawPeer.id);
        const myShortId = myProfile.id.slice(-6).toLowerCase();
        const shortId = String(rawPeer.shortId || rawId.slice(-6)).toLowerCase();

        // Discard self-discovery loopback
        if (
          rawId === myProfile.id ||
          shortId === myShortId ||
          rawId.endsWith(myShortId) ||
          rawId.includes(myShortId)
        ) {
          return;
        }

        const canonicalId = `peer_${shortId}`;
        const existing = this.discoveredPeers.get(canonicalId);

        // Merge available transports
        const transports = new Set<TransportType>(existing?.availableTransports || []);
        if (rawPeer.activeTransport) transports.add(rawPeer.activeTransport as TransportType);
        if (rawPeer.ipAddress) transports.add('nearby');
        if (rawPeer.macAddress) transports.add('ble');
        if (transports.size === 0) transports.add('ble');

        const isNearbyAvailable = Boolean(
          rawPeer.ipAddress ||
          existing?.ipAddress ||
          rawPeer.activeTransport === 'nearby' ||
          existing?.activeTransport === 'nearby' ||
          existing?.isPaired
        );

        const mergedPeer: Peer = {
          id: canonicalId,
          shortId,
          fullUserId: rawPeer.fullUserId || existing?.fullUserId,
          name:
            rawPeer.name && !rawPeer.name.startsWith('Radii·') && rawPeer.name !== 'Radii User'
              ? rawPeer.name
              : existing?.name || rawPeer.name || `Radii·${shortId}`,
          platform: (rawPeer.platform as any) || 'android',
          activeTransport: isNearbyAvailable ? 'nearby' : (rawPeer.activeTransport as any) || 'ble',
          availableTransports: Array.from(transports),
          rssi: typeof rawPeer.rssi === 'number' ? rawPeer.rssi : existing?.rssi || -60,
          distanceBracket: rawPeer.distanceBracket || existing?.distanceBracket || 'near',
          lastSeen: Date.now(),
          isPaired: existing?.isPaired || false,
          avatarSeed: rawPeer.name || existing?.name || shortId,
          deviceName:
            rawPeer.deviceName &&
            rawPeer.deviceName !== 'Radii Radio' &&
            rawPeer.deviceName !== 'Android Radio'
              ? rawPeer.deviceName
              : existing?.deviceName || rawPeer.deviceName || 'Android Radio',
          statusMessage: isNearbyAvailable ? 'Direct Nearby Mesh' : 'Direct BLE Radio Signal',
          macAddress: rawPeer.macAddress || existing?.macAddress,
          ipAddress: rawPeer.ipAddress || existing?.ipAddress,
        };

        this.discoveredPeers.set(canonicalId, mergedPeer);
        if (mergedPeer.ipAddress || mergedPeer.macAddress) {
          const cacheRecord = {
            ipAddress: mergedPeer.ipAddress,
            macAddress: mergedPeer.macAddress,
            name: mergedPeer.name,
            lastSeen: Date.now(),
          };
          this.persistentPeerCache.set(canonicalId, cacheRecord);
          this.persistentPeerCache.set(shortId, cacheRecord);
        }
        this.peerDiscoveredListeners.forEach((cb) => cb(mergedPeer));
      });

      this.msgSubscription = radioEmitter.addListener('onMessageReceived', (rawMsg: any) => {
        if (!rawMsg) return;

        const myProfile = getLocalProfile();
        const myShortId = myProfile.id.slice(-6).toLowerCase();

        const senderShortId = String(
          rawMsg.senderShortId || (rawMsg.senderId ? rawMsg.senderId.slice(-6) : '')
        ).toLowerCase();
        const targetShortId = String(
          rawMsg.targetShortId || (rawMsg.targetPeerId ? rawMsg.targetPeerId.slice(-6) : '')
        ).toLowerCase();

        // Discard self-loopback
        if (senderShortId && senderShortId === myShortId) {
          return;
        }

        const isBroadcastOrRoom =
          Boolean(rawMsg.roomId || rawMsg.roomCode) ||
          String(rawMsg.type || '').startsWith('ROOM_') ||
          rawMsg.type === 'PEER_ANNOUNCE' ||
          rawMsg.type === 'SOS_BEACON';

        // Target verification (skip for broadcast / rooms)
        if (!isBroadcastOrRoom && targetShortId && myShortId && targetShortId !== myShortId) {
          return;
        }

        const canonicalSenderId = senderShortId ? `peer_${senderShortId}` : String(rawMsg.senderId || 'peer_unknown');
        const canonicalTargetId = targetShortId ? `peer_${targetShortId}` : String(rawMsg.targetPeerId || '');
        const targetConvoId = rawMsg.roomId ? String(rawMsg.roomId) : canonicalSenderId;

        const msg: Message = {
          ...rawMsg,
          id: String(rawMsg.id || `msg_${Date.now()}`),
          conversationId: targetConvoId,
          senderId: canonicalSenderId,
          senderName: String(rawMsg.senderName || 'Nearby Companion'),
          text: String(rawMsg.text || ''),
          timestamp: typeof rawMsg.timestamp === 'number' ? rawMsg.timestamp : Date.now(),
          transport: (rawMsg.transport as any) || 'nearby',
          status: 'delivered',
          isMe: false,
          type: rawMsg.type || 'CHAT_MSG',
          targetPeerId: canonicalTargetId,
          ackMessageId: rawMsg.ackMessageId,
          verificationCode: rawMsg.verificationCode,
          senderDevice: rawMsg.senderDevice,
          // Explicitly preserve room and media transfer payload fields
          roomId: rawMsg.roomId,
          roomCode: rawMsg.roomCode,
          roomName: rawMsg.roomName,
          isVoice: Boolean(rawMsg.isVoice || rawMsg.transferType === 'voice'),
          audioDurationSeconds: rawMsg.audioDurationSeconds,
          isImage: Boolean(rawMsg.isImage || rawMsg.transferType === 'image'),
          transferId: rawMsg.transferId,
          transferType: rawMsg.transferType,
          transferStatus: rawMsg.transferStatus,
          transferProgress: rawMsg.transferProgress,
          fileName: rawMsg.fileName,
          fileSizeBytes: rawMsg.fileSizeBytes,
          chunkIndex: rawMsg.chunkIndex,
          totalChunks: rawMsg.totalChunks,
          chunkData: rawMsg.chunkData,
          mimeType: rawMsg.mimeType,
          mediaType: rawMsg.mediaType,
          audioUri: rawMsg.audioUri,
          imageUri: rawMsg.imageUri,
          isFile: Boolean(rawMsg.isFile || rawMsg.transferType === 'file'),
          fileUri: rawMsg.fileUri,
          missingIndices: rawMsg.missingIndices,
        };

        this.messageListeners.forEach((cb) => cb(msg));

        if (rawMsg.ipAddress || rawMsg.macAddress || (rawMsg as any).senderIp) {
          const ip = rawMsg.ipAddress || (rawMsg as any).senderIp;
          const mac = rawMsg.macAddress;
          const prev = this.persistentPeerCache.get(canonicalSenderId);
          const cacheRecord = {
            ipAddress: ip || prev?.ipAddress,
            macAddress: mac || prev?.macAddress,
            name: rawMsg.senderName || prev?.name,
            lastSeen: Date.now(),
          };
          this.persistentPeerCache.set(canonicalSenderId, cacheRecord);
          this.persistentPeerCache.set(senderShortId, cacheRecord);
        }
      });
    }

    // Prune stale peers not heard from in 60 seconds
    this.pruneTimer = setInterval(() => {
      const now = Date.now();
      this.discoveredPeers.forEach((p, id) => {
        if (now - p.lastSeen > 60000) {
          this.discoveredPeers.delete(id);
          this.peerLostListeners.forEach((cb) => cb(id));
        }
      });
    }, 15000);
  }

  public async capabilities(): Promise<TransportCapabilities> {
    return {
      supportsBLEAdvertising: true,
      supportsBLEScanning: true,
      supportsNearbyConnections: true,
      supportsWifiAware: true,
      supportsLocalHotspot: true,
      supportsLANBroadcast: true,
      supportsWANLink: false,
    };
  }

  public setMode(mode: NetworkMode): void {
    this.mode = mode;
  }

  public getMode(): NetworkMode {
    return this.mode;
  }

  public async enableHardwareRadios(): Promise<any> {
    if (Platform.OS === 'android' && RadiiNativeRadio?.enableHardwareRadios) {
      return RadiiNativeRadio.enableHardwareRadios();
    }
    return { bluetoothEnabled: true, locationEnabled: true };
  }

  public async openLocationSettings(): Promise<void> {
    if (Platform.OS === 'android' && RadiiNativeRadio?.openLocationSettings) {
      await RadiiNativeRadio.openLocationSettings();
    }
  }

  public async startDiscovery(): Promise<void> {
    this.isScanning = true;
    if (Platform.OS === 'android' && RadiiNativeRadio?.startScanning) {
      await RadiiNativeRadio.startScanning();
    }
  }

  public async stopDiscovery(): Promise<void> {
    this.isScanning = false;
    if (Platform.OS === 'android' && RadiiNativeRadio?.stopScanning) {
      await RadiiNativeRadio.stopScanning();
    }
  }

  public async startAdvertising(): Promise<void> {
    this.isAdvertising = true;
    const profile = getLocalProfile();
    const myId = profile.id || `radii_${Math.random().toString(36).substring(2, 8)}`;
    const myName = profile.displayName || profile.deviceName || 'Radii User';

    if (Platform.OS === 'android' && RadiiNativeRadio?.startAdvertising) {
      await RadiiNativeRadio.startAdvertising(myId, myName);
    }
  }

  public async stopAdvertising(): Promise<void> {
    this.isAdvertising = false;
    if (Platform.OS === 'android' && RadiiNativeRadio?.stopAdvertising) {
      await RadiiNativeRadio.stopAdvertising();
    }
  }

  public async sendMessage(peerId: string, payload: string): Promise<boolean> {
    const profile = getLocalProfile();
    const myShortId = profile.id.slice(-6).toLowerCase();
    const targetShortId = peerId.slice(-6).toLowerCase();

    const messagePacket = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'CHAT_MSG',
      senderId: `peer_${myShortId}`,
      senderShortId: myShortId,
      senderName: profile.displayName || profile.deviceName || 'Radii User',
      targetPeerId: `peer_${targetShortId}`,
      targetShortId: targetShortId,
      text: payload,
      timestamp: Date.now(),
    };

    return this.sendPacket(peerId, messagePacket);
  }

  public async sendPacket(peerId: string, packet: any): Promise<boolean> {
    const jsonString = typeof packet === 'string' ? packet : JSON.stringify(packet);
    const isRoomOrBroadcast =
      peerId === 'broadcast' ||
      Boolean(packet?.roomId || packet?.roomCode || packet?.type?.startsWith('ROOM_'));

    if (Platform.OS === 'android') {
      // 1. Broadcast to ALL discovered peers & subnet
      if (peerId === 'broadcast') {
        if (RadiiNativeRadio?.broadcastUdpMessage) {
          try {
            RadiiNativeRadio.broadcastUdpMessage(jsonString);
          } catch (e) {}
        }

        const peers = Array.from(this.discoveredPeers.values());
        peers.forEach((p) => {
          if (p.ipAddress && RadiiNativeRadio?.sendUdpMessage) {
            RadiiNativeRadio.sendUdpMessage(p.ipAddress, jsonString).catch(() => {});
          }
          if (p.macAddress) {
            if (jsonString.length <= 500 && RadiiNativeRadio?.sendBleMessage) {
              RadiiNativeRadio.sendBleMessage(p.macAddress, jsonString).catch(() => {});
            }
            if (RadiiNativeRadio?.sendBluetoothMessage) {
              RadiiNativeRadio.sendBluetoothMessage(p.macAddress, jsonString).catch(() => {});
            }
          }
        });
        return true;
      }

      const peer = this.findPeer(peerId);
      let delivered = false;

      // 2. Direct UDP Unicast (if peer IP address known on local Wi-Fi / Hotspot)
      if (peer?.ipAddress && RadiiNativeRadio?.sendUdpMessage) {
        try {
          const ok = await RadiiNativeRadio.sendUdpMessage(peer.ipAddress, jsonString);
          if (ok) delivered = true;
        } catch (e) {}
      }

      // 3. Subnet Broadcast on Local Wi-Fi / Hotspot for rooms, media repair/control, or connection handshakes
      const isConnectionHandshake = Boolean(
        packet?.type === 'CONNECTION_REQUEST' ||
        packet?.type === 'CONNECTION_ACCEPTED' ||
        packet?.type === 'CONNECTION_DECLINED' ||
        packet?.type === 'CONNECTION_CANCEL'
      );

      const isMediaControl = Boolean(
        packet?.type === 'MEDIA_REQUEST_MISSING' ||
        packet?.type === 'MEDIA_STREAM_END' ||
        packet?.type === 'MEDIA_TRANSFER_ACCEPT' ||
        packet?.type === 'MEDIA_TRANSFER_COMPLETE' ||
        packet?.type === 'MEDIA_TRANSFER_REQUEST' ||
        packet?.type === 'MEDIA_TRANSFER_REJECT' ||
        packet?.type === 'MEDIA_TRANSFER_CANCEL'
      );

      if ((isRoomOrBroadcast || isMediaControl || isConnectionHandshake) && RadiiNativeRadio?.broadcastUdpMessage) {
        try {
          RadiiNativeRadio.broadcastUdpMessage(jsonString);
          if (isMediaControl) delivered = true;
        } catch (e) {}
      }

      // 4. Connection Handshakes (REQUEST/ACCEPTED/DECLINED/CANCEL): Dual-dispatch across all radio channels
      if (isConnectionHandshake && peer?.macAddress) {
        console.log('[NativeRadioTransport] Handshake dispatching to', peer.macAddress, 'type:', packet?.type);
        if (RadiiNativeRadio?.sendBleMessage) {
          RadiiNativeRadio.sendBleMessage(peer.macAddress, jsonString).then((ok: boolean) => {
            console.log('[NativeRadioTransport] sendBleMessage result:', ok);
            if (ok) delivered = true;
          }).catch((err: any) => {
            console.warn('[NativeRadioTransport] sendBleMessage exception:', err);
          });
        }
        if (RadiiNativeRadio?.sendBluetoothMessage) {
          try {
            RadiiNativeRadio.sendBluetoothMessage(peer.macAddress, jsonString);
          } catch (e) {}
        }
      }

      // 5. Standard unicast packets: BLE GATT for small payloads (<= 500 bytes)
      if (!delivered && !isConnectionHandshake && peer?.macAddress && jsonString.length <= 500 && RadiiNativeRadio?.sendBleMessage) {
        try {
          const ok = await RadiiNativeRadio.sendBleMessage(peer.macAddress, jsonString);
          if (ok) delivered = true;
        } catch (e) {}
      }

      // 6. High-Bandwidth RFCOMM Stream (Bluetooth Classic) — for media chunks or fallback
      if (!delivered && !isConnectionHandshake && peer?.macAddress && RadiiNativeRadio?.sendBluetoothMessage) {
        try {
          const ok = await RadiiNativeRadio.sendBluetoothMessage(peer.macAddress, jsonString);
          if (ok) delivered = true;
        } catch (e) {}
      }

      // 7. Ultimate Subnet UDP Fallback if still undelivered
      if (!delivered && RadiiNativeRadio?.broadcastUdpMessage) {
        try {
          RadiiNativeRadio.broadcastUdpMessage(jsonString);
          delivered = true;
        } catch (e) {}
      }

      return delivered;
    }
    return false;
  }

  public async sendVoiceChunk(_peerId: string, _audioBase64: string, _durationSec: number): Promise<boolean> {
    return true;
  }

  public async disconnectPeer(peerIdOrMac: string): Promise<boolean> {
    return disconnectRadioPeer(peerIdOrMac);
  }

  public onPeerDiscovered(callback: (peer: Peer) => void): () => void {
    this.peerDiscoveredListeners.add(callback);
    this.discoveredPeers.forEach((p) => callback(p));
    return () => this.peerDiscoveredListeners.delete(callback);
  }

  public onPeerLost(callback: (peerId: string) => void): () => void {
    this.peerLostListeners.add(callback);
    return () => this.peerLostListeners.delete(callback);
  }

  public onMessageReceived(callback: (message: Message) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public showNotification(title: string, body: string, peerId: string): void {
    if (RadiiNativeRadio && typeof RadiiNativeRadio.showNotification === 'function') {
      RadiiNativeRadio.showNotification(title, body, peerId);
    }
  }

  public destroy(): void {
    if (this.peerSubscription) {
      this.peerSubscription.remove();
    }
    if (this.msgSubscription) {
      this.msgSubscription.remove();
    }
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
    }
  }
}

export async function disconnectRadioPeer(peerIdOrMac: string): Promise<boolean> {
  if (!RadiiNativeRadio || typeof RadiiNativeRadio.disconnectPeer !== 'function') return false;
  try {
    return await RadiiNativeRadio.disconnectPeer(peerIdOrMac);
  } catch {
    return false;
  }
}

export function showLocalNotification(title: string, body: string, peerId: string): void {
  if (RadiiNativeRadio && typeof RadiiNativeRadio.showNotification === 'function') {
    RadiiNativeRadio.showNotification(title, body, peerId);
  }
}

export async function readMediaBase64(filePath: string): Promise<{ base64: string; sizeBytes: number } | null> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.readFileBase64) {
    try {
      return await RadiiNativeRadio.readFileBase64(filePath);
    } catch (e) {
      console.warn('readMediaBase64 error:', e);
      return null;
    }
  }
  return null;
}

export async function saveMediaBase64(fileName: string, base64: string, mimeType: string): Promise<string | null> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.saveMediaBase64) {
    try {
      return await RadiiNativeRadio.saveMediaBase64(fileName, base64, mimeType);
    } catch (e) {
      console.warn('saveMediaBase64 error:', e);
      return null;
    }
  }
  return null;
}

export interface PickedDocument {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
  uri: string;
}

export async function pickNativeDocument(): Promise<PickedDocument | null> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.pickDocument) {
    try {
      return await RadiiNativeRadio.pickDocument();
    } catch (e) {
      console.warn('pickNativeDocument error:', e);
      return null;
    }
  }
  return null;
}

export function inferMimeType(filePath: string): string {
  const ext = (filePath.split('.').pop() || '').toLowerCase().split('?')[0];
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    apk: 'application/vnd.android.package-archive',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return mimeMap[ext] || '*/*';
}

export async function openFileWithNativeIntent(filePathOrUri: string, mimeType?: string): Promise<boolean> {
  const effectiveMime = (!mimeType || mimeType === '*/*' || mimeType === 'application/octet-stream')
    ? inferMimeType(filePathOrUri)
    : mimeType;
  if (Platform.OS === 'android' && RadiiNativeRadio?.openFileWithIntent) {
    try {
      return await RadiiNativeRadio.openFileWithIntent(filePathOrUri, effectiveMime);
    } catch (e) {
      console.warn('openFileWithNativeIntent error:', e);
      return false;
    }
  }
  return false;
}

export async function openWifiSettingsPanel(): Promise<boolean> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.openWifiSettings) {
    try {
      return await RadiiNativeRadio.openWifiSettings();
    } catch (e) {
      console.warn('openWifiSettingsPanel error:', e);
      return false;
    }
  }
  return false;
}

export interface PermissionsStatus {
  bluetooth: boolean;
  bluetoothEnabled: boolean;
  wifi: boolean;
  wifiEnabled: boolean;
  location: boolean;
  audio: boolean;
  notifications: boolean;
  storage?: boolean;
}

export async function checkAppPermissionsStatus(): Promise<PermissionsStatus> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.checkPermissionsStatus) {
    try {
      return await RadiiNativeRadio.checkPermissionsStatus();
    } catch (e) {
      console.warn('checkPermissionsStatus error:', e);
    }
  }
  return {
    bluetooth: true,
    bluetoothEnabled: true,
    wifi: true,
    wifiEnabled: true,
    location: true,
    audio: true,
    notifications: true,
    storage: true,
  };
}

export async function requestAppAudioPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.requestAudioPermission) {
    try {
      return await RadiiNativeRadio.requestAudioPermission();
    } catch (e) {
      console.warn('requestAudioPermission error:', e);
      return false;
    }
  }
  return true;
}

export async function requestAppNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.requestNotificationPermission) {
    try {
      return await RadiiNativeRadio.requestNotificationPermission();
    } catch (e) {
      console.warn('requestNotificationPermission error:', e);
      return false;
    }
  }
  return true;
}

export async function requestAppStoragePermission(): Promise<boolean> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.requestStoragePermission) {
    try {
      return await RadiiNativeRadio.requestStoragePermission();
    } catch (e) {
      console.warn('requestStoragePermission error:', e);
      return false;
    }
  }
  return true;
}

export async function openDeviceAppSettings(): Promise<boolean> {
  if (Platform.OS === 'android' && RadiiNativeRadio?.openAppSettings) {
    try {
      return await RadiiNativeRadio.openAppSettings();
    } catch (e) {
      console.warn('openAppSettings error:', e);
      return false;
    }
  }
  return false;
}
