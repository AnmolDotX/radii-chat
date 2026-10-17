import { ITransport, TransportCapabilities } from './types';
import { MockTransport } from './MockTransport';
import { Peer, Message, TransportType, NetworkMode } from '../core/types';

export class TransportManager {
  private activeTransport: ITransport;
  private mode: NetworkMode = 'offline';
  private autoUpgradeRadios = true;

  constructor() {
    this.activeTransport = new MockTransport();
  }

  public getTransport(): ITransport {
    return this.activeTransport;
  }

  public setNetworkMode(mode: NetworkMode): void {
    this.mode = mode;
  }

  public getNetworkMode(): NetworkMode {
    return this.mode;
  }

  public setAutoUpgrade(enabled: boolean): void {
    this.autoUpgradeRadios = enabled;
  }

  public isAutoUpgradeEnabled(): boolean {
    return this.autoUpgradeRadios;
  }

  public async getCapabilities(): Promise<TransportCapabilities> {
    return this.activeTransport.capabilities();
  }

  public async start(): Promise<void> {
    await this.activeTransport.startDiscovery();
    await this.activeTransport.startAdvertising();
  }

  public async stop(): Promise<void> {
    await this.activeTransport.stopDiscovery();
    await this.activeTransport.stopAdvertising();
  }

  public async send(peerId: string, text: string): Promise<boolean> {
    return this.activeTransport.sendMessage(peerId, text);
  }

  public async sendVoice(peerId: string, durationSec: number): Promise<boolean> {
    return this.activeTransport.sendVoiceChunk(peerId, 'audio_simulated_payload', durationSec);
  }
}

export const transportManager = new TransportManager();
