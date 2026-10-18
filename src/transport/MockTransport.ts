import { ITransport, TransportCapabilities } from './types';
import { Peer, Message, TransportType, NetworkMode } from '../core/types';

export class MockTransport implements ITransport {
  public name = 'RadiiTransport';
  public type: TransportType = 'nearby';

  private peerDiscoveredListeners: Set<(peer: Peer) => void> = new Set();
  private peerLostListeners: Set<(peerId: string) => void> = new Set();
  private messageListeners: Set<(msg: Message) => void> = new Set();

  private isScanning = false;
  private isAdvertising = false;
  private mode: NetworkMode = 'offline';

  // No mock peers by default. Real empty state when no one is around.
  private activePeers: Peer[] = [];

  public async capabilities(): Promise<TransportCapabilities> {
    return {
      supportsBLEAdvertising: true,
      supportsBLEScanning: true,
      supportsNearbyConnections: true,
      supportsWifiAware: true,
      supportsLocalHotspot: true,
      supportsLANBroadcast: false,
      supportsWANLink: false,
    };
  }

  public setMode(mode: NetworkMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.clearPeers();
  }

  public getMode(): NetworkMode {
    return this.mode;
  }

  public async startDiscovery(): Promise<void> {
    this.isScanning = true;
  }

  public async stopDiscovery(): Promise<void> {
    this.isScanning = false;
  }

  public async startAdvertising(): Promise<void> {
    this.isAdvertising = true;
  }

  public async stopAdvertising(): Promise<void> {
    this.isAdvertising = false;
  }

  public async sendMessage(_peerId: string, _payload: string): Promise<boolean> {
    return true;
  }

  public async sendVoiceChunk(_peerId: string, _audioBase64: string, _durationSec: number): Promise<boolean> {
    return true;
  }

  public onPeerDiscovered(callback: (peer: Peer) => void): () => void {
    this.peerDiscoveredListeners.add(callback);
    this.activePeers.forEach((p) => callback(p));
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

  /**
   * Called when a real nearby peer is discovered via radio / beacon
   */
  public addDiscoveredPeer(peer: Peer): void {
    const existingIndex = this.activePeers.findIndex((p) => p.id === peer.id);
    if (existingIndex >= 0) {
      this.activePeers[existingIndex] = peer;
    } else {
      this.activePeers.push(peer);
    }
    this.peerDiscoveredListeners.forEach((cb) => cb(peer));
  }

  public removePeer(peerId: string): void {
    this.activePeers = this.activePeers.filter((p) => p.id !== peerId);
    this.peerLostListeners.forEach((cb) => cb(peerId));
  }

  public clearPeers(): void {
    this.activePeers.forEach((p) => {
      this.peerLostListeners.forEach((cb) => cb(p.id));
    });
    this.activePeers = [];
  }
}
