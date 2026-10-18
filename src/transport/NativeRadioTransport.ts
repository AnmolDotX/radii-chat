import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { ITransport, TransportCapabilities } from './types';
import { Peer, Message, TransportType, NetworkMode } from '../core/types';
import { getLocalProfile } from '../core/identity';

const { RadiiNativeRadio } = NativeModules;
const radioEmitter = RadiiNativeRadio ? new NativeEventEmitter(RadiiNativeRadio) : null;

export function normalizePeerId(id: string): string {
  if (!id) return '';
  const clean = id.trim();
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

        const isNearbyAvailable = Boolean(rawPeer.ipAddress || existing?.ipAddress);

        const mergedPeer: Peer = {
          id: canonicalId,
          shortId,
          fullUserId: rawPeer.fullUserId || existing?.fullUserId,
          name:
            rawPeer.name && !rawPeer.name.startsWith('Radii·') && rawPeer.name !== 'Radii User'
              ? rawPeer.name
              : existing?.name || rawPeer.name || `Radii·${shortId}`,
          platform: (rawPeer.platform as any) || 'android',
          activeTransport: isNearbyAvailable ? 'nearby' : 'ble',
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
          statusMessage: isNearbyAvailable ? 'Direct Wi-Fi Mesh' : 'Direct BLE Radio Signal',
          macAddress: rawPeer.macAddress || existing?.macAddress,
          ipAddress: rawPeer.ipAddress || existing?.ipAddress,
        };

        this.discoveredPeers.set(canonicalId, mergedPeer);
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

        // Target verification
        if (targetShortId && myShortId && targetShortId !== myShortId) {
          return;
        }

        const canonicalSenderId = senderShortId ? `peer_${senderShortId}` : String(rawMsg.senderId);
        const canonicalTargetId = targetShortId ? `peer_${targetShortId}` : String(rawMsg.targetPeerId || '');

        const msg: Message = {
          id: String(rawMsg.id || `msg_${Date.now()}`),
          conversationId: canonicalSenderId,
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
        };

        this.messageListeners.forEach((cb) => cb(msg));
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
    const peer = this.findPeer(peerId);
    const jsonString = typeof packet === 'string' ? packet : JSON.stringify(packet);
    let delivered = false;

    if (Platform.OS === 'android') {
      // 1. Direct UDP Unicast (if IP address known)
      if (peer?.ipAddress && RadiiNativeRadio?.sendUdpMessage) {
        try {
          const ok = await RadiiNativeRadio.sendUdpMessage(peer.ipAddress, jsonString);
          if (ok) delivered = true;
        } catch (e) {}
      }

      // 2. Subnet Broadcast on Local Wi-Fi / Hotspot
      if (RadiiNativeRadio?.broadcastUdpMessage) {
        try {
          const ok = await RadiiNativeRadio.broadcastUdpMessage(jsonString);
          if (ok) delivered = true;
        } catch (e) {}
      }

      // 3. BLE GATT / RFCOMM (if MAC address known)
      if (peer?.macAddress) {
        if (RadiiNativeRadio?.sendBleMessage) {
          try {
            const ok = await RadiiNativeRadio.sendBleMessage(peer.macAddress, jsonString);
            if (ok) delivered = true;
          } catch (e) {}
        }
        if (RadiiNativeRadio?.sendBluetoothMessage) {
          try {
            RadiiNativeRadio.sendBluetoothMessage(peer.macAddress, jsonString);
          } catch (e) {}
        }
      }
    }
    return delivered;
  }

  public async sendVoiceChunk(_peerId: string, _audioBase64: string, _durationSec: number): Promise<boolean> {
    return true;
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
