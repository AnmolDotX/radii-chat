import { Peer, Message, TransportType } from '../core/types';

export interface TransportCapabilities {
  supportsBLEAdvertising: boolean;
  supportsBLEScanning: boolean;
  supportsNearbyConnections: boolean;
  supportsWifiAware: boolean;
  supportsLocalHotspot: boolean;
  supportsLANBroadcast: boolean;
  supportsWANLink: boolean;
}

export type ConnectionState = 'idle' | 'scanning' | 'connected' | 'error';

export interface ITransport {
  name: string;
  type: TransportType;
  capabilities(): Promise<TransportCapabilities>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  startAdvertising(): Promise<void>;
  stopAdvertising(): Promise<void>;
  sendMessage(peerId: string, payload: string): Promise<boolean>;
  sendVoiceChunk(peerId: string, audioBase64: string, durationSec: number): Promise<boolean>;
  onPeerDiscovered(callback: (peer: Peer) => void): () => void;
  onPeerLost(callback: (peerId: string) => void): () => void;
  onMessageReceived(callback: (message: Message) => void): () => void;
}
