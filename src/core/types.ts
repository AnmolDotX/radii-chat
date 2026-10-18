export type TransportType = 'ble' | 'nearby' | 'location' | 'link';

export type NetworkMode = 'offline' | 'online';

export type DevicePlatform = 'android' | 'ios' | 'desktop';

export type DistanceBracket = 'immediate' | 'near' | 'mid' | 'far' | 'out_of_range';

export interface Peer {
  id: string;
  name: string;
  platform: DevicePlatform;
  activeTransport: TransportType;
  availableTransports: TransportType[];
  rssi: number; // dBm e.g. -45 is close, -85 is weak
  distanceBracket: DistanceBracket;
  lastSeen: number; // Unix timestamp ms
  isPaired: boolean;
  avatarSeed: string;
  deviceName?: string;
  batteryLevel?: number;
  statusMessage?: string;
  currentRoomId?: string;
  shortId?: string;
  fullUserId?: string;
  macAddress?: string;
  ipAddress?: string;
}

export type MessageDeliveryStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'queued_offline';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  transport: TransportType;
  status: MessageDeliveryStatus;
  isMe: boolean;
  type?:
    | 'CHAT_MSG'
    | 'CONNECTION_REQUEST'
    | 'CONNECTION_ACCEPTED'
    | 'CONNECTION_DECLINED'
    | 'CONNECTION_DISCONNECTED'
    | 'MSG_ACK';
  targetPeerId?: string;
  ackMessageId?: string;
  verificationCode?: string;
  senderDevice?: string;
  isVoice?: boolean;
  audioDurationSeconds?: number;
  isPlusRelay?: boolean;
}

export interface OutboxItem {
  id: string;
  recipientId: string;
  recipientName: string;
  payload: string;
  queuedAt: number;
  allowedModes: NetworkMode[];
  reason: 'peer_out_of_radio_range' | 'offline_mode_enforced';
  retryCount: number;
}

export interface EventRoom {
  id: string;
  name: string;
  code: string;
  category: 'campus' | 'fest' | 'trek' | 'general';
  memberCount: number;
  isActive: boolean;
  description: string;
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  progressPercent: number; // 0 - 100
  transport: TransportType;
  recipientId: string;
  recipientName: string;
  direction: 'outgoing' | 'incoming';
  status: 'active' | 'completed' | 'failed';
  isCloudDrop?: boolean;
}

export interface SOSAlert {
  id: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  coordinates?: { latitude: number; longitude: number };
  emergencyMessage: string;
  transportBroadcast: TransportType[];
  isActive: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  publicKey: string;
  deviceModel: string;
  deviceName: string;
  visibility: 'everyone' | 'contacts' | 'hidden';
  isInitialSetupDone: boolean;
  joinedAt: number;
}
