import { ITransport, TransportCapabilities } from './types';
import { NativeRadioTransport } from './NativeRadioTransport';
import { NetworkMode } from '../core/types';

export class TransportManager {
  private activeTransport: ITransport;
  private mode: NetworkMode = 'offline';
  private autoUpgradeRadios = true;

  constructor() {
    this.activeTransport = new NativeRadioTransport();
  }

  public getTransport(): ITransport {
    return this.activeTransport;
  }

  public setNetworkMode(mode: NetworkMode): void {
    this.mode = mode;
    if (this.activeTransport && 'setMode' in this.activeTransport) {
      (this.activeTransport as any).setMode(mode);
    }
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

  public async enableHardwareRadios(): Promise<any> {
    if (this.activeTransport && 'enableHardwareRadios' in this.activeTransport) {
      return (this.activeTransport as any).enableHardwareRadios();
    }
    return { bluetoothEnabled: true, locationEnabled: true };
  }

  public async openLocationSettings(): Promise<void> {
    if (this.activeTransport && 'openLocationSettings' in this.activeTransport) {
      return (this.activeTransport as any).openLocationSettings();
    }
  }

  public async start(): Promise<void> {
    await this.enableHardwareRadios();
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

  public async sendPacket(peerId: string, packet: any): Promise<boolean> {
    if ('sendPacket' in this.activeTransport) {
      return (this.activeTransport as any).sendPacket(peerId, packet);
    }
    return this.activeTransport.sendMessage(peerId, JSON.stringify(packet));
  }

  public async sendVoice(peerId: string, durationSec: number): Promise<boolean> {
    return this.activeTransport.sendVoiceChunk(peerId, 'audio_simulated_payload', durationSec);
  }

  public showNotification(title: string, body: string, peerId: string): void {
    if ('showNotification' in this.activeTransport) {
      (this.activeTransport as any).showNotification(title, body, peerId);
    }
  }
}

export const transportManager = new TransportManager();
