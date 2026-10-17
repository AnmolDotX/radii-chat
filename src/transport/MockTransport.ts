import { ITransport, TransportCapabilities } from './types';
import { Peer, Message, TransportType } from '../core/types';

export class MockTransport implements ITransport {
  public name = 'MockTransport';
  public type: TransportType = 'nearby';

  private peerDiscoveredListeners: Set<(peer: Peer) => void> = new Set();
  private peerLostListeners: Set<(peerId: string) => void> = new Set();
  private messageListeners: Set<(msg: Message) => void> = new Set();

  private isScanning = false;
  private isAdvertising = false;
  private timer: any = null;

  // Empty by default for realistic initial run
  private activePeers: Peer[] = [];

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

  public async startDiscovery(): Promise<void> {
    this.isScanning = true;
  }

  public async stopDiscovery(): Promise<void> {
    this.isScanning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async startAdvertising(): Promise<void> {
    this.isAdvertising = true;
  }

  public async stopAdvertising(): Promise<void> {
    this.isAdvertising = false;
  }

  public async sendMessage(peerId: string, payload: string): Promise<boolean> {
    return true;
  }

  public async sendVoiceChunk(peerId: string, audioBase64: string, durationSec: number): Promise<boolean> {
    return true;
  }

  public onPeerDiscovered(callback: (peer: Peer) => void): () => void {
    this.peerDiscoveredListeners.add(callback);
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
   * Helper for developer testing on emulator if desired
   */
  public addSimulatedPeer(peer: Peer): void {
    this.activePeers.push(peer);
    this.peerDiscoveredListeners.forEach((cb) => cb(peer));
  }

  public clearPeers(): void {
    this.activePeers.forEach((p) => {
      this.peerLostListeners.forEach((cb) => cb(p.id));
    });
    this.activePeers = [];
  }
}
