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
  | 'read'
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
    | 'ROOM_MSG'
    | 'ROOM_ANNOUNCE'
    | 'ROOM_QUERY'
    | 'ROOM_SYNC'
    | 'ROOM_JOIN'
    | 'ROOM_LEAVE'
    | 'ROOM_DESTROYED'
    | 'MEDIA_TRANSFER_REQUEST'
    | 'MEDIA_TRANSFER_ACCEPT'
    | 'MEDIA_TRANSFER_REJECT'
    | 'MEDIA_PAYLOAD_CHUNK'
    | 'MEDIA_STREAM_END'
    | 'MEDIA_REQUEST_MISSING'
    | 'MEDIA_TRANSFER_COMPLETE'
    | 'MEDIA_TRANSFER_CANCEL'
    | 'CONNECTION_REQUEST'
    | 'CONNECTION_ACCEPTED'
    | 'CONNECTION_DECLINED'
    | 'CONNECTION_DISCONNECTED'
    | 'MSG_ACK'
    | 'MSG_READ'
    | 'TYPING_START'
    | 'TYPING_STOP';
  targetPeerId?: string;
  ackMessageId?: string;
  verificationCode?: string;
  senderDevice?: string;
  isVoice?: boolean;
  audioDurationSeconds?: number;
  audioUri?: string;
  audioBase64?: string;
  isPlusRelay?: boolean;
  isImage?: boolean;
  imageUri?: string;
  isFile?: boolean;
  fileUri?: string;
  isSystem?: boolean;
  roomId?: string;
  roomCode?: string;
  roomName?: string;
  transferId?: string;
  transferType?: 'image' | 'voice' | 'file';
  transferStatus?: 'awaiting_acceptance' | 'transferring' | 'completed' | 'declined' | 'cancelled' | 'failed';
  transferProgress?: number;
  fileName?: string;
  fileSizeBytes?: number;
  ipAddress?: string;
  targetCode?: string;
  description?: string;
  creatorId?: string;
  creatorName?: string;
  chunkIndex?: number;
  totalChunks?: number;
  chunkData?: string;
  mimeType?: string;
  mediaType?: 'image' | 'voice' | 'file';
  missingIndices?: number[];
  members?: string[];
  memberNames?: Record<string, string>;
  senderShortId?: string;
  memberCount?: number;
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
  creatorId?: string;
  creatorName?: string;
  epoch?: number;
  isJoined?: boolean;
  members?: string[];
  memberNames?: Record<string, string>;
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
