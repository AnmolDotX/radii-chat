import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { RadiiNativeRadio } = NativeModules;
const audioEmitter = RadiiNativeRadio ? new NativeEventEmitter(RadiiNativeRadio) : null;

export interface AudioRecordingResult {
  filePath?: string;
  base64?: string;
  sizeBytes?: number;
}

export type PlaybackStatus = {
  messageId: string | null;
  isPlaying: boolean;
  progress: number; // 0 to 1
  elapsedSeconds: number;
  totalSeconds: number;
};

type PlaybackListener = (status: PlaybackStatus) => void;

class AudioPlaybackController {
  private currentMessageId: string | null = null;
  private isPlaying = false;
  private currentProgress = 0;
  private elapsedSeconds = 0;
  private totalSeconds = 0;
  private audioUri: string | null = null;
  private ticker: any = null;
  private listeners: Set<PlaybackListener> = new Set();

  constructor() {
    if (audioEmitter) {
      try {
        audioEmitter.addListener('onAudioPlaybackComplete', () => {
          this.handlePlaybackComplete();
        });
      } catch {}
    }
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    // Emit immediate current state
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  public getStatus(): PlaybackStatus {
    return {
      messageId: this.currentMessageId,
      isPlaying: this.isPlaying,
      progress: this.currentProgress,
      elapsedSeconds: this.elapsedSeconds,
      totalSeconds: this.totalSeconds,
    };
  }

  public async startRecording(recordId: string): Promise<string | null> {
    // If audio is currently playing, pause it before recording
    if (this.isPlaying) {
      this.pause();
    }

    if (RadiiNativeRadio?.startAudioRecording) {
      try {
        const path = await RadiiNativeRadio.startAudioRecording(recordId);
        return path;
      } catch (err) {
        console.warn('Native startAudioRecording error:', err);
      }
    }
    return null;
  }

  public async stopRecording(): Promise<AudioRecordingResult | null> {
    if (RadiiNativeRadio?.stopAudioRecording) {
      try {
        const result: AudioRecordingResult = await RadiiNativeRadio.stopAudioRecording();
        return result;
      } catch (err) {
        console.warn('Native stopAudioRecording error:', err);
      }
    }
    return null;
  }

  public async play(messageId: string, durationSeconds: number, audioUri?: string) {
    // If playing another voice note, stop the previous one first (WhatsApp behavior)
    if (this.currentMessageId && this.currentMessageId !== messageId) {
      this.stop();
    }

    this.currentMessageId = messageId;
    this.totalSeconds = Math.max(1, durationSeconds || 3);
    this.audioUri = audioUri || null;
    this.isPlaying = true;

    // Call native audio player if available and file exists
    if (audioUri && RadiiNativeRadio?.playAudio) {
      try {
        await RadiiNativeRadio.playAudio(audioUri);
      } catch (err) {
        console.warn('Native playAudio error:', err);
      }
    }

    this.startTicker();
    this.notify();
  }

  public pause(messageId?: string) {
    if (messageId && this.currentMessageId !== messageId) return;

    this.isPlaying = false;
    this.clearTicker();

    if (RadiiNativeRadio?.pauseAudio) {
      try {
        RadiiNativeRadio.pauseAudio().catch(() => {});
      } catch {}
    }

    this.notify();
  }

  public stop() {
    this.isPlaying = false;
    this.clearTicker();
    this.currentMessageId = null;
    this.currentProgress = 0;
    this.elapsedSeconds = 0;
    this.totalSeconds = 0;
    this.audioUri = null;

    if (RadiiNativeRadio?.stopAudio) {
      try {
        RadiiNativeRadio.stopAudio().catch(() => {});
      } catch {}
    }

    this.notify();
  }

  public seek(messageId: string, progressFraction: number, durationSeconds: number) {
    const clampedFraction = Math.max(0, Math.min(1, progressFraction));
    this.currentMessageId = messageId;
    this.totalSeconds = Math.max(1, durationSeconds || 3);
    this.currentProgress = clampedFraction;
    this.elapsedSeconds = Math.round(clampedFraction * this.totalSeconds);
    this.notify();
  }

  private startTicker() {
    this.clearTicker();
    const intervalMs = 100;
    const increment = intervalMs / (this.totalSeconds * 1000);

    this.ticker = setInterval(() => {
      if (!this.isPlaying) return;

      this.currentProgress += increment;
      this.elapsedSeconds = Math.min(
        this.totalSeconds,
        Math.floor(this.currentProgress * this.totalSeconds)
      );

      if (this.currentProgress >= 1) {
        this.handlePlaybackComplete();
      } else {
        this.notify();
      }
    }, intervalMs);
  }

  private handlePlaybackComplete() {
    this.clearTicker();
    this.isPlaying = false;
    this.currentProgress = 0;
    this.elapsedSeconds = 0;

    if (RadiiNativeRadio?.stopAudio) {
      try {
        RadiiNativeRadio.stopAudio().catch(() => {});
      } catch {}
    }

    this.notify();
  }

  private clearTicker() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}

export const AudioPlayer = new AudioPlaybackController();
