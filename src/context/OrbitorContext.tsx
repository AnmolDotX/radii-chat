import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  Peer,
  Message,
  MessageDeliveryStatus,
  NetworkMode,
  OutboxItem,
  EventRoom,
  FileTransfer,
  SOSAlert,
  UserProfile,
} from '../core/types';
import { getLocalProfile, loadPersistedProfile, updateProfile } from '../core/identity';
import { outbox } from '../core/outbox';
import { transportManager } from '../transport/TransportManager';
import {
  normalizePeerId,
  disconnectRadioPeer,
  showLocalNotification,
  readMediaBase64,
  saveMediaBase64,
  checkAppPermissionsStatus,
  requestAppNotificationPermission,
  requestAppStoragePermission,
} from '../transport/NativeRadioTransport';
import { entitlements, EntitlementState } from '../entitlements';
import { IncomingConnectionRequest } from '../components/modals/ConnectionRequestModal';
import { checkRadioPermissions } from '../utils/permissions';

interface OrbitorContextValue {
  myProfile: UserProfile;
  peers: Peer[];
  messages: Record<string, Message[]>;
  networkMode: NetworkMode;
  autoUpgrade: boolean;
  outboxItems: OutboxItem[];
  entitlements: EntitlementState;
  activeSOS: SOSAlert | null;
  eventRooms: EventRoom[];
  fileTransfers: FileTransfer[];
  isScanning: boolean;
  permissionsGranted: boolean;

  // Actions
  setNetworkMode: (mode: NetworkMode) => void;
  setAutoUpgrade: (enabled: boolean) => void;
  sendMessage: (
    peerId: string,
    text: string,
    options?: {
      isVoice?: boolean;
      audioDurationSeconds?: number;
      audioUri?: string;
      audioBase64?: string;
      isImage?: boolean;
      imageUri?: string;
    }
  ) => Promise<boolean>;
  sendVoiceNote: (
    peerId: string,
    durationSec: number,
    audioUri?: string,
    audioBase64?: string
  ) => Promise<boolean>;
  sendMediaTransfer: (
    peerId: string,
    mediaType: 'image' | 'voice' | 'file',
    uri: string,
    base64Data?: string,
    durationSec?: number,
    preferredFileName?: string,
    preferredMimeType?: string
  ) => Promise<boolean>;
  acceptMediaTransfer: (conversationId: string, transferId: string) => Promise<void>;
  declineMediaTransfer: (conversationId: string, transferId: string) => Promise<void>;
  cancelMediaTransfer: (conversationId: string, transferId: string) => Promise<void>;
  retryMediaTransfer: (conversationId: string, transferId: string) => Promise<void>;
  triggerSOS: (message?: string) => void;
  dismissSOS: () => void;
  startFileFling: (peerId: string, fileName: string, sizeBytes: number) => void;
  joinEventRoom: (code: string) => EventRoom;
  createEventRoom: (name: string, description?: string, customCode?: string) => EventRoom;
  startPlusTrial: () => void;
  subscribePlus: () => void;
  canUseFeature: (feature: Parameters<typeof entitlements.can>[0]) => boolean;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  pairPeer: (peerId: string) => void;
  unpairPeer: (peerId: string) => void;
  deleteConversation: (peerId: string) => void;
  deleteEventRoom: (roomId: string) => void;
  removeEventRoom: (roomId: string) => void;
  savedPeers: Peer[];
  savePeer: (peer: Peer) => void;
  typingMap: Record<string, boolean>;
  sendTypingStatus: (peerId: string, isTyping: boolean) => void;
  markChatAsRead: (peerId: string) => void;
  setActiveChatPeerId: (peerId: string | null) => void;
  incomingRequest: IncomingConnectionRequest | null;
  connectionStateMap: Record<string, 'idle' | 'waiting' | 'accepted' | 'declined'>;
  verificationCodeMap: Record<string, string>;
  acceptConnection: (req: IncomingConnectionRequest) => void;
  declineConnection: (req: IncomingConnectionRequest) => void;
  requestConnection: (peer: Peer) => void;
  cancelConnectionRequest: (peerId: string) => void;
  rescan: () => void;
  setPermissionsGranted: (granted: boolean) => void;
}

const OrbitorContext = createContext<OrbitorContextValue | null>(null);

const SAVED_PEERS_KEY = '@radii_saved_peers_v2';
const PERSISTED_MESSAGES_KEY = '@radii_persisted_messages_v2';
const PERSISTED_ROOMS_KEY = '@radii_persisted_rooms_v2';

let AsyncStorageModule: any = null;
try {
  AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
} catch {
  AsyncStorageModule = null;
}

const INITIAL_ROOMS: EventRoom[] = [];

export const OrbitorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [myProfile, setMyProfile] = useState<UserProfile>(getLocalProfile);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [savedPeers, setSavedPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const messagesRef = useRef<Record<string, Message[]>>({});
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [networkMode, setNetworkModeState] = useState<NetworkMode>('offline');
  const [autoUpgrade, setAutoUpgradeState] = useState<boolean>(true);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [entitlementState, setEntitlementState] = useState<EntitlementState>(entitlements.getState());
  const [activeSOS, setActiveSOS] = useState<SOSAlert | null>(null);
  const [eventRooms, setEventRooms] = useState<EventRoom[]>(INITIAL_ROOMS);
  const [fileTransfers, setFileTransfers] = useState<FileTransfer[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false);
  const [incomingRequest, setIncomingRequest] = useState<IncomingConnectionRequest | null>(null);
  const [connectionStateMap, setConnectionStateMap] = useState<Record<string, 'idle' | 'waiting' | 'accepted' | 'declined'>>({});
  const [verificationCodeMap, setVerificationCodeMap] = useState<Record<string, string>>({});
  const cleanupRef = useRef<(() => void) | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRefs = useRef<Record<string, any>>({});

  const startScanWithTimeout = useCallback((durationMs: number = 18000) => {
    setIsScanning(true);
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = setTimeout(() => {
      setIsScanning(false);
    }, durationMs);
  }, []);

  const persistSavedPeers = useCallback((peersToSave: Peer[]) => {
    if (AsyncStorageModule) {
      // Filter out any ghost/corrupt room entries from saved peers
      const sanitized = peersToSave.filter(
        (p) => p && p.id && !p.id.startsWith('room_') && !p.name?.includes('386855')
      );
      AsyncStorageModule.setItem(SAVED_PEERS_KEY, JSON.stringify(sanitized)).catch(() => {});
    }
  }, []);

  const persistRooms = useCallback((roomsToSave: EventRoom[]) => {
    if (AsyncStorageModule) {
      AsyncStorageModule.setItem(PERSISTED_ROOMS_KEY, JSON.stringify(roomsToSave)).catch(() => {});
    }
  }, []);

  const persistMessages = useCallback((msgsToSave: Record<string, Message[]>) => {
    if (AsyncStorageModule) {
      AsyncStorageModule.setItem(PERSISTED_MESSAGES_KEY, JSON.stringify(msgsToSave)).catch(() => {});
    }
  }, []);

  const savePeer = useCallback(
    (peer: Peer) => {
      // CRITICAL: NEVER save room channels as 1-on-1 radio peers!
      if (!peer || !peer.id || peer.id.startsWith('room_') || peer.name?.includes('386855')) {
        return;
      }
      const canonicalId = normalizePeerId(peer.id);
      if (canonicalId.startsWith('room_')) return;
      const shortId = (peer.shortId || canonicalId.slice(-6)).toLowerCase();

      setSavedPeers((prev) => {
        const sanitizedPrev = prev.filter(
          (p) => p && p.id && !p.id.startsWith('room_') && !p.name?.includes('386855')
        );
        const idx = sanitizedPrev.findIndex((p) => p.id === canonicalId || p.id.toLowerCase().endsWith(shortId));
        let updated: Peer[];
        if (idx >= 0) {
          updated = [...sanitizedPrev];
          updated[idx] = { ...sanitizedPrev[idx], ...peer, id: canonicalId, shortId, isPaired: true };
        } else {
          updated = [...sanitizedPrev, { ...peer, id: canonicalId, shortId, isPaired: true }];
        }
        persistSavedPeers(updated);
        return updated;
      });
    },
    [persistSavedPeers]
  );

  const activeChatPeerIdRef = useRef<string | null>(null);
  const setActiveChatPeerId = useCallback((id: string | null) => {
    activeChatPeerIdRef.current = id ? normalizePeerId(id) : null;
  }, []);

  const savedPeersRef = useRef<Peer[]>([]);
  useEffect(() => {
    savedPeersRef.current = savedPeers;
  }, [savedPeers]);

  const peersRef = useRef<Peer[]>([]);
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  const eventRoomsRef = useRef<EventRoom[]>(INITIAL_ROOMS);
  useEffect(() => {
    eventRoomsRef.current = eventRooms;
  }, [eventRooms]);

  const outgoingPayloadsRef = useRef<
    Map<
      string,
      {
        base64: string;
        fileName: string;
        mimeType: string;
        totalChunks: number;
        chunks: string[];
        mediaType: 'image' | 'voice' | 'file';
        durationSec?: number;
        targetId: string;
        roomId?: string;
      }
    >
  >(new Map());

  const incomingPayloadsRef = useRef<
    Map<
      string,
      {
        chunks: Map<number, string>;
        totalChunks: number;
        fileName: string;
        mimeType: string;
        isVoice?: boolean;
        audioDurationSeconds?: number;
        isImage?: boolean;
        isFile?: boolean;
        conversationId: string;
        messageId: string;
        senderId: string;
        isCompleted?: boolean;
        retryAttempts?: number;
      }
    >
  >(new Map());

  const completedTransfersRef = useRef<Set<string>>(new Set());
  const abortedTransfersRef = useRef<Set<string>>(new Set());
  const watchdogTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const scheduleMissingChunksWatchdogRef = useRef<(transferId: string, delayMs?: number) => void>(() => {});

  // Initialize transport and subscriptions
  useEffect(() => {
    let cancelled = false;

    const initTransport = async () => {
      // CRITICAL: Load profile FIRST so identity is stable before native BLE starts
      const persisted = await loadPersistedProfile();
      if (cancelled) return;
      setMyProfile({ ...persisted });

      // Restore saved peers, rooms & message history from disk
      try {
        if (AsyncStorageModule) {
          const isCorruptGhost = (id: string, name?: string) => {
            const lowerId = (id || '').toLowerCase();
            const lowerName = (name || '').toLowerCase();
            return (
              lowerId.startsWith('room_') ||
              lowerId.startsWith('peer_room_') ||
              lowerId.includes('uninitialized') ||
              lowerId.includes('ized_') ||
              lowerId.includes('386855') ||
              lowerName.includes('386855') ||
              lowerName.includes('ized_') ||
              lowerName.includes('uninitialized') ||
              /^\d{4,6}$/.test(id) ||
              /^\d{4,6}$/.test(lowerId.replace('peer_', ''))
            );
          };

          const storedPeers = await AsyncStorageModule.getItem(SAVED_PEERS_KEY);
          if (storedPeers && !cancelled) {
            const parsed = JSON.parse(storedPeers).filter(
              (p: any) => p && p.id && !isCorruptGhost(p.id, p.name)
            );
            setSavedPeers(parsed);
            savedPeersRef.current = parsed;
            // Overwrite AsyncStorage with purged peers
            AsyncStorageModule.setItem(SAVED_PEERS_KEY, JSON.stringify(parsed)).catch(() => {});
          }

          const storedRooms = await AsyncStorageModule.getItem(PERSISTED_ROOMS_KEY);
          if (storedRooms && !cancelled) {
            const parsedRooms: EventRoom[] = JSON.parse(storedRooms).filter(
              (r: any) =>
                r &&
                r.id &&
                r.isJoined === true &&
                !r.id.includes('386855') &&
                !r.code?.includes('386855')
            );
            setEventRooms(parsedRooms);
            eventRoomsRef.current = parsedRooms;
            AsyncStorageModule.setItem(PERSISTED_ROOMS_KEY, JSON.stringify(parsedRooms)).catch(() => {});
          }

          const storedMsgs = await AsyncStorageModule.getItem(PERSISTED_MESSAGES_KEY);
          if (storedMsgs && !cancelled) {
            const parsedMsgs: Record<string, Message[]> = JSON.parse(storedMsgs);
            const sanitizedMsgs: Record<string, Message[]> = {};
            Object.keys(parsedMsgs).forEach((key) => {
              if (!isCorruptGhost(key)) {
                sanitizedMsgs[key] = (parsedMsgs[key] || []).map((m) => {
                  if (m.transferId && (m.transferStatus === 'completed' || m.imageUri || m.audioUri || m.fileUri)) {
                    completedTransfersRef.current.add(m.transferId);
                    return m;
                  }
                  // Any transfer that was left in 'transferring' state across app restart was interrupted: mark as failed so user gets the Retry chip!
                  if (m.transferStatus === 'transferring') {
                    return { ...m, transferStatus: 'failed' as const };
                  }
                  return m;
                });
              }
            });
            setMessages(sanitizedMsgs);
            // Overwrite AsyncStorage with purged messages
            AsyncStorageModule.setItem(PERSISTED_MESSAGES_KEY, JSON.stringify(sanitizedMsgs)).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Error restoring persisted chats:', err);
      }

      // Automatically sync OS permission status on start
      try {
        const hasPerms = await checkRadioPermissions();
        if (!cancelled && hasPerms) {
          setPermissionsGranted(true);
        }
        const permStatus = await checkAppPermissionsStatus();
        if (!permStatus.notifications) {
          await requestAppNotificationPermission();
        }
      } catch (e) {
        console.warn('checkRadioPermissions error:', e);
      }

      const transport = transportManager.getTransport();
      await transportManager.start();
      if (!cancelled) {
        startScanWithTimeout(18000);
      }

      const unsubPeer = transport.onPeerDiscovered((discovered) => {
        const profile = getLocalProfile();
        const myShortId = profile.id.slice(-6).toLowerCase();
        const shortId = (discovered.shortId || discovered.id.slice(-6)).toLowerCase();

        // Discard self-discovery loopback
        if (
          shortId === myShortId ||
          discovered.id === profile.id ||
          discovered.id === `peer_${profile.id}` ||
          discovered.id === `peer_${myShortId}` ||
          discovered.id.toLowerCase().includes(myShortId)
        ) {
          return;
        }

        const canonicalId = `peer_${shortId}`;
        const isAlreadySaved = savedPeersRef.current.some(
          (p) => p.id === canonicalId || p.id.toLowerCase().endsWith(shortId)
        );

        setPeers((prev) => {
          const index = prev.findIndex(
            (p) => p.id === canonicalId || p.id.toLowerCase().endsWith(shortId)
          );

          if (index >= 0) {
            const existing = prev[index];
            const mergedTransports = Array.from(
              new Set([...existing.availableTransports, ...discovered.availableTransports])
            );
            const isNearby = Boolean(
              discovered.ipAddress ||
              existing.ipAddress ||
              existing.isPaired ||
              discovered.isPaired ||
              isAlreadySaved ||
              discovered.activeTransport === 'nearby' ||
              existing.activeTransport === 'nearby'
            );

            const updatedPeer: Peer = {
              ...existing,
              ...discovered,
              id: canonicalId,
              shortId,
              name:
                discovered.name && !discovered.name.startsWith('Radii·') && discovered.name !== 'Radii User'
                  ? discovered.name
                  : existing.name || discovered.name || `Radii·${shortId}`,
              deviceName:
                discovered.deviceName &&
                discovered.deviceName !== 'Radii Radio' &&
                discovered.deviceName !== 'Android Radio'
                  ? discovered.deviceName
                  : existing.deviceName || discovered.deviceName || 'Android Radio',
              isPaired: existing.isPaired || discovered.isPaired || isAlreadySaved,
              availableTransports: mergedTransports,
              activeTransport: isNearby ? 'nearby' : (discovered.activeTransport as any) || 'ble',
              macAddress: discovered.macAddress || existing.macAddress,
              ipAddress: discovered.ipAddress || existing.ipAddress,
              statusMessage: isNearby ? 'Direct Nearby Connection' : 'Direct BLE Radio Signal',
            };

            const updated = [...prev];
            updated[index] = updatedPeer;
            return updated;
          }

          const isNearby = Boolean(
            discovered.ipAddress ||
            discovered.isPaired ||
            isAlreadySaved ||
            discovered.activeTransport === 'nearby'
          );
          return [
            ...prev,
            {
              ...discovered,
              id: canonicalId,
              shortId,
              isPaired: isAlreadySaved,
              activeTransport: isNearby ? 'nearby' : (discovered.activeTransport as any) || 'ble',
              statusMessage: isNearby ? 'Direct Nearby Connection' : 'Direct BLE Radio Signal',
            },
          ];
        });

        // Update live status in savedPeers if previously saved
        setSavedPeers((prev) => {
          const idx = prev.findIndex((p) => p.id === canonicalId || p.id.toLowerCase().endsWith(shortId));
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...discovered, id: canonicalId, shortId, isPaired: true, lastSeen: Date.now() };
            persistSavedPeers(updated);
            return updated;
          }
          return prev;
        });

        // Auto-deliver any unacknowledged or queued messages
        setMessages((prev) => {
          const list = prev[canonicalId] || [];
          const unacked = list.filter((m) => m.isMe && (m.status === 'queued_offline' || m.status === 'sent'));
          if (unacked.length > 0) {
            unacked.forEach((msg) => {
              transportManager.sendPacket(canonicalId, {
                id: msg.id,
                type: 'CHAT_MSG',
                senderId: `peer_${myShortId}`,
                senderShortId: myShortId,
                fullSenderId: profile.id,
                senderName: profile.displayName || profile.deviceName || 'Radii User',
                targetPeerId: canonicalId,
                targetShortId: shortId,
                text: msg.text,
                timestamp: msg.timestamp,
              }).catch(() => {});
            });
          }
          return prev;
        });

        // Drain zero-leak outbox items for this peer now that direct radio link is active
        const pendingOutbox = outbox.getItems().filter(
          (i) => i.recipientId === canonicalId || i.recipientId.endsWith(shortId)
        );
        pendingOutbox.forEach((item) => outbox.dequeue(item.id));

        // 1. Announce any active joined rooms directly to this newly discovered peer
        const activeRooms = eventRoomsRef.current.filter(
          (r) => r && r.isJoined && (r.memberCount === undefined || r.memberCount > 0)
        );
        activeRooms.forEach((r) => {
          const announcePacket = {
            id: `ann_peer_${Date.now()}_${r.code}`,
            type: 'ROOM_ANNOUNCE',
            roomId: r.id,
            roomCode: r.code,
            roomName: r.name,
            description: r.description,
            creatorId: r.creatorId,
            creatorName: r.creatorName,
            memberCount: r.memberCount || r.members?.length || 1,
            members: r.members || [myShortId],
            memberNames: r.memberNames || {},
            senderId: `peer_${myShortId}`,
            senderShortId: myShortId,
            senderName: profile.displayName || profile.deviceName || 'Radii User',
            timestamp: Date.now(),
          };
          transportManager.sendPacket(canonicalId, announcePacket).catch(() => {});
        });

        // 2. Query this newly discovered peer for any rooms they are hosting
        const queryPacket = {
          id: `query_peer_${Date.now()}`,
          type: 'ROOM_QUERY',
          senderId: `peer_${myShortId}`,
          senderShortId: myShortId,
          timestamp: Date.now(),
        };
        transportManager.sendPacket(canonicalId, queryPacket).catch(() => {});
      });

      const unsubPeerLost = transport.onPeerLost((lostId) => {
        const canonicalId = normalizePeerId(lostId);
        const shortId = lostId.slice(-6).toLowerCase();
        setPeers((prev) =>
          prev.filter((p) => p.id !== lostId && p.id !== canonicalId && !p.id.toLowerCase().endsWith(shortId))
        );
      });

      const unsubMsg = transport.onMessageReceived((incoming) => {
        const msgType = (incoming.type || 'CHAT_MSG') as string;
        const senderShortId = incoming.senderId.slice(-6).toLowerCase();
        const canonicalSenderId = `peer_${senderShortId}`;

        // 1. INCOMING CONNECTION REQUEST
        if (msgType === 'CONNECTION_REQUEST') {
          const profile = getLocalProfile();
          const myShortId = profile.id.slice(-6).toLowerCase();
          const targetShortId = (incoming.targetPeerId || '').slice(-6).toLowerCase();

          if (!targetShortId || targetShortId === myShortId) {
            setIncomingRequest({
              id: incoming.id,
              peerId: canonicalSenderId,
              peerName: incoming.senderName,
              peerDevice: incoming.senderDevice || 'Nearby Device',
              verificationCode: incoming.verificationCode || '4829',
              transport: incoming.transport === 'nearby' ? 'nearby' : 'ble',
            });
          }
          return;
        }

        // 2. INCOMING CONNECTION ACCEPTED
        if (msgType === 'CONNECTION_ACCEPTED') {
          setConnectionStateMap((prev) => ({
            ...prev,
            [incoming.senderId]: 'accepted',
            [canonicalSenderId]: 'accepted',
            [`ble_${senderShortId}`]: 'accepted',
            [`wifi_${incoming.senderId}`]: 'accepted',
          }));

          setPeers((prev) =>
            prev.map((p) => {
              if (p.id === canonicalSenderId || p.id.toLowerCase().endsWith(senderShortId)) {
                return {
                  ...p,
                  isPaired: true,
                  activeTransport: 'nearby',
                  statusMessage: 'Direct Nearby Connection',
                  ipAddress: incoming.ipAddress || p.ipAddress,
                };
              }
              return p;
            })
          );

          savePeer({
            id: canonicalSenderId,
            shortId: senderShortId,
            name: incoming.senderName || `Radii·${senderShortId}`,
            platform: 'android',
            activeTransport: 'nearby',
            availableTransports: ['nearby', 'ble'],
            rssi: -50,
            distanceBracket: 'near',
            lastSeen: Date.now(),
            isPaired: true,
            avatarSeed: incoming.senderName,
            deviceName: incoming.senderDevice,
            ipAddress: incoming.ipAddress,
            statusMessage: 'Direct Nearby Connection',
          });
          return;
        }

        // 3. INCOMING CONNECTION DECLINED
        if (msgType === 'CONNECTION_DECLINED') {
          setConnectionStateMap((prev) => ({
            ...prev,
            [incoming.senderId]: 'declined',
            [canonicalSenderId]: 'declined',
            [`ble_${senderShortId}`]: 'declined',
          }));
          return;
        }

        // 4. INCOMING CONNECTION DISCONNECTED
        if (msgType === 'CONNECTION_DISCONNECTED') {
          setSavedPeers((prev) => {
            const updated = prev.filter(
              (p) =>
                p.id !== canonicalSenderId &&
                !p.id.toLowerCase().endsWith(senderShortId)
            );
            persistSavedPeers(updated);
            return updated;
          });

          setPeers((prev) =>
            prev.map((p) => {
              if (p.id === canonicalSenderId || p.id.toLowerCase().endsWith(senderShortId)) {
                return { ...p, isPaired: false };
              }
              return p;
            })
          );
          setMessages((prev) => {
            const next = { ...prev };
            delete next[incoming.senderId];
            delete next[canonicalSenderId];
            delete next[senderShortId];
            delete next[`peer_${senderShortId}`];
            persistMessages(next);
            return next;
          });
          setConnectionStateMap((prev) => {
            const next = { ...prev };
            delete next[incoming.senderId];
            delete next[canonicalSenderId];
            delete next[`ble_${senderShortId}`];
            return next;
          });
          disconnectRadioPeer(canonicalSenderId).catch(() => {});
          return;
        }

        // 5. MSG_ACK (Delivery Confirmation from recipient -> Double Grey Tick across 1-on-1 and Rooms)
        if (msgType === 'MSG_ACK' && incoming.ackMessageId) {
          setMessages((prev) => {
            let changed = false;
            const updated: Record<string, Message[]> = {};
            for (const [key, msgList] of Object.entries(prev)) {
              let listChanged = false;
              const newList = msgList.map((m) => {
                if (m.id === incoming.ackMessageId && m.status !== 'read') {
                  listChanged = true;
                  return { ...m, status: 'delivered' as MessageDeliveryStatus };
                }
                return m;
              });
              if (listChanged) {
                changed = true;
                updated[key] = newList;
              } else {
                updated[key] = msgList;
              }
            }
            if (changed) {
              persistMessages(updated);
              return updated;
            }
            return prev;
          });

          // Dequeue matching outbox items
          const pending = outbox.getItems().filter(
            (i) =>
              i.recipientId === canonicalSenderId ||
              i.recipientId.endsWith(senderShortId) ||
              i.id === incoming.ackMessageId
          );
          pending.forEach((p) => outbox.dequeue(p.id));
          return;
        }

        // 6. MSG_READ (Read Confirmation from recipient -> Double Blue Tick)
        if (msgType === 'MSG_READ') {
          setMessages((prev) => {
            const list = prev[canonicalSenderId] || [];
            const updated = {
              ...prev,
              [canonicalSenderId]: list.map((m) =>
                m.isMe ? { ...m, status: 'read' as MessageDeliveryStatus } : m
              ),
            };
            persistMessages(updated);
            return updated;
          });
          return;
        }

        // 7. TYPING_START
        if (msgType === 'TYPING_START') {
          setTypingMap((prev) => ({ ...prev, [canonicalSenderId]: true }));
          if (typingTimeoutRefs.current[canonicalSenderId]) {
            clearTimeout(typingTimeoutRefs.current[canonicalSenderId]);
          }
          typingTimeoutRefs.current[canonicalSenderId] = setTimeout(() => {
            setTypingMap((prev) => ({ ...prev, [canonicalSenderId]: false }));
          }, 3500);
          return;
        }

        // 8. TYPING_STOP
        if (msgType === 'TYPING_STOP') {
          if (typingTimeoutRefs.current[canonicalSenderId]) {
            clearTimeout(typingTimeoutRefs.current[canonicalSenderId]);
          }
          setTypingMap((prev) => ({ ...prev, [canonicalSenderId]: false }));
          return;
        }

        // 8b. ROOM DISCOVERY, MEMBERSHIP & SYNC
        if (msgType === 'ROOM_QUERY') {
          const queryCode = (incoming.targetCode || incoming.roomCode || '').trim().toUpperCase();
          const match = eventRoomsRef.current.find((r) => r.code === queryCode || r.id === `room_${queryCode}`);
          if (match && (match.memberCount === undefined || match.memberCount > 0)) {
            const profile = getLocalProfile();
            const myShort = profile.id.slice(-6).toLowerCase();
            const syncPacket = {
              type: 'ROOM_SYNC',
              id: `sync_${Date.now()}`,
              roomId: match.id,
              roomCode: match.code,
              roomName: match.name,
              description: match.description,
              creatorId: match.creatorId,
              creatorName: match.creatorName,
              epoch: match.epoch || 1,
              memberCount: match.memberCount || (match.members?.length || 1),
              members: match.members || [],
              memberNames: match.memberNames || {},
              senderId: `peer_${myShort}`,
              targetPeerId: canonicalSenderId,
              timestamp: Date.now(),
            };
            transportManager.sendPacket(canonicalSenderId, syncPacket).catch(() => {});
            transportManager.sendPacket('broadcast', syncPacket).catch(() => {});
          }
          return;
        }

        // A peer is querying for active rooms nearby
        if (msgType === 'ROOM_QUERY') {
          const profile = getLocalProfile();
          const myShort = profile.id.slice(-6).toLowerCase();
          const activeRooms = eventRoomsRef.current.filter(
            (r) => r && r.isJoined && (r.memberCount === undefined || r.memberCount > 0)
          );
          activeRooms.forEach((r) => {
            const announcePacket = {
              id: `ann_reply_${Date.now()}_${r.code}`,
              type: 'ROOM_ANNOUNCE',
              roomId: r.id,
              roomCode: r.code,
              roomName: r.name,
              description: r.description,
              creatorId: r.creatorId,
              creatorName: r.creatorName,
              memberCount: r.memberCount || r.members?.length || 1,
              members: r.members || [myShort],
              memberNames: r.memberNames || {},
              senderId: `peer_${myShort}`,
              senderShortId: myShort,
              senderName: profile.displayName || 'Host',
              timestamp: Date.now(),
            };
            transportManager.sendPacket(canonicalSenderId, announcePacket).catch(() => {});
          });
          return;
        }

        // Room owner deleted the room -> kick everyone out and delete completely
        if (msgType === 'ROOM_DESTROYED') {
          const roomCode = (incoming.roomCode || '').trim().toUpperCase();
          const targetRoomId = incoming.roomId || `room_${roomCode}`;
          const hostName = incoming.senderName || 'The host';

          // 1. Remove room completely from eventRooms
          setEventRooms((prev) => {
            const updated = prev.filter(
              (r) => r.id !== targetRoomId && r.code !== roomCode
            );
            persistRooms(updated);
            return updated;
          });

          // 2. Add system notice to room chat
          const sysMsg: Message = {
            id: `sys_destroy_${Date.now()}`,
            conversationId: targetRoomId,
            roomId: targetRoomId,
            roomCode,
            senderId: 'system',
            senderName: 'System',
            text: `⚠️ ${hostName} has deleted the room. Everyone has been removed.`,
            timestamp: Date.now(),
            transport: 'nearby',
            status: 'delivered',
            isMe: false,
            isSystem: true,
          };

          setMessages((prev) => {
            const list = prev[targetRoomId] || (roomCode ? prev[roomCode] : []) || [];
            const updated = {
              ...prev,
              [targetRoomId]: [...list, sysMsg],
            };
            if (roomCode) {
              updated[roomCode] = [...list, sysMsg];
            }
            persistMessages(updated);
            return updated;
          });

          // 3. Emit room destroyed event so active chat screen kicks user out
          DeviceEventEmitter.emit('ROOM_KICKED_OUT', {
            roomId: targetRoomId,
            roomCode,
            reason: `${hostName} has deleted this room. Everyone has been removed.`,
          });

          // 4. If the user is NOT currently inside this room, send a system notification!
          const isUserInThisRoom =
            activeChatPeerIdRef.current === targetRoomId ||
            activeChatPeerIdRef.current === roomCode ||
            activeChatPeerIdRef.current === `room_${roomCode}`;

          if (!isUserInThisRoom) {
            transportManager.showNotification(
              'Room Deleted',
              `⚠️ ${hostName} has deleted the room. Everyone has been removed.`,
              targetRoomId
            );
          }
          return;
        }

        // A peer joined the room
        if (msgType === 'ROOM_JOIN') {
          const roomCode = (incoming.roomCode || '').trim().toUpperCase();
          const targetRoomId = incoming.roomId || `room_${roomCode}`;
          const joinerShort = incoming.senderShortId || (incoming.senderId || '').slice(-6).toLowerCase();
          const joinerName = incoming.senderName || 'A companion';

          let updatedMembers: string[] = [];
          let updatedNames: Record<string, string> = {};

          setEventRooms((prev) => {
            const updated = prev.map((r) => {
              if (r.id === targetRoomId || (roomCode && r.code === roomCode)) {
                const existingMembers = r.members || (r.creatorId ? [r.creatorId.slice(-6).toLowerCase()] : []);
                updatedMembers = Array.from(new Set([...existingMembers, joinerShort]));
                updatedNames = { ...(r.memberNames || {}), [joinerShort]: joinerName };
                return {
                  ...r,
                  members: updatedMembers,
                  memberNames: updatedNames,
                  memberCount: updatedMembers.length,
                };
              }
              return r;
            });
            persistRooms(updated);
            return updated;
          });

          // Insert system message: "[Name] joined the room"
          const joinMsg: Message = {
            id: `sys_join_${incoming.id || Date.now()}`,
            conversationId: targetRoomId,
            roomId: targetRoomId,
            roomCode,
            senderId: 'system',
            senderName: 'System',
            text: `👋 ${joinerName} joined the room`,
            timestamp: incoming.timestamp || Date.now(),
            transport: 'nearby',
            status: 'delivered',
            isMe: false,
            isSystem: true,
          };

          setMessages((prev) => {
            const list = prev[targetRoomId] || (roomCode ? prev[roomCode] : []) || [];
            if (
              list.some(
                (m) =>
                  m.id === joinMsg.id ||
                  (m.text === joinMsg.text && Math.abs(m.timestamp - joinMsg.timestamp) < 5000)
              )
            ) {
              return prev;
            }
            const updated = {
              ...prev,
              [targetRoomId]: [...list, joinMsg],
            };
            if (roomCode) {
              updated[roomCode] = [...list, joinMsg];
            }
            persistMessages(updated);
            return updated;
          });

          // If current user is host of this room, reply with ROOM_SYNC so everyone stays in sync
          const profile = getLocalProfile();
          const myShort = profile.id.slice(-6).toLowerCase();
          const currentRoom = eventRoomsRef.current.find(
            (r) => r.id === targetRoomId || r.code === roomCode
          );
          const isMyRoom =
            currentRoom?.creatorId === profile.id ||
            currentRoom?.creatorId === `peer_${myShort}` ||
            currentRoom?.creatorId?.toLowerCase().endsWith(myShort);

          if (isMyRoom && currentRoom) {
            const fullMembers = Array.from(
              new Set([...(currentRoom.members || [myShort]), joinerShort])
            );
            const fullNames = {
              ...(currentRoom.memberNames || { [myShort]: profile.displayName || 'Host' }),
              [joinerShort]: joinerName,
            };
            const syncPacket = {
              type: 'ROOM_SYNC',
              id: `sync_${Date.now()}`,
              roomId: currentRoom.id,
              roomCode: currentRoom.code,
              roomName: currentRoom.name,
              description: currentRoom.description,
              creatorId: currentRoom.creatorId,
              creatorName: currentRoom.creatorName,
              epoch: currentRoom.epoch || 1,
              memberCount: fullMembers.length,
              members: fullMembers,
              memberNames: fullNames,
              senderId: `peer_${myShort}`,
              senderShortId: myShort,
              timestamp: Date.now(),
            };
            transportManager.sendPacket('broadcast', syncPacket).catch(() => {});
          }
          return;
        }

        // A peer left the room
        if (msgType === 'ROOM_LEAVE') {
          const roomCode = (incoming.roomCode || '').trim().toUpperCase();
          const targetRoomId = incoming.roomId || (roomCode ? `room_${roomCode}` : '');
          const leaverShort = incoming.senderShortId || (incoming.senderId || '').slice(-6).toLowerCase();
          const leaverName = incoming.senderName || 'A companion';

          let isRoomEmpty = false;

          setEventRooms((prev) => {
            const updated: EventRoom[] = [];
            for (const r of prev) {
              if (r.id === targetRoomId || (roomCode && r.code === roomCode)) {
                const existingMembers = r.members || [];
                const remainingMembers = existingMembers.filter((m) => m !== leaverShort);
                const remainingCount = remainingMembers.length;

                // If everyone has left, destroy/remove room completely!
                if (remainingCount <= 0) {
                  isRoomEmpty = true;
                  continue; // Drop completely from list
                }

                const updatedNames = { ...(r.memberNames || {}) };
                delete updatedNames[leaverShort];

                updated.push({
                  ...r,
                  members: remainingMembers,
                  memberNames: updatedNames,
                  memberCount: remainingCount,
                });
              } else {
                updated.push(r);
              }
            }
            persistRooms(updated);
            return updated;
          });

          // Insert system message: "[Name] left the room"
          const leaveMsg: Message = {
            id: `sys_leave_${incoming.id || Date.now()}`,
            conversationId: targetRoomId,
            roomId: targetRoomId,
            roomCode,
            senderId: 'system',
            senderName: 'System',
            text: `🚪 ${leaverName} left the room`,
            timestamp: incoming.timestamp || Date.now(),
            transport: 'nearby',
            status: 'delivered',
            isMe: false,
            isSystem: true,
          };

          setMessages((prev) => {
            const list = prev[targetRoomId] || (roomCode ? prev[roomCode] : []) || [];
            if (
              list.some(
                (m) =>
                  m.id === leaveMsg.id ||
                  (m.text === leaveMsg.text && Math.abs(m.timestamp - leaveMsg.timestamp) < 5000)
              )
            ) {
              return prev;
            }
            const updated = {
              ...prev,
              [targetRoomId]: [...list, leaveMsg],
            };
            if (roomCode) {
              updated[roomCode] = [...list, leaveMsg];
            }
            persistMessages(updated);
            return updated;
          });

          if (isRoomEmpty) {
            DeviceEventEmitter.emit('ROOM_KICKED_OUT', {
              roomId: targetRoomId,
              roomCode,
              reason: 'All members have left the room. Room has been closed.',
            });
          }
          return;
        }

        if (msgType === 'ROOM_SYNC' || msgType === 'ROOM_ANNOUNCE') {
          const roomCode = (incoming.roomCode || '').trim().toUpperCase();
          const targetRoomId = incoming.roomId || `room_${roomCode}`;
          const officialName = incoming.roomName || `Room ${roomCode}`;
          const incomingMemberCount = incoming.memberCount ?? (incoming.members?.length ?? 1);

          // If room has 0 members, it was abandoned/destroyed -> do not show in Nearby list!
          if (incomingMemberCount <= 0 || (incoming.members && incoming.members.length === 0)) {
            setEventRooms((prev) => {
              const updated = prev.filter((r) => r.id !== targetRoomId && r.code !== roomCode);
              persistRooms(updated);
              return updated;
            });
            return;
          }

          setEventRooms((prev) => {
            const existingIndex = prev.findIndex(
              (r) => r.id === targetRoomId || (roomCode && r.code === roomCode)
            );
            if (existingIndex >= 0) {
              const existing = prev[existingIndex];
              const updatedList = [...prev];
              updatedList[existingIndex] = {
                ...existing,
                name: officialName,
                description: incoming.description || existing.description,
                creatorId: incoming.creatorId || existing.creatorId,
                creatorName: incoming.creatorName || existing.creatorName,
                memberCount: incomingMemberCount,
                members:
                  incoming.members ||
                  existing.members ||
                  (existing.creatorId ? [existing.creatorId.slice(-6).toLowerCase()] : []),
                memberNames: incoming.memberNames || existing.memberNames || {},
                isJoined: existing.isJoined ?? false,
              };
              persistRooms(updatedList);
              return updatedList;
            }

            // Discovered in radio range: must enter 4-digit PIN to join!
            const newRoom: EventRoom = {
              id: targetRoomId,
              name: officialName,
              code: roomCode,
              category: 'campus',
              memberCount: incomingMemberCount,
              isActive: true,
              description: incoming.description || 'Offline LAN & Mesh Channel',
              creatorId: incoming.creatorId,
              creatorName: incoming.creatorName,
              members:
                incoming.members ||
                (incoming.creatorId ? [incoming.creatorId.slice(-6).toLowerCase()] : []),
              memberNames: incoming.memberNames || {},
              isJoined: false,
            };
            const updatedList = [...prev, newRoom];
            persistRooms(updatedList);
            return updatedList;
          });
          return;
        }

        // Helper to finalize and persist completed media transfer
        const finalizeReceivedMedia = async (transferId: string) => {
          const wd = watchdogTimersRef.current.get(transferId);
          if (wd) {
            clearTimeout(wd);
            watchdogTimersRef.current.delete(transferId);
          }
          completedTransfersRef.current.add(transferId);
          const record = incomingPayloadsRef.current.get(transferId);
          if (!record || record.isCompleted) return;
          if (record.chunks.size < record.totalChunks) return;
          record.isCompleted = true;

          let savedLocalUri: string | null = null;
          let fullBase64 = '';
          try {
            fullBase64 = Array.from({ length: record.totalChunks }, (_, i) => record.chunks.get(i) || '').join('');
            if (fullBase64.length > 0) {
              savedLocalUri = await saveMediaBase64(record.fileName, fullBase64, record.mimeType);
            }
          } catch (err) {
            console.warn('[OrbitorContext] saveMediaBase64 warning, falling back to cached uri:', err);
          }

          const fallbackUri = fullBase64 ? `data:${record.mimeType};base64,${fullBase64}` : null;
          const effectiveUri = savedLocalUri || fallbackUri;

          setMessages((prev) => {
            const updated: Record<string, Message[]> = {};
            for (const key of Object.keys(prev)) {
              updated[key] = prev[key].map((m) =>
                m.transferId === transferId
                  ? {
                      ...m,
                      transferStatus: 'completed',
                      transferProgress: 100,
                      imageUri: record.isImage ? (effectiveUri || m.imageUri) : m.imageUri,
                      audioUri: record.isVoice ? (effectiveUri || m.audioUri) : m.audioUri,
                      fileUri: record.isFile ? (effectiveUri || m.fileUri) : m.fileUri,
                      status: 'delivered',
                    }
                  : m
              );
            }
            persistMessages(updated);
            return updated;
          });

          const profile = getLocalProfile();
          const myShort = profile.id.slice(-6).toLowerCase();
          const compPacket = {
            type: 'MEDIA_TRANSFER_COMPLETE',
            id: `comp_${Date.now()}`,
            transferId,
            senderId: `peer_${myShort}`,
            targetPeerId: record.senderId,
            timestamp: Date.now(),
          };
          transportManager.sendPacket(record.senderId, compPacket).catch(() => {});
          transportManager.sendPacket('broadcast', compPacket).catch(() => {});

          // Drain outbox items for this peer
          const pendingOutbox = outbox.getItems().filter(
            (i) => i.recipientId === record.senderId || i.recipientId.endsWith(record.senderId.slice(-6).toLowerCase())
          );
          pendingOutbox.forEach((item) => outbox.dequeue(item.id));

          setTimeout(() => {
            incomingPayloadsRef.current.delete(transferId);
          }, 120000);
        };

        const scheduleMissingChunksWatchdog = (transferId: string, delayMs = 1500) => {
          const existingWd = watchdogTimersRef.current.get(transferId);
          if (existingWd) {
            clearTimeout(existingWd);
            watchdogTimersRef.current.delete(transferId);
          }

          const watchdogTimer = setTimeout(() => {
            watchdogTimersRef.current.delete(transferId);
            const currentRec = incomingPayloadsRef.current.get(transferId);
            if (
              !currentRec ||
              currentRec.isCompleted ||
              completedTransfersRef.current.has(transferId) ||
              abortedTransfersRef.current.has(transferId)
            ) {
              return;
            }

            const missing: number[] = [];
            for (let i = 0; i < currentRec.totalChunks; i++) {
              if (!currentRec.chunks.has(i)) {
                missing.push(i);
              }
            }

            if (missing.length === 0) {
              completedTransfersRef.current.add(transferId);
              finalizeReceivedMedia(transferId);
              return;
            }

            currentRec.retryAttempts = (currentRec.retryAttempts || 0) + 1;
            console.log(
              `[Media Watchdog] Transfer ${transferId} stalled at ${currentRec.chunks.size}/${currentRec.totalChunks}. Auto-requesting ${missing.length} missing chunks (attempt ${currentRec.retryAttempts}/5)`
            );

            const profile = getLocalProfile();
            const myShort = profile.id.slice(-6).toLowerCase();
            const isRoom = Boolean(currentRec.conversationId.startsWith('room_'));
            const reqPacket = {
              type: 'MEDIA_REQUEST_MISSING',
              id: `req_missing_watchdog_${Date.now()}_${currentRec.retryAttempts}`,
              transferId,
              missingIndices: missing,
              senderId: `peer_${myShort}`,
              senderShortId: myShort,
              targetPeerId: currentRec.senderId,
              roomId: isRoom ? currentRec.conversationId : undefined,
              timestamp: Date.now(),
            };

            if (isRoom) {
              transportManager.sendPacket('broadcast', reqPacket).catch(() => {});
            } else {
              transportManager.sendPacket(currentRec.senderId, reqPacket).catch(() => {});
              transportManager.sendPacket('broadcast', reqPacket).catch(() => {});
            }

            if (currentRec.retryAttempts >= 5) {
              // After 5 attempts (~10 seconds of retries), mark message as failed so user gets prominent Retry chip
              setMessages((prev) => {
                const list = prev[currentRec.conversationId] || [];
                const updated = {
                  ...prev,
                  [currentRec.conversationId]: list.map((m) =>
                    m.transferId === transferId && m.transferStatus === 'transferring'
                      ? { ...m, transferStatus: 'failed' as const }
                      : m
                  ),
                };
                persistMessages(updated);
                return updated;
              });
            } else {
              // Re-check again in 2000ms
              scheduleMissingChunksWatchdog(transferId, 2000);
            }
          }, delayMs);

          watchdogTimersRef.current.set(transferId, watchdogTimer);
        };
        scheduleMissingChunksWatchdogRef.current = scheduleMissingChunksWatchdog;

        // 8c. NEARBY SHARE / MEDIA TRANSFER PROTOCOL
        if (msgType === 'MEDIA_TRANSFER_REQUEST') {
          const isRoom = Boolean(incoming.roomId || incoming.roomCode);
          const roomCode = (incoming.roomCode || '').trim().toUpperCase();
          const targetRoomId = isRoom ? (incoming.roomId || `room_${roomCode}`) : canonicalSenderId;
          const officialName = incoming.roomName || (isRoom ? `Room ${roomCode}` : incoming.senderName || 'Nearby Companion');

          if (isRoom) {
            const room = eventRoomsRef.current.find(
              (r) => r.id === targetRoomId || (roomCode && r.code === roomCode)
            );
            // If room is not joined by user, discard transfer request
            if (!room || !room.isJoined) {
              return;
            }
          } else {
            const isSenderSavedOrPaired = savedPeersRef.current.some(
              (p) => p.id === canonicalSenderId || p.id.toLowerCase().endsWith(senderShortId)
            );
            if (!isSenderSavedOrPaired) {
              return;
            }
          }

          const requestMsg: Message = {
            id: incoming.id || `msg_${Date.now()}`,
            conversationId: targetRoomId,
            roomId: isRoom ? targetRoomId : undefined,
            roomCode: isRoom ? roomCode : undefined,
            roomName: isRoom ? officialName : undefined,
            senderId: canonicalSenderId,
            senderName: incoming.senderName || 'Nearby Companion',
            text: incoming.text || (incoming.transferType === 'voice' ? '🎙 Voice note' : incoming.transferType === 'file' ? `📁 ${incoming.fileName || 'Document'}` : '📷 Photo'),
            timestamp: incoming.timestamp || Date.now(),
            transport: 'nearby',
            status: 'delivered',
            isMe: false,
            isVoice: incoming.transferType === 'voice' || incoming.isVoice,
            audioDurationSeconds: incoming.audioDurationSeconds,
            isImage: incoming.transferType === 'image' || incoming.isImage,
            isFile: incoming.transferType === 'file' || incoming.isFile,
            fileUri: undefined,
            imageUri: undefined,
            audioUri: undefined,
            mimeType: incoming.mimeType,
            transferId: incoming.transferId,
            transferType: incoming.transferType || (incoming.isVoice ? 'voice' : incoming.isFile ? 'file' : 'image'),
            transferStatus: 'awaiting_acceptance',
            transferProgress: 0,
            fileName: incoming.fileName,
            fileSizeBytes: incoming.fileSizeBytes,
          };

          setMessages((prev) => {
            const list = prev[targetRoomId] || [];
            if (list.some((m) => m.id === requestMsg.id || (m.transferId && m.transferId === requestMsg.transferId))) return prev;
            const updated = {
              ...prev,
              [targetRoomId]: [...list, requestMsg],
            };
            persistMessages(updated);
            return updated;
          });

          // Acknowledge receipt of media card back to sender immediately -> sender gets double ticks (✓✓)
          const profile = getLocalProfile();
          const myShortId = profile.id.slice(-6).toLowerCase();
          transportManager.sendPacket(canonicalSenderId, {
            type: 'MSG_ACK',
            id: `ack_${Date.now()}`,
            ackMessageId: requestMsg.id,
            senderId: `peer_${myShortId}`,
            senderShortId: myShortId,
            targetPeerId: canonicalSenderId,
            targetShortId: senderShortId,
            timestamp: Date.now(),
          }).catch(() => {});

          if (activeChatPeerIdRef.current !== targetRoomId && activeChatPeerIdRef.current !== roomCode) {
            showLocalNotification(
              officialName,
              incoming.transferType === 'voice'
                ? 'Sent a voice note. Tap to accept.'
                : incoming.transferType === 'file'
                ? `Sent a file: ${incoming.fileName || 'Document'}. Tap to accept.`
                : 'Sent a photo. Tap to accept.',
              targetRoomId
            );
          }
          return;
        }

        if (msgType === 'MEDIA_TRANSFER_ACCEPT') {
          const transferId = incoming.transferId;
          if (!transferId) return;
          if (abortedTransfersRef.current.has(transferId)) return;
          const payload = outgoingPayloadsRef.current.get(transferId);
          if (!payload) return;

          // Update sender message status to transferring
          setMessages((prev) => {
            const updated: Record<string, Message[]> = {};
            for (const key of Object.keys(prev)) {
              updated[key] = prev[key].map((m) =>
                m.transferId === transferId
                  ? { ...m, transferStatus: 'transferring', transferProgress: 5 }
                  : m
              );
            }
            persistMessages(updated);
            return updated;
          });

          // Stream chunks asynchronously with 60ms pacing to prevent Android socket buffer congestion
          const { chunks, totalChunks, fileName, mimeType, mediaType, durationSec, targetId } = payload;
          const profile = getLocalProfile();
          const myShort = profile.id.slice(-6).toLowerCase();
          const targetPeer = incoming.senderId || targetId;
          const isRoomTransfer = Boolean(incoming.roomId || (targetId && targetId.startsWith('room_')));

          (async () => {
            for (let i = 0; i < totalChunks; i++) {
              if (abortedTransfersRef.current.has(transferId)) {
                break;
              }
              const chunkPacket = {
                id: `chunk_${transferId}_${i}`,
                type: 'MEDIA_PAYLOAD_CHUNK',
                transferId,
                chunkIndex: i,
                totalChunks,
                chunkData: chunks[i],
                fileName,
                mimeType,
                mediaType,
                audioDurationSeconds: durationSec,
                senderId: `peer_${myShort}`,
                senderShortId: myShort,
                targetPeerId: isRoomTransfer ? undefined : targetPeer,
                roomId: isRoomTransfer ? (incoming.roomId || targetId) : undefined,
                timestamp: Date.now(),
              };

              if (isRoomTransfer) {
                await transportManager.sendPacket('broadcast', chunkPacket);
              } else {
                await transportManager.sendPacket(targetPeer, chunkPacket);
              }

              // Keep status as 'transferring' and progress up to 99%. Wait for receiver handshake for 100%!
              const pct = Math.min(99, Math.round(((i + 1) / totalChunks) * 99));
              setMessages((prev) => {
                const updated: Record<string, Message[]> = {};
                for (const key of Object.keys(prev)) {
                  updated[key] = prev[key].map((m) =>
                    m.transferId === transferId
                      ? {
                          ...m,
                          transferProgress: Math.max(m.transferProgress || 0, pct),
                          transferStatus: 'transferring',
                        }
                      : m
                  );
                }
                persistMessages(updated);
                return updated;
              });

              if (totalChunks > 1) {
                await new Promise((res) => setTimeout(res, 60));
              }
            }

            if (abortedTransfersRef.current.has(transferId)) {
              return;
            }

            // Burst complete: send stream end indicator with redundant triple burst
            const endPacket = {
              id: `end_${Date.now()}`,
              type: 'MEDIA_STREAM_END',
              transferId,
              totalChunks,
              senderId: `peer_${myShort}`,
              senderShortId: myShort,
              targetPeerId: isRoomTransfer ? undefined : targetPeer,
              roomId: isRoomTransfer ? (incoming.roomId || targetId) : undefined,
              timestamp: Date.now(),
            };
            for (let burst = 0; burst < 3; burst++) {
              if (abortedTransfersRef.current.has(transferId)) break;
              if (isRoomTransfer) {
                transportManager.sendPacket('broadcast', endPacket).catch(() => {});
              } else {
                transportManager.sendPacket(targetPeer, endPacket).catch(() => {});
                transportManager.sendPacket('broadcast', endPacket).catch(() => {});
              }
              if (burst < 2) {
                await new Promise((res) => setTimeout(res, 120));
              }
            }
          })();
          return;
        }

        if (msgType === 'MEDIA_STREAM_END') {
          const transferId = incoming.transferId;
          if (!transferId) return;
          if (completedTransfersRef.current.has(transferId)) {
            return;
          }
          const totalChunks = incoming.totalChunks ?? 1;
          const record = incomingPayloadsRef.current.get(transferId);
          if (!record || record.isCompleted) return;

          // Check if any chunks were dropped over the radio/network
          const missing: number[] = [];
          for (let i = 0; i < totalChunks; i++) {
            if (!record.chunks.has(i)) {
              missing.push(i);
            }
          }

          if (missing.length > 0) {
            record.retryAttempts = (record.retryAttempts || 0) + 1;
            // Request re-transmission of dropped chunks
            const profile = getLocalProfile();
            const myShort = profile.id.slice(-6).toLowerCase();
            const isRoom = Boolean(incoming.roomId || record.conversationId.startsWith('room_'));
            const reqPacket = {
              type: 'MEDIA_REQUEST_MISSING',
              id: `req_missing_${Date.now()}`,
              transferId,
              missingIndices: missing,
              senderId: `peer_${myShort}`,
              senderShortId: myShort,
              targetPeerId: isRoom ? undefined : canonicalSenderId,
              roomId: isRoom ? (incoming.roomId || record.conversationId) : undefined,
              timestamp: Date.now(),
            };
            if (isRoom) {
              transportManager.sendPacket('broadcast', reqPacket).catch(() => {});
            } else {
              transportManager.sendPacket(canonicalSenderId, reqPacket).catch(() => {});
              transportManager.sendPacket('broadcast', reqPacket).catch(() => {});
            }
            // Keep watchdog actively running so it recovers if retry packet drops!
            scheduleMissingChunksWatchdog(transferId, 1500);
          } else {
            completedTransfersRef.current.add(transferId);
            finalizeReceivedMedia(transferId);
          }
          return;
        }

        if (msgType === 'MEDIA_REQUEST_MISSING') {
          const transferId = incoming.transferId;
          const missingIndices = incoming.missingIndices || [];
          if (!transferId || missingIndices.length === 0) return;
          if (abortedTransfersRef.current.has(transferId)) return;

          (async () => {
            let payload = outgoingPayloadsRef.current.get(transferId);

            // If payload not in memory (e.g. app reloaded), reconstruct from message URI attachment!
            if (!payload) {
              let foundMsg: Message | undefined;
              for (const key of Object.keys(messagesRef.current)) {
                const m = messagesRef.current[key]?.find((msg) => msg.transferId === transferId);
                if (m) {
                  foundMsg = m;
                  break;
                }
              }
              if (foundMsg) {
                const uri = foundMsg.fileUri || foundMsg.imageUri || foundMsg.audioUri;
                if (uri) {
                  try {
                    const fileInfo = await readMediaBase64(uri);
                    if (fileInfo?.base64) {
                      const CHUNK_SIZE = 4096;
                      const chunks: string[] = [];
                      for (let c = 0; c < fileInfo.base64.length; c += CHUNK_SIZE) {
                        chunks.push(fileInfo.base64.slice(c, c + CHUNK_SIZE));
                      }
                      payload = {
                        base64: fileInfo.base64,
                        fileName: foundMsg.fileName || 'file.dat',
                        mimeType: foundMsg.mimeType || 'application/octet-stream',
                        totalChunks: chunks.length,
                        chunks,
                        mediaType: foundMsg.transferType || (foundMsg.isVoice ? 'voice' : foundMsg.isFile ? 'file' : 'image'),
                        durationSec: foundMsg.audioDurationSeconds,
                        targetId: incoming.senderId || canonicalSenderId,
                        roomId: foundMsg.roomId,
                      };
                      outgoingPayloadsRef.current.set(transferId, payload);
                    }
                  } catch (e) {
                    console.warn('[OrbitorContext] Could not reconstruct payload for retry:', e);
                  }
                }
              }
            }

            if (!payload) return;

            const { chunks, totalChunks, fileName, mimeType, mediaType, durationSec, targetId } = payload;
            const profile = getLocalProfile();
            const myShort = profile.id.slice(-6).toLowerCase();
            const targetPeer = incoming.senderId || targetId;
            const isRoomTransfer = Boolean(incoming.roomId || (targetId && targetId.startsWith('room_')));

            for (const idx of missingIndices) {
              if (abortedTransfersRef.current.has(transferId)) break;
              if (idx < chunks.length) {
                const chunkPacket = {
                  id: `chunk_${transferId}_${idx}_retry_${Date.now()}`,
                  type: 'MEDIA_PAYLOAD_CHUNK',
                  transferId,
                  chunkIndex: idx,
                  totalChunks,
                  chunkData: chunks[idx],
                  fileName,
                  mimeType,
                  mediaType,
                  audioDurationSeconds: durationSec,
                  senderId: `peer_${myShort}`,
                  senderShortId: myShort,
                  targetPeerId: isRoomTransfer ? undefined : targetPeer,
                  roomId: isRoomTransfer ? (incoming.roomId || targetId) : undefined,
                  timestamp: Date.now(),
                };
                if (isRoomTransfer) {
                  await transportManager.sendPacket('broadcast', chunkPacket);
                } else {
                  await transportManager.sendPacket(targetPeer, chunkPacket);
                  await transportManager.sendPacket('broadcast', chunkPacket);
                }
                await new Promise((res) => setTimeout(res, 60));
              }
            }

            if (abortedTransfersRef.current.has(transferId)) return;

            // Re-signal stream end
            const endPacket = {
              id: `end_${Date.now()}`,
              type: 'MEDIA_STREAM_END',
              transferId,
              totalChunks,
              senderId: `peer_${myShort}`,
              senderShortId: myShort,
              targetPeerId: isRoomTransfer ? undefined : targetPeer,
              roomId: isRoomTransfer ? (incoming.roomId || targetId) : undefined,
              timestamp: Date.now(),
            };
            for (let b = 0; b < 2; b++) {
              if (abortedTransfersRef.current.has(transferId)) break;
              if (isRoomTransfer) {
                transportManager.sendPacket('broadcast', endPacket).catch(() => {});
              } else {
                transportManager.sendPacket(targetPeer, endPacket).catch(() => {});
                transportManager.sendPacket('broadcast', endPacket).catch(() => {});
              }
              if (b < 1) await new Promise((res) => setTimeout(res, 120));
            }
          })();
          return;
        }

        if (msgType === 'MEDIA_PAYLOAD_CHUNK') {
          const transferId = incoming.transferId;
          if (!transferId) return;
          if (abortedTransfersRef.current.has(transferId)) return;

          // If this transfer was already completed on our side, acknowledge and do NOT re-process or downgrade!
          if (completedTransfersRef.current.has(transferId)) {
            const profile = getLocalProfile();
            const myShort = profile.id.slice(-6).toLowerCase();
            const compAckPacket = {
              type: 'MEDIA_TRANSFER_COMPLETE',
              id: `comp_ack_${Date.now()}`,
              transferId,
              senderId: `peer_${myShort}`,
              targetPeerId: canonicalSenderId,
              timestamp: Date.now(),
            };
            transportManager.sendPacket(canonicalSenderId, compAckPacket).catch(() => {});
            transportManager.sendPacket('broadcast', compAckPacket).catch(() => {});
            return;
          }

          let record = incomingPayloadsRef.current.get(transferId);
          if (record && record.isCompleted) {
            completedTransfersRef.current.add(transferId);
            return;
          }

          const chunkIndex = incoming.chunkIndex ?? 0;
          const totalChunks = incoming.totalChunks ?? 1;
          const chunkData = incoming.chunkData || '';

          if (!record) {
            record = {
              chunks: new Map(),
              totalChunks,
              fileName: incoming.fileName || `media_${Date.now()}`,
              mimeType: incoming.mimeType || (incoming.mediaType === 'voice' ? 'audio/mp4' : incoming.mediaType === 'file' ? 'application/octet-stream' : 'image/jpeg'),
              isVoice: incoming.mediaType === 'voice' || incoming.isVoice,
              audioDurationSeconds: incoming.audioDurationSeconds,
              isImage: incoming.mediaType === 'image' || incoming.isImage,
              isFile: incoming.mediaType === 'file' || incoming.isFile,
              conversationId: incoming.roomId || canonicalSenderId,
              messageId: incoming.id || '',
              senderId: canonicalSenderId,
              isCompleted: false,
            };
            incomingPayloadsRef.current.set(transferId, record);
          }

          record.chunks.set(chunkIndex, chunkData);
          const isDone = record.chunks.size >= totalChunks;
          const currentProgress = isDone ? 100 : Math.min(99, Math.round((record.chunks.size / totalChunks) * 100));

          setMessages((prev) => {
            const updated: Record<string, Message[]> = {};
            for (const key of Object.keys(prev)) {
              updated[key] = prev[key].map((m) => {
                if (m.transferId !== transferId) return m;
                // NEVER downgrade an already completed or downloaded message!
                if (m.transferStatus === 'completed' || m.imageUri || m.audioUri || m.fileUri) {
                  return m;
                }
                return {
                  ...m,
                  transferStatus: isDone ? 'completed' : 'transferring',
                  // Monotonic progress guarantee: progress should never drop
                  transferProgress: Math.max(m.transferProgress || 0, currentProgress),
                };
              });
            }
            persistMessages(updated);
            return updated;
          });

          if (isDone) {
            const wd = watchdogTimersRef.current.get(transferId);
            if (wd) {
              clearTimeout(wd);
              watchdogTimersRef.current.delete(transferId);
            }
            completedTransfersRef.current.add(transferId);
            finalizeReceivedMedia(transferId);
          } else {
            // Keep watchdog active and rescheduling
            scheduleMissingChunksWatchdog(transferId, 2500);
          }
          return;
        }

        if (msgType === 'MEDIA_TRANSFER_CANCEL') {
          const transferId = incoming.transferId;
          if (!transferId) return;
          abortedTransfersRef.current.add(transferId);
          const wd = watchdogTimersRef.current.get(transferId);
          if (wd) {
            clearTimeout(wd);
            watchdogTimersRef.current.delete(transferId);
          }
          incomingPayloadsRef.current.delete(transferId);
          outgoingPayloadsRef.current.delete(transferId);

          setMessages((prev) => {
            const updated: Record<string, Message[]> = {};
            for (const key of Object.keys(prev)) {
              updated[key] = prev[key].map((m) =>
                m.transferId === transferId
                  ? { ...m, transferStatus: 'cancelled' }
                  : m
              );
            }
            persistMessages(updated);
            return updated;
          });
          return;
        }

        if (msgType === 'MEDIA_TRANSFER_REJECT') {
          const transferId = incoming.transferId;
          if (!transferId) return;
          setMessages((prev) => {
            const updated: Record<string, Message[]> = {};
            for (const key of Object.keys(prev)) {
              updated[key] = prev[key].map((m) =>
                m.transferId === transferId
                  ? { ...m, transferStatus: 'declined' }
                  : m
              );
            }
            persistMessages(updated);
            return updated;
          });
          return;
        }

        if (msgType === 'MEDIA_TRANSFER_COMPLETE') {
          const transferId = incoming.transferId;
          if (!transferId) return;
          setMessages((prev) => {
            const updated: Record<string, Message[]> = {};
            for (const key of Object.keys(prev)) {
              updated[key] = prev[key].map((m) =>
                m.transferId === transferId
                  ? { ...m, transferStatus: 'completed', transferProgress: 100, status: 'delivered' }
                  : m
              );
            }
            persistMessages(updated);
            return updated;
          });

          // Dequeue matching outbox items
          const pending = outbox.getItems().filter(
            (i) => i.recipientId === canonicalSenderId || i.recipientId.endsWith(senderShortId)
          );
          pending.forEach((p) => outbox.dequeue(p.id));

          setTimeout(() => {
            outgoingPayloadsRef.current.delete(transferId);
          }, 30000);
          return;
        }

        // 9. ROOM / GROUP CHAT MESSAGE (WhatsApp style broadcast)
        if (msgType === 'ROOM_MSG' || incoming.roomId || incoming.roomCode) {
          const roomCode = (incoming.roomCode || '').trim().toUpperCase();
          const targetRoomId = incoming.roomId || `room_${roomCode}`;
          const officialName = incoming.roomName || `Room ${roomCode}`;

          // Verify user is a member who entered the PIN for this room
          const room = eventRoomsRef.current.find(
            (r) => r.id === targetRoomId || (roomCode && r.code === roomCode)
          );
          if (!room || !room.isJoined) {
            return;
          }

          // Add to room's message list under targetRoomId
          setMessages((prev) => {
            const list = prev[targetRoomId] || [];
            if (list.some((m) => m.id === incoming.id)) return prev;
            const updated = {
              ...prev,
              [targetRoomId]: [
                ...list,
                {
                  ...incoming,
                  conversationId: targetRoomId,
                  roomId: targetRoomId,
                  roomCode,
                  roomName: officialName,
                  senderId: canonicalSenderId,
                  isMe: false,
                  status: 'delivered' as MessageDeliveryStatus,
                },
              ],
            };
            persistMessages(updated);
            return updated;
          });

          // System Notification if user isn't currently viewing this room
          if (activeChatPeerIdRef.current !== targetRoomId && activeChatPeerIdRef.current !== roomCode) {
            showLocalNotification(
              officialName,
              `${incoming.senderName || 'Member'}: ${incoming.text || 'New message'}`,
              targetRoomId
            );
          }

          // Send MSG_ACK back to sender so sender gets double ticks (✓✓) for room messages
          const profile = getLocalProfile();
          const myShortId = profile.id.slice(-6).toLowerCase();
          transportManager.sendPacket(canonicalSenderId, {
            type: 'MSG_ACK',
            id: `ack_${Date.now()}`,
            ackMessageId: incoming.id,
            senderId: `peer_${myShortId}`,
            senderShortId: myShortId,
            targetPeerId: canonicalSenderId,
            targetShortId: senderShortId,
            timestamp: Date.now(),
          }).catch(() => {});

          return;
        }

        // 10. REGULAR 1-ON-1 CHAT MESSAGE
        const convoKey = canonicalSenderId;

        // Verify that sender is currently a saved or paired companion
        const isSenderSavedOrPaired = savedPeersRef.current.some(
          (p) => p.id === canonicalSenderId || p.id.toLowerCase().endsWith(senderShortId)
        );

        if (!isSenderSavedOrPaired) {
          // Unpaired/disconnected companion: transmit DISCONNECTED packet back so sender syncs and stops transmitting
          const profile = getLocalProfile();
          const myShortId = profile.id.slice(-6).toLowerCase();
          transportManager.sendPacket(canonicalSenderId, {
            type: 'CONNECTION_DISCONNECTED',
            id: `disc_${Date.now()}`,
            senderId: `peer_${myShortId}`,
            senderShortId: myShortId,
            targetPeerId: canonicalSenderId,
            targetShortId: senderShortId,
            timestamp: Date.now(),
          }).catch(() => {});
          return;
        }

        // 1. ALWAYS transmit MSG_ACK back immediately so sender reliably gets double ticks (✓✓)
        const profile = getLocalProfile();
        const myShortId = profile.id.slice(-6).toLowerCase();
        transportManager.sendPacket(canonicalSenderId, {
          type: 'MSG_ACK',
          id: `ack_${Date.now()}`,
          ackMessageId: incoming.id,
          senderId: `peer_${myShortId}`,
          senderShortId: myShortId,
          targetPeerId: canonicalSenderId,
          targetShortId: senderShortId,
          timestamp: Date.now(),
        }).catch(() => {});

        // 2. Add to message history if not already present
        setMessages((prev) => {
          const list = prev[convoKey] || [];
          if (list.some((m) => m.id === incoming.id)) return prev;
          const updated = {
            ...prev,
            [convoKey]: [
              ...list,
              { ...incoming, conversationId: convoKey, senderId: canonicalSenderId },
            ],
          };
          persistMessages(updated);
          return updated;
        });

        // 3. Ensure sender is saved in persistent savedPeers
        savePeer({
          id: canonicalSenderId,
          shortId: senderShortId,
          name: incoming.senderName || `Radii·${senderShortId}`,
          platform: 'android',
          activeTransport: (incoming.transport as any) || 'nearby',
          availableTransports: [(incoming.transport as any) || 'nearby'],
          rssi: -50,
          distanceBracket: 'near',
          lastSeen: Date.now(),
          isPaired: true,
          avatarSeed: incoming.senderName || senderShortId,
          deviceName: incoming.senderDevice || 'Companion Device',
        });

        // 4. Trigger system notification if user is NOT currently looking at this chat!
        if (activeChatPeerIdRef.current !== canonicalSenderId) {
          showLocalNotification(
            incoming.senderName || `Radii Companion (${senderShortId})`,
            incoming.text || 'New mesh radio message',
            canonicalSenderId
          );
        } else {
          // If already looking at this chat, automatically send MSG_READ for blue ticks!
          markChatAsRead(canonicalSenderId);
        }
      });

      const unsubOutbox = outbox.subscribe((items) => {
        setOutboxItems(items);
      });

      const unsubEntitlements = entitlements.subscribe((state) => {
        setEntitlementState(state);
      });

      // 10. Background retry loop for unacknowledged messages (every 5 seconds)
      const retryInterval = setInterval(() => {
        setMessages((prev) => {
          peersRef.current.forEach((peer) => {
            if (peer.distanceBracket === 'out_of_range') return;
            const canonicalId = normalizePeerId(peer.id);
            const shortId = (peer.shortId || canonicalId.slice(-6)).toLowerCase();
            const list = prev[canonicalId] || [];
            const now = Date.now();
            const unacked = list.filter(
              (m) => m.isMe && (m.status === 'sent' || m.status === 'queued_offline') && now - m.timestamp < 180000
            );
            if (unacked.length > 0) {
              const myProf = getLocalProfile();
              const myShort = myProf.id.slice(-6).toLowerCase();
              unacked.forEach((msg) => {
                transportManager.sendPacket(canonicalId, {
                  id: msg.id,
                  type: 'CHAT_MSG',
                  senderId: `peer_${myShort}`,
                  senderShortId: myShort,
                  fullSenderId: myProf.id,
                  senderName: myProf.displayName || myProf.deviceName || 'Radii User',
                  targetPeerId: canonicalId,
                  targetShortId: shortId,
                  text: msg.text,
                  timestamp: msg.timestamp,
                }).catch(() => {});
              });
            }
          });
          return prev;
        });
      }, 5000);

      // Periodic beacon for active rooms so any companion coming into radio range immediately sees the room
      const roomBeaconInterval = setInterval(() => {
        const activeRooms = eventRoomsRef.current.filter(
          (r) => r && r.isJoined && (r.memberCount === undefined || r.memberCount > 0)
        );
        if (activeRooms.length === 0) return;

        const profile = getLocalProfile();
        const myShort = profile.id.slice(-6).toLowerCase();

        activeRooms.forEach((r) => {
          const beaconPacket = {
            id: `ann_beacon_${Date.now()}_${r.code}`,
            type: 'ROOM_ANNOUNCE',
            roomId: r.id,
            roomCode: r.code,
            roomName: r.name,
            description: r.description,
            creatorId: r.creatorId,
            creatorName: r.creatorName,
            memberCount: r.memberCount || r.members?.length || 1,
            members: r.members || [myShort],
            memberNames: r.memberNames || {},
            senderId: `peer_${myShort}`,
            senderShortId: myShort,
            senderName: profile.displayName || 'Host',
            timestamp: Date.now(),
          };
          transportManager.sendPacket('broadcast', beaconPacket).catch(() => {});
        });
      }, 4000);

      // Store cleanup refs
      cleanupRef.current = () => {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        clearInterval(retryInterval);
        clearInterval(roomBeaconInterval);
        Object.values(typingTimeoutRefs.current).forEach((t) => clearTimeout(t));
        unsubPeer();
        unsubPeerLost();
        unsubMsg();
        unsubOutbox();
        unsubEntitlements();
        transportManager.stop();
      };
    };

    initTransport();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, []);

  const setNetworkMode = useCallback((mode: NetworkMode) => {
    setNetworkModeState(mode);
    transportManager.setNetworkMode(mode);
  }, []);

  const setAutoUpgrade = useCallback((enabled: boolean) => {
    setAutoUpgradeState(enabled);
    transportManager.setAutoUpgrade(enabled);
  }, []);

  const sendTypingStatus = useCallback(
    (peerId: string, isTyping: boolean) => {
      const canonicalId = normalizePeerId(peerId);
      const myShortId = myProfile.id.slice(-6).toLowerCase();
      const targetShortId = peerId.slice(-6).toLowerCase();

      transportManager.sendPacket(canonicalId, {
        type: isTyping ? 'TYPING_START' : 'TYPING_STOP',
        id: `typ_${Date.now()}`,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        targetPeerId: canonicalId,
        targetShortId: targetShortId,
        timestamp: Date.now(),
      }).catch(() => {});
    },
    [myProfile]
  );

  const markChatAsRead = useCallback(
    (peerId: string) => {
      const canonicalId = normalizePeerId(peerId);
      const myShortId = myProfile.id.slice(-6).toLowerCase();
      const targetShortId = peerId.slice(-6).toLowerCase();

      setMessages((prev) => {
        const list = prev[canonicalId] || [];
        const hasUnread = list.some((m) => !m.isMe && m.status !== 'read');
        if (!hasUnread) return prev;
        const updated = {
          ...prev,
          [canonicalId]: list.map((m) => (!m.isMe ? { ...m, status: 'read' as MessageDeliveryStatus } : m)),
        };
        persistMessages(updated);
        return updated;
      });

      // Transmit MSG_READ to peer so they see blue double ticks
      transportManager.sendPacket(canonicalId, {
        type: 'MSG_READ',
        id: `read_${Date.now()}`,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        targetPeerId: canonicalId,
        targetShortId: targetShortId,
        timestamp: Date.now(),
      }).catch(() => {});
    },
    [myProfile, persistMessages]
  );

  const sendMessage = useCallback(
    async (
      peerId: string,
      text: string,
      options?: {
        isVoice?: boolean;
        audioDurationSeconds?: number;
        audioUri?: string;
        audioBase64?: string;
        isImage?: boolean;
        imageUri?: string;
      }
    ): Promise<boolean> => {
      const myShortId = myProfile.id.slice(-6).toLowerCase();

      // 1. Check if target is a Room (WhatsApp style Group Mesh Broadcast)
      const cleanCode = peerId.replace('room_', '').toUpperCase();
      const foundRoom = eventRoomsRef.current.find(
        (r) => r.id === peerId || r.code === peerId || r.code === cleanCode || (peerId.startsWith('room_') && r.id === peerId)
      );
      const isTargetRoom = Boolean(foundRoom || peerId.startsWith('room_'));
      const room: EventRoom | null = foundRoom || (isTargetRoom ? {
        id: peerId.startsWith('room_') ? peerId : `room_${cleanCode}`,
        name: `Mesh Room ${cleanCode}`,
        code: cleanCode,
        category: 'campus',
        memberCount: 2,
        isActive: true,
        description: 'Offline LAN & Mesh Channel',
      } : null);

      if (room) {
        const roomId = room.id;
        // Ensure room is registered in state and persisted
        setEventRooms((prev) => {
          if (prev.some((r) => r.id === roomId || r.code === room.code)) return prev;
          const updated = [...prev, room];
          persistRooms(updated);
          return updated;
        });
        const newRoomMsg: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          conversationId: roomId,
          roomId: roomId,
          roomCode: room.code,
          senderId: `peer_${myShortId}`,
          senderName: myProfile.displayName || myProfile.deviceName || 'Radii User',
          text,
          timestamp: Date.now(),
          transport: 'nearby',
          status: 'sent',
          isMe: true,
          isVoice: options?.isVoice,
          audioDurationSeconds: options?.audioDurationSeconds,
          audioUri: options?.audioUri,
          audioBase64: options?.audioBase64,
          isImage: options?.isImage,
          imageUri: options?.imageUri,
        };

        setMessages((prev) => {
          const updated = {
            ...prev,
            [roomId]: [...(prev[roomId] || []), newRoomMsg],
          };
          persistMessages(updated);
          return updated;
        });

        // Broadcast to all active radio peers in range
        const livePeers = peersRef.current.filter((p) => p.distanceBracket !== 'out_of_range');
        livePeers.forEach((p) => {
          transportManager.sendPacket(p.id, {
            id: newRoomMsg.id,
            type: 'ROOM_MSG',
            roomId: roomId,
            roomCode: room.code,
            roomName: room.name,
            senderId: `peer_${myShortId}`,
            senderShortId: myShortId,
            fullSenderId: myProfile.id,
            senderName: myProfile.displayName || myProfile.deviceName || 'Radii User',
            senderDevice: myProfile.deviceName,
            text,
            timestamp: Date.now(),
            isVoice: options?.isVoice,
            audioDurationSeconds: options?.audioDurationSeconds,
            audioUri: options?.audioUri,
            audioBase64: options?.audioBase64,
            isImage: options?.isImage,
            imageUri: options?.imageUri,
          }).catch(() => {});
        });

        return true;
      }

      // 2. Otherwise, 1-on-1 direct companion chat
      const canonicalId = normalizePeerId(peerId);
      const peer = peers.find(
        (p) => p.id === canonicalId || p.id.toLowerCase().endsWith(peerId.slice(-6).toLowerCase())
      );
      const isPeerInRange = peer && peer.distanceBracket !== 'out_of_range';
      const targetShortId = peerId.slice(-6).toLowerCase();

      // Immediately cancel typing indicator when sending
      sendTypingStatus(canonicalId, false);

      const newMsg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        conversationId: canonicalId,
        senderId: `peer_${myShortId}`,
        senderName: myProfile.displayName || myProfile.deviceName || 'Radii User',
        text,
        timestamp: Date.now(),
        transport: peer?.activeTransport || 'nearby',
        status: isPeerInRange ? 'sent' : 'queued_offline',
        isMe: true,
        isVoice: options?.isVoice,
        audioDurationSeconds: options?.audioDurationSeconds,
        audioUri: options?.audioUri,
        audioBase64: options?.audioBase64,
        isImage: options?.isImage,
        imageUri: options?.imageUri,
      };

      setMessages((prev) => {
        const updated = {
          ...prev,
          [canonicalId]: [...(prev[canonicalId] || []), newMsg],
        };
        persistMessages(updated);
        return updated;
      });

      // Ensure peer is in savedPeers so conversation is persistent in Mesh Chats
      if (peer) {
        savePeer(peer);
      } else {
        savePeer({
          id: canonicalId,
          shortId: targetShortId,
          name: `Radii·${targetShortId}`,
          platform: 'android',
          activeTransport: 'nearby',
          availableTransports: ['nearby'],
          rssi: -60,
          distanceBracket: 'out_of_range',
          lastSeen: Date.now(),
          isPaired: true,
          avatarSeed: targetShortId,
        });
      }

      if (isPeerInRange) {
        // Drain any pending outbox items for this peer since message is transmitting now
        const pending = outbox.getItems().filter(
          (i) => i.recipientId === canonicalId || i.recipientId === peerId || i.recipientId.endsWith(targetShortId)
        );
        pending.forEach((p) => outbox.dequeue(p.id));

        return transportManager.sendPacket(canonicalId, {
          id: newMsg.id,
          type: 'CHAT_MSG',
          senderId: `peer_${myShortId}`,
          senderShortId: myShortId,
          fullSenderId: myProfile.id,
          senderName: myProfile.displayName || myProfile.deviceName || 'Radii User',
          targetPeerId: canonicalId,
          targetShortId: targetShortId,
          text,
          timestamp: Date.now(),
          isVoice: options?.isVoice,
          audioDurationSeconds: options?.audioDurationSeconds,
          audioUri: options?.audioUri,
          audioBase64: options?.audioBase64,
          isImage: options?.isImage,
          imageUri: options?.imageUri,
        });
      } else {
        // Enqueue in zero-leak outbox
        outbox.enqueue(
          {
            conversationId: canonicalId,
            senderId: myProfile.id,
            senderName: myProfile.displayName,
            text,
            isMe: true,
            transport: 'nearby',
          },
          ['offline', 'online'],
          'peer_out_of_radio_range'
        );
        return false;
      }
    },
    [peers, myProfile, sendTypingStatus, persistMessages, savePeer]
  );

  const sendMediaTransfer = useCallback(
    async (
      peerId: string,
      mediaType: 'image' | 'voice' | 'file',
      uri: string,
      base64Data?: string,
      durationSec?: number,
      preferredFileName?: string,
      preferredMimeType?: string
    ): Promise<boolean> => {
      const profile = getLocalProfile();
      const myShortId = profile.id.slice(-6).toLowerCase();
      const canonicalId = normalizePeerId(peerId);
      const cleanCode = peerId.replace('room_', '').toUpperCase();
      const foundRoom = eventRoomsRef.current.find(
        (r) => r.id === peerId || r.code === peerId || r.code === cleanCode || (peerId.startsWith('room_') && r.id === peerId)
      );
      const isRoom = Boolean(foundRoom || peerId.startsWith('room_'));
      const room: EventRoom | null = foundRoom || (isRoom ? {
        id: peerId.startsWith('room_') ? peerId : `room_${cleanCode}`,
        name: `Mesh Room ${cleanCode}`,
        code: cleanCode,
        category: 'campus',
        memberCount: 2,
        isActive: true,
        description: 'Offline LAN & Mesh Channel',
      } : null);
      const targetRoomId = isRoom ? (room?.id || (peerId.startsWith('room_') ? peerId : `room_${cleanCode}`)) : undefined;
      const convoKey = isRoom ? targetRoomId! : canonicalId;

      // 1. Obtain Base64 payload
      let base64 = base64Data || '';
      let sizeBytes = 0;
      if (!base64 && uri) {
        const fileInfo = await readMediaBase64(uri);
        if (fileInfo) {
          base64 = fileInfo.base64;
          sizeBytes = fileInfo.sizeBytes;
        }
      } else if (base64) {
        sizeBytes = Math.round(base64.length * 0.75);
      }

      if (!base64) {
        console.warn('Could not read media payload for transfer:', uri);
        return false;
      }

      const transferId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const fileName =
        preferredFileName ||
        (mediaType === 'voice'
          ? `voice_${Date.now()}.m4a`
          : mediaType === 'file'
          ? `file_${Date.now()}.dat`
          : `photo_${Date.now()}.jpg`);
      const mimeType =
        preferredMimeType ||
        (mediaType === 'voice'
          ? 'audio/mp4'
          : mediaType === 'file'
          ? 'application/octet-stream'
          : 'image/jpeg');

      // 2. Chunk base64 into 4KB blocks for reliable zero-drop UDP / radio transmission
      const CHUNK_SIZE = 4096;
      const chunks: string[] = [];
      for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
        chunks.push(base64.slice(i, i + CHUNK_SIZE));
      }

      outgoingPayloadsRef.current.set(transferId, {
        base64,
        fileName,
        mimeType,
        totalChunks: chunks.length,
        chunks,
        mediaType,
        durationSec,
        targetId: convoKey,
        roomId: isRoom ? convoKey : undefined,
      });

      const displayText =
        mediaType === 'voice'
          ? `🎙 Voice note (0:${(durationSec || 0) < 10 ? '0' : ''}${durationSec || 0})`
          : mediaType === 'file'
          ? `📁 ${fileName}`
          : '📷 Photo';

      const newMsg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        conversationId: convoKey,
        roomId: isRoom ? convoKey : undefined,
        roomCode: isRoom ? cleanCode : undefined,
        roomName: isRoom ? room?.name : undefined,
        senderId: `peer_${myShortId}`,
        senderName: profile.displayName || profile.deviceName || 'Radii User',
        text: displayText,
        timestamp: Date.now(),
        transport: 'nearby',
        status: 'sent',
        isMe: true,
        isVoice: mediaType === 'voice',
        audioDurationSeconds: durationSec,
        audioUri: mediaType === 'voice' ? uri : undefined,
        isImage: mediaType === 'image',
        imageUri: mediaType === 'image' ? uri : undefined,
        isFile: mediaType === 'file',
        fileUri: mediaType === 'file' ? uri : undefined,
        mimeType,
        transferId,
        transferType: mediaType,
        transferStatus: 'awaiting_acceptance',
        transferProgress: 0,
        fileName,
        fileSizeBytes: sizeBytes,
      };

      setMessages((prev) => {
        const updated = {
          ...prev,
          [convoKey]: [...(prev[convoKey] || []), newMsg],
        };
        persistMessages(updated);
        return updated;
      });

      // 3. Transmit MEDIA_TRANSFER_REQUEST
      const requestPacket = {
        id: newMsg.id,
        type: 'MEDIA_TRANSFER_REQUEST',
        transferId,
        transferType: mediaType,
        fileName,
        fileSizeBytes: sizeBytes,
        mimeType,
        audioDurationSeconds: durationSec,
        isFile: mediaType === 'file',
        fileUri: undefined,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        fullSenderId: profile.id,
        senderName: profile.displayName || profile.deviceName || 'Radii User',
        targetPeerId: isRoom ? undefined : canonicalId,
        targetShortId: isRoom ? undefined : canonicalId.slice(-6).toLowerCase(),
        roomId: isRoom ? convoKey : undefined,
        roomCode: isRoom ? cleanCode : undefined,
        roomName: isRoom ? room?.name : undefined,
        text: displayText,
        timestamp: Date.now(),
      };

      if (isRoom) {
        peersRef.current.forEach((p) => {
          if (p.distanceBracket !== 'out_of_range') {
            transportManager.sendPacket(p.id, requestPacket).catch(() => {});
          }
        });
        transportManager.sendPacket('broadcast', requestPacket).catch(() => {});
      } else {
        transportManager.sendPacket(canonicalId, requestPacket).catch(() => {});
        transportManager.sendPacket('broadcast', requestPacket).catch(() => {});
      }

      return true;
    },
    [persistMessages]
  );

  const acceptMediaTransfer = useCallback(
    async (conversationId: string, transferId: string) => {
      // Prompt user for Storage / Photos & Media permissions if needed before saving
      try {
        await requestAppStoragePermission();
      } catch (e) {
        console.warn('Storage permission request warning:', e);
      }

      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const existing = list.find((m) => m.transferId === transferId);
        if (existing && (existing.transferStatus === 'completed' || existing.imageUri || existing.audioUri || existing.fileUri)) {
          return prev;
        }
        const updatedList = list.map((m) =>
          m.transferId === transferId
            ? { ...m, transferStatus: 'transferring' as const, transferProgress: 0 }
            : m
        );
        const updated = { ...prev, [conversationId]: updatedList };
        persistMessages(updated);
        return updated;
      });

      const msg = (messagesRef.current[conversationId] || []).find((m) => m.transferId === transferId);
      const targetPeerId = msg?.senderId || conversationId;
      const profile = getLocalProfile();
      const myShort = profile.id.slice(-6).toLowerCase();

      const acceptPacket = {
        id: `accept_${Date.now()}`,
        type: 'MEDIA_TRANSFER_ACCEPT',
        transferId,
        senderId: `peer_${myShort}`,
        senderShortId: myShort,
        targetPeerId,
        conversationId,
        roomId: conversationId.startsWith('room_') ? conversationId : undefined,
        timestamp: Date.now(),
      };

      if (conversationId.startsWith('room_')) {
        transportManager.sendPacket(targetPeerId, acceptPacket).catch(() => {});
        peersRef.current.forEach((p) => {
          if (p.distanceBracket !== 'out_of_range') {
            transportManager.sendPacket(p.id, acceptPacket).catch(() => {});
          }
        });
        transportManager.sendPacket('broadcast', acceptPacket).catch(() => {});
      } else {
        transportManager.sendPacket(targetPeerId, acceptPacket).catch(() => {});
      }
    },
    [persistMessages]
  );

  const declineMediaTransfer = useCallback(
    async (conversationId: string, transferId: string) => {
      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const updatedList = list.map((m) =>
          m.transferId === transferId
            ? { ...m, transferStatus: 'declined' as const }
            : m
        );
        const updated = { ...prev, [conversationId]: updatedList };
        persistMessages(updated);
        return updated;
      });

      const msg = (messagesRef.current[conversationId] || []).find((m) => m.transferId === transferId);
      const targetPeerId = msg?.senderId || conversationId;
      const profile = getLocalProfile();
      const myShort = profile.id.slice(-6).toLowerCase();

      const rejectPacket = {
        id: `reject_${Date.now()}`,
        type: 'MEDIA_TRANSFER_REJECT',
        transferId,
        senderId: `peer_${myShort}`,
        senderShortId: myShort,
        targetPeerId,
        conversationId,
        timestamp: Date.now(),
      };

      if (conversationId.startsWith('room_')) {
        peersRef.current.forEach((p) => {
          if (p.distanceBracket !== 'out_of_range') {
            transportManager.sendPacket(p.id, rejectPacket).catch(() => {});
          }
        });
      } else {
        transportManager.sendPacket(targetPeerId, rejectPacket).catch(() => {});
      }
    },
    [persistMessages]
  );

  const cancelMediaTransfer = useCallback(
    async (conversationId: string, transferId: string) => {
      abortedTransfersRef.current.add(transferId);
      const wd = watchdogTimersRef.current.get(transferId);
      if (wd) {
        clearTimeout(wd);
        watchdogTimersRef.current.delete(transferId);
      }
      incomingPayloadsRef.current.delete(transferId);
      outgoingPayloadsRef.current.delete(transferId);

      setMessages((prev) => {
        const list = prev[conversationId] || [];
        const updatedList = list.map((m) =>
          m.transferId === transferId
            ? { ...m, transferStatus: 'cancelled' as const }
            : m
        );
        const updated = { ...prev, [conversationId]: updatedList };
        persistMessages(updated);
        return updated;
      });

      const msg = (messagesRef.current[conversationId] || []).find((m) => m.transferId === transferId);
      const targetPeerId = msg?.senderId || conversationId;
      const profile = getLocalProfile();
      const myShort = profile.id.slice(-6).toLowerCase();
      const isRoom = conversationId.startsWith('room_');

      const cancelPacket = {
        id: `cancel_${Date.now()}`,
        type: 'MEDIA_TRANSFER_CANCEL',
        transferId,
        senderId: `peer_${myShort}`,
        senderShortId: myShort,
        targetPeerId: isRoom ? undefined : targetPeerId,
        roomId: isRoom ? conversationId : undefined,
        timestamp: Date.now(),
      };

      if (isRoom) {
        transportManager.sendPacket('broadcast', cancelPacket).catch(() => {});
      } else {
        transportManager.sendPacket(targetPeerId, cancelPacket).catch(() => {});
      }
    },
    [persistMessages]
  );

  const retryMediaTransfer = useCallback(
    async (conversationId: string, transferId: string) => {
      abortedTransfersRef.current.delete(transferId);
      completedTransfersRef.current.delete(transferId);

      const msg = (messagesRef.current[conversationId] || []).find((m) => m.transferId === transferId);
      if (!msg) return;

      // Retries are ONLY allowed if transfer failed or stalled, NOT if cancelled or declined!
      if (msg.transferStatus === 'cancelled' || msg.transferStatus === 'declined') {
        return;
      }

      const profile = getLocalProfile();
      const myShort = profile.id.slice(-6).toLowerCase();
      const isRoom = conversationId.startsWith('room_');
      const targetPeerId = msg.senderId || conversationId;

      if (msg.isMe) {
        const payload = outgoingPayloadsRef.current.get(transferId);

        setMessages((prev) => {
          const list = prev[conversationId] || [];
          const updatedList = list.map((m) =>
            m.transferId === transferId
              ? { ...m, transferStatus: 'transferring' as const, transferProgress: 5 }
              : m
          );
          const updated = { ...prev, [conversationId]: updatedList };
          persistMessages(updated);
          return updated;
        });

        if (payload) {
          const { chunks, totalChunks, fileName, mimeType, mediaType, durationSec, targetId } = payload;
          const targetPeer = targetId || targetPeerId;
          const isRoomTransfer = Boolean(isRoom || (targetId && targetId.startsWith('room_')));

          (async () => {
            for (let i = 0; i < totalChunks; i++) {
              if (abortedTransfersRef.current.has(transferId)) break;
              const chunkPacket = {
                id: `chunk_${transferId}_${i}_retry_${Date.now()}`,
                type: 'MEDIA_PAYLOAD_CHUNK',
                transferId,
                chunkIndex: i,
                totalChunks,
                chunkData: chunks[i],
                fileName,
                mimeType,
                mediaType,
                audioDurationSeconds: durationSec,
                senderId: `peer_${myShort}`,
                senderShortId: myShort,
                targetPeerId: isRoomTransfer ? undefined : targetPeer,
                roomId: isRoomTransfer ? conversationId : undefined,
                timestamp: Date.now(),
              };

              if (isRoomTransfer) {
                await transportManager.sendPacket('broadcast', chunkPacket);
              } else {
                await transportManager.sendPacket(targetPeer, chunkPacket);
              }

              const pct = Math.min(99, Math.round(((i + 1) / totalChunks) * 99));
              setMessages((prev) => {
                const list = prev[conversationId] || [];
                const updatedList = list.map((m) =>
                  m.transferId === transferId
                    ? {
                        ...m,
                        transferProgress: Math.max(m.transferProgress || 0, pct),
                        transferStatus: 'transferring' as const,
                      }
                    : m
                );
                const updated = { ...prev, [conversationId]: updatedList };
                persistMessages(updated);
                return updated;
              });

              if (totalChunks > 1) {
                await new Promise((res) => setTimeout(res, 60));
              }
            }

            if (abortedTransfersRef.current.has(transferId)) return;

            const endPacket = {
              id: `end_${Date.now()}`,
              type: 'MEDIA_STREAM_END',
              transferId,
              totalChunks,
              senderId: `peer_${myShort}`,
              senderShortId: myShort,
              targetPeerId: isRoomTransfer ? undefined : targetPeer,
              roomId: isRoomTransfer ? conversationId : undefined,
              timestamp: Date.now(),
            };
            for (let b = 0; b < 3; b++) {
              if (abortedTransfersRef.current.has(transferId)) break;
              if (isRoomTransfer) {
                transportManager.sendPacket('broadcast', endPacket).catch(() => {});
              } else {
                transportManager.sendPacket(targetPeer, endPacket).catch(() => {});
                transportManager.sendPacket('broadcast', endPacket).catch(() => {});
              }
              if (b < 2) await new Promise((res) => setTimeout(res, 120));
            }
          })();
        } else {
          // If payload was not in memory, re-send request
          const requestPacket = {
            id: `retry_req_${Date.now()}`,
            type: 'MEDIA_TRANSFER_REQUEST',
            transferId,
            transferType: msg.transferType || 'image',
            fileName: msg.fileName,
            fileSizeBytes: msg.fileSizeBytes,
            mimeType: msg.mimeType,
            audioDurationSeconds: msg.audioDurationSeconds,
            senderId: `peer_${myShort}`,
            senderShortId: myShort,
            targetPeerId: isRoom ? undefined : targetPeerId,
            roomId: isRoom ? conversationId : undefined,
            text: msg.text,
            timestamp: Date.now(),
          };
          if (isRoom) {
            transportManager.sendPacket('broadcast', requestPacket).catch(() => {});
          } else {
            transportManager.sendPacket(targetPeerId, requestPacket).catch(() => {});
            transportManager.sendPacket('broadcast', requestPacket).catch(() => {});
          }
        }
      } else {
        // Receiver retry
        setMessages((prev) => {
          const list = prev[conversationId] || [];
          const updatedList = list.map((m) =>
            m.transferId === transferId
              ? { ...m, transferStatus: 'transferring' as const }
              : m
          );
          const updated = { ...prev, [conversationId]: updatedList };
          persistMessages(updated);
          return updated;
        });

        const record = incomingPayloadsRef.current.get(transferId);
        if (record && record.chunks.size > 0 && record.totalChunks > 0) {
          const missing: number[] = [];
          for (let i = 0; i < record.totalChunks; i++) {
            if (!record.chunks.has(i)) missing.push(i);
          }
          if (missing.length > 0) {
            record.retryAttempts = (record.retryAttempts || 0) + 1;
            const reqPacket = {
              type: 'MEDIA_REQUEST_MISSING',
              id: `req_missing_retry_${Date.now()}`,
              transferId,
              missingIndices: missing,
              senderId: `peer_${myShort}`,
              senderShortId: myShort,
              targetPeerId: record.senderId,
              roomId: isRoom ? conversationId : undefined,
              timestamp: Date.now(),
            };
            if (isRoom) {
              transportManager.sendPacket('broadcast', reqPacket).catch(() => {});
            } else {
              transportManager.sendPacket(record.senderId, reqPacket).catch(() => {});
              transportManager.sendPacket('broadcast', reqPacket).catch(() => {});
            }
            scheduleMissingChunksWatchdogRef.current(transferId, 1500);
            return;
          }
        }

        const acceptPacket = {
          id: `accept_retry_${Date.now()}`,
          type: 'MEDIA_TRANSFER_ACCEPT',
          transferId,
          senderId: `peer_${myShort}`,
          senderShortId: myShort,
          targetPeerId,
          conversationId,
          roomId: isRoom ? conversationId : undefined,
          timestamp: Date.now(),
        };
        if (isRoom) {
          transportManager.sendPacket('broadcast', acceptPacket).catch(() => {});
        } else {
          transportManager.sendPacket(targetPeerId, acceptPacket).catch(() => {});
          transportManager.sendPacket('broadcast', acceptPacket).catch(() => {});
        }
        scheduleMissingChunksWatchdogRef.current(transferId, 2500);
      }
    },
    [persistMessages]
  );

  const sendVoiceNote = useCallback(
    async (
      peerId: string,
      durationSec: number,
      audioUri?: string,
      audioBase64?: string
    ): Promise<boolean> => {
      return sendMediaTransfer(peerId, 'voice', audioUri || '', audioBase64, durationSec);
    },
    [sendMediaTransfer]
  );

  const triggerSOS = useCallback(
    (message = 'Emergency beacon activated: need assistance nearby.') => {
      const alert: SOSAlert = {
        id: `sos_${Date.now()}`,
        senderId: myProfile.id,
        senderName: myProfile.displayName,
        timestamp: Date.now(),
        emergencyMessage: message,
        transportBroadcast: ['ble', 'nearby', 'location'],
        isActive: true,
      };
      setActiveSOS(alert);
    },
    [myProfile]
  );

  const dismissSOS = useCallback(() => {
    setActiveSOS(null);
  }, []);

  const startFileFling = useCallback((peerId: string, fileName: string, sizeBytes: number) => {
    const transfer: FileTransfer = {
      id: `file_${Date.now()}`,
      fileName,
      fileSizeBytes: sizeBytes,
      progressPercent: 10,
      transport: 'nearby',
      recipientId: peerId,
      recipientName: 'Nearby Peer',
      direction: 'outgoing',
      status: 'active',
    };

    setFileTransfers((prev) => [transfer, ...prev]);

    // Animate progress to completion
    const interval = setInterval(() => {
      setFileTransfers((prev) =>
        prev.map((t) => {
          if (t.id === transfer.id) {
            const next = t.progressPercent + 25;
            if (next >= 100) {
              clearInterval(interval);
              return { ...t, progressPercent: 100, status: 'completed' };
            }
            return { ...t, progressPercent: next };
          }
          return t;
        })
      );
    }, 400);
  }, []);

  const joinEventRoom = useCallback(
    (code: string): EventRoom => {
      const formatted = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const roomId = `room_${formatted}`;
      const existing = eventRoomsRef.current.find((r) => r.id === roomId || r.code === formatted);

      const profile = getLocalProfile();
      const myShort = profile.id.slice(-6).toLowerCase();

      let roomToJoin: EventRoom;
      if (existing) {
        const existingMembers = existing.members || (existing.creatorId ? [existing.creatorId.slice(-6).toLowerCase()] : []);
        const updatedMembers = Array.from(new Set([...existingMembers, myShort]));
        const updatedNames = {
          ...(existing.memberNames || {}),
          [myShort]: profile.displayName || 'Radii User',
        };
        roomToJoin = {
          ...existing,
          isJoined: true,
          members: updatedMembers,
          memberNames: updatedNames,
          memberCount: updatedMembers.length,
        };
        setEventRooms((prev) => {
          const updated = prev.map((r) =>
            r.id === existing.id || r.code === formatted ? roomToJoin : r
          );
          persistRooms(updated);
          return updated;
        });
      } else {
        roomToJoin = {
          id: roomId,
          name: `Room ${formatted}`,
          code: formatted,
          category: 'campus',
          memberCount: 1,
          isActive: true,
          description: 'Offline LAN & Mesh Channel',
          isJoined: true,
          members: [myShort],
          memberNames: { [myShort]: profile.displayName || 'Radii User' },
        };
        setEventRooms((prev) => {
          const updated = [...prev, roomToJoin];
          persistRooms(updated);
          return updated;
        });
      }

      // Add local system message: "👋 You joined the room"
      const joinSysMsg: Message = {
        id: `sys_join_local_${Date.now()}`,
        conversationId: roomToJoin.id,
        roomId: roomToJoin.id,
        roomCode: formatted,
        senderId: 'system',
        senderName: 'System',
        text: '👋 You joined the room',
        timestamp: Date.now(),
        transport: 'nearby',
        status: 'delivered',
        isMe: true,
        isSystem: true,
      };

      setMessages((prev) => {
        const list = prev[roomToJoin.id] || (formatted ? prev[formatted] : []) || [];
        const updated = {
          ...prev,
          [roomToJoin.id]: [...list, joinSysMsg],
        };
        if (formatted) {
          updated[formatted] = [...list, joinSysMsg];
        }
        persistMessages(updated);
        return updated;
      });

      // Broadcast ROOM_JOIN packet to all peers in range
      const joinPacket = {
        id: `join_${Date.now()}`,
        type: 'ROOM_JOIN',
        roomId: roomToJoin.id,
        roomCode: formatted,
        roomName: roomToJoin.name,
        senderId: `peer_${myShort}`,
        senderShortId: myShort,
        senderName: profile.displayName || 'Radii User',
        timestamp: Date.now(),
      };
      transportManager.sendPacket('broadcast', joinPacket).catch(() => {});
      peersRef.current.forEach((p) => {
        if (p.distanceBracket !== 'out_of_range') {
          transportManager.sendPacket(p.id, joinPacket).catch(() => {});
        }
      });
      setTimeout(() => {
        transportManager.sendPacket('broadcast', joinPacket).catch(() => {});
      }, 300);

      return roomToJoin;
    },
    [persistRooms, persistMessages]
  );

  const createEventRoom = useCallback(
    (name: string, description?: string, customCode?: string): EventRoom => {
      const code = (
        customCode?.trim().toUpperCase() || Math.random().toString(36).substring(2, 6).toUpperCase()
      ).replace(/[^A-Z0-9]/g, '');
      const roomId = `room_${code}`;
      const existing = eventRoomsRef.current.find((r) => r.id === roomId || r.code === code);

      const profile = getLocalProfile();
      const myShort = profile.id.slice(-6).toLowerCase();

      if (existing) {
        const existingMembers = existing.members || [myShort];
        const updatedMembers = Array.from(new Set([...existingMembers, myShort]));
        const updatedNames = {
          ...(existing.memberNames || {}),
          [myShort]: profile.displayName || 'Room Host',
        };
        const roomWithJoined: EventRoom = {
          ...existing,
          isJoined: true,
          creatorId: existing.creatorId || `peer_${myShort}`,
          creatorName: existing.creatorName || (profile.displayName || 'Room Host'),
          members: updatedMembers,
          memberNames: updatedNames,
          memberCount: updatedMembers.length,
        };
        if (name && name.trim() !== existing.name) {
          const updated = eventRoomsRef.current.map((r) =>
            r.id === roomId ? { ...roomWithJoined, name: name.trim() } : r
          );
          setEventRooms(updated);
          persistRooms(updated);
        } else {
          setEventRooms((prev) => {
            const updated = prev.map((r) => (r.id === roomId ? roomWithJoined : r));
            persistRooms(updated);
            return updated;
          });
        }
        return roomWithJoined;
      }

      const newRoom: EventRoom = {
        id: roomId,
        name: name.trim() || `Room ${code}`,
        code,
        category: 'campus',
        memberCount: 1,
        isActive: true,
        description: description?.trim() || 'Offline LAN & Mesh Channel',
        creatorId: `peer_${myShort}`,
        creatorName: profile.displayName || 'Room Host',
        epoch: 1,
        isJoined: true,
        members: [myShort],
        memberNames: { [myShort]: profile.displayName || 'Room Host' },
      };

      setEventRooms((prev) => {
        const updated = [...prev, newRoom];
        persistRooms(updated);
        return updated;
      });

      // Initial local system message
      const createSysMsg: Message = {
        id: `sys_create_${Date.now()}`,
        conversationId: roomId,
        roomId: roomId,
        roomCode: code,
        senderId: 'system',
        senderName: 'System',
        text: `🔒 Broadcast room created with PIN: ${code}. Share PIN to invite companions.`,
        timestamp: Date.now(),
        transport: 'nearby',
        status: 'delivered',
        isMe: true,
        isSystem: true,
      };

      setMessages((prev) => {
        const list = prev[roomId] || (code ? prev[code] : []) || [];
        const updated = {
          ...prev,
          [roomId]: [...list, createSysMsg],
        };
        if (code) {
          updated[code] = [...list, createSysMsg];
        }
        persistMessages(updated);
        return updated;
      });

      // Announce room to connected live peers & subnet broadcast
      const announcePacket = {
        id: `ann_${Date.now()}`,
        type: 'ROOM_ANNOUNCE',
        roomId: newRoom.id,
        roomCode: newRoom.code,
        roomName: newRoom.name,
        description: newRoom.description,
        creatorId: newRoom.creatorId,
        creatorName: newRoom.creatorName,
        memberCount: 1,
        members: [myShort],
        memberNames: { [myShort]: profile.displayName || 'Room Host' },
        senderId: `peer_${myShort}`,
        senderShortId: myShort,
        senderName: profile.displayName || 'Room Host',
        timestamp: Date.now(),
      };
      transportManager.sendPacket('broadcast', announcePacket).catch(() => {});
      peersRef.current.forEach((p) => {
        if (p.distanceBracket !== 'out_of_range') {
          transportManager.sendPacket(p.id, announcePacket).catch(() => {});
        }
      });
      setTimeout(() => {
        transportManager.sendPacket('broadcast', announcePacket).catch(() => {});
      }, 300);

      return newRoom;
    },
    [persistRooms, persistMessages]
  );

  const startPlusTrial = useCallback(() => {
    entitlements.startFreeTrial();
  }, []);

  const subscribePlus = useCallback(() => {
    entitlements.activateSubscription('plus_active');
  }, []);

  const canUseFeature = useCallback((feature: Parameters<typeof entitlements.can>[0]) => {
    return entitlements.can(feature);
  }, []);

  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    const updated = updateProfile({
      ...updates,
      isInitialSetupDone: true,
    });
    setMyProfile({ ...updated });
    transportManager.getTransport().startAdvertising().catch(() => {});
  }, []);

  const pairPeer = useCallback((peerId: string) => {
    const canonicalId = normalizePeerId(peerId);
    setPeers((prev) =>
      prev.map((p) => (p.id === canonicalId || p.id === peerId ? { ...p, isPaired: true } : p))
    );
  }, []);

  const unpairPeer = useCallback(
    (peerId: string) => {
      const canonicalId = normalizePeerId(peerId);
      const myShortId = myProfile.id.slice(-6).toLowerCase();
      const targetShortId = peerId.slice(-6).toLowerCase();

      // Remove from persistent savedPeers
      setSavedPeers((prev) => {
        const updated = prev.filter(
          (p) =>
            p.id !== peerId &&
            p.id !== canonicalId &&
            !p.id.toLowerCase().endsWith(targetShortId)
        );
        persistSavedPeers(updated);
        return updated;
      });

      setPeers((prev) =>
        prev.map((p) =>
          p.id === canonicalId || p.id.toLowerCase().endsWith(targetShortId)
            ? { ...p, isPaired: false }
            : p
        )
      );
      setConnectionStateMap((prev) => {
        const next = { ...prev };
        delete next[peerId];
        delete next[canonicalId];
        delete next[`ble_${targetShortId}`];
        return next;
      });

      // Transmit disconnection notice over the radio
      transportManager.sendPacket(canonicalId, {
        type: 'CONNECTION_DISCONNECTED',
        id: `disc_${Date.now()}`,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        targetPeerId: canonicalId,
        targetShortId: targetShortId,
        timestamp: Date.now(),
      }).catch(() => {});
      disconnectRadioPeer(canonicalId).catch(() => {});
    },
    [myProfile, persistSavedPeers]
  );

  const deleteConversation = useCallback(
    (targetId: string) => {
      const canonicalId = normalizePeerId(targetId);
      const myShortId = myProfile.id.slice(-6).toLowerCase();
      const targetShortId = targetId.slice(-6).toLowerCase();

      // 1. Remove from savedPeers
      setSavedPeers((prev) => {
        const updated = prev.filter(
          (p) =>
            p.id !== targetId &&
            p.id !== canonicalId &&
            !p.id.toLowerCase().endsWith(targetShortId)
        );
        persistSavedPeers(updated);
        return updated;
      });

      // 2. Mark un-paired in live discovery
      setPeers((prev) =>
        prev.map((p) =>
          p.id === canonicalId || p.id === targetId || p.id.toLowerCase().endsWith(targetShortId)
            ? { ...p, isPaired: false }
            : p
        )
      );

      // 3. Purge all message history for this thread
      setMessages((prev) => {
        const next = { ...prev };
        delete next[targetId];
        delete next[canonicalId];
        delete next[`peer_${targetShortId}`];
        delete next[targetShortId];
        persistMessages(next);
        return next;
      });

      // 4. Reset connection states
      setConnectionStateMap((prev) => {
        const next = { ...prev };
        delete next[targetId];
        delete next[canonicalId];
        return next;
      });

      // 5. Transmit disconnection notice over the radio to companion
      transportManager.sendPacket(canonicalId, {
        type: 'CONNECTION_DISCONNECTED',
        id: `disc_${Date.now()}`,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        targetPeerId: canonicalId,
        targetShortId: targetShortId,
        timestamp: Date.now(),
      }).catch(() => {});
      disconnectRadioPeer(canonicalId).catch(() => {});
    },
    [myProfile, persistSavedPeers, persistMessages]
  );

  const deleteEventRoom = useCallback(
    (roomId: string) => {
      const profile = getLocalProfile();
      const myShort = profile.id.slice(-6).toLowerCase();

      const target = eventRoomsRef.current.find((r) => r.id === roomId || r.code === roomId);
      const isMyRoom =
        target?.creatorId === profile.id ||
        target?.creatorId === `peer_${myShort}` ||
        (target?.creatorId && target.creatorId.toLowerCase().endsWith(myShort));

      if (isMyRoom) {
        // OWNER DELETES ROOM: Broadcast ROOM_DESTROYED so all members are evicted and room is purged everywhere
        const destroyPacket = {
          id: `destroy_${Date.now()}`,
          type: 'ROOM_DESTROYED',
          roomId: target?.id || roomId,
          roomCode: target?.code || roomId.replace('room_', ''),
          roomName: target?.name,
          senderId: `peer_${myShort}`,
          senderShortId: myShort,
          senderName: profile.displayName || 'Room Host',
          timestamp: Date.now(),
        };
        transportManager.sendPacket('broadcast', destroyPacket).catch(() => {});
        peersRef.current.forEach((p) => {
          if (p.distanceBracket !== 'out_of_range') {
            transportManager.sendPacket(p.id, destroyPacket).catch(() => {});
          }
        });
        setTimeout(() => {
          transportManager.sendPacket('broadcast', destroyPacket).catch(() => {});
        }, 300);

        // Completely delete room from state & storage
        setEventRooms((prev) => {
          const updated = prev.filter((r) => r.id !== roomId && r.code !== roomId);
          persistRooms(updated);
          return updated;
        });

        // Purge messages for this room
        setMessages((msgPrev) => {
          const next = { ...msgPrev };
          delete next[roomId];
          if (target?.code) {
            delete next[target.code];
            delete next[`room_${target.code}`];
          }
          persistMessages(next);
          return next;
        });

        DeviceEventEmitter.emit('ROOM_KICKED_OUT', {
          roomId: target?.id || roomId,
          roomCode: target?.code,
          reason: 'You deleted this room.',
        });
      } else {
        // Member leaving room: broadcast ROOM_LEAVE
        const leavePacket = {
          id: `leave_${Date.now()}`,
          type: 'ROOM_LEAVE',
          roomId: target?.id || roomId,
          roomCode: target?.code || roomId.replace('room_', ''),
          roomName: target?.name,
          senderId: `peer_${myShort}`,
          senderShortId: myShort,
          senderName: profile.displayName || 'Radii User',
          timestamp: Date.now(),
        };
        transportManager.sendPacket('broadcast', leavePacket).catch(() => {});
        peersRef.current.forEach((p) => {
          if (p.distanceBracket !== 'out_of_range') {
            transportManager.sendPacket(p.id, leavePacket).catch(() => {});
          }
        });
        setTimeout(() => {
          transportManager.sendPacket('broadcast', leavePacket).catch(() => {});
        }, 300);

        // Member leaving room: completely remove from local rooms list & persistence
        setEventRooms((prev) => {
          const updated = prev.filter((r) => r.id !== roomId && r.code !== roomId);
          persistRooms(updated);
          return updated;
        });

        // Purge messages for this room locally
        setMessages((msgPrev) => {
          const next = { ...msgPrev };
          delete next[roomId];
          if (target?.code) {
            delete next[target.code];
            delete next[`room_${target.code}`];
          }
          persistMessages(next);
          return next;
        });
      }
    },
    [persistRooms, persistMessages]
  );

  const removeEventRoom = useCallback(
    (roomId: string) => {
      setEventRooms((prev) => {
        const updated = prev.filter((r) => r.id !== roomId && r.code !== roomId);
        persistRooms(updated);
        return updated;
      });
      setMessages((msgPrev) => {
        const next = { ...msgPrev };
        delete next[roomId];
        persistMessages(next);
        return next;
      });
    },
    [persistRooms, persistMessages]
  );

  const acceptConnection = useCallback(
    (req: IncomingConnectionRequest) => {
      const canonicalId = normalizePeerId(req.peerId);
      const myShortId = myProfile.id.slice(-6).toLowerCase();
      const targetShortId = req.peerId.slice(-6).toLowerCase();

      setIncomingRequest(null);
      setPeers((prev) =>
        prev.map((p) =>
          p.id === canonicalId || p.id.toLowerCase().endsWith(targetShortId)
            ? { ...p, isPaired: true, activeTransport: 'nearby', statusMessage: 'Direct Nearby Connection' }
            : p
        )
      );
      setConnectionStateMap((prev) => ({
        ...prev,
        [req.peerId]: 'accepted',
        [canonicalId]: 'accepted',
        [`ble_${targetShortId}`]: 'accepted',
      }));

      // Transmit acceptance packet back over the radio
      transportManager.sendPacket(canonicalId, {
        type: 'CONNECTION_ACCEPTED',
        id: `acc_${Date.now()}`,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        fullSenderId: myProfile.id,
        senderName: myProfile.displayName || myProfile.deviceName || 'Radii User',
        targetPeerId: canonicalId,
        targetShortId: targetShortId,
        transport: 'nearby',
        timestamp: Date.now(),
      });
    },
    [myProfile]
  );

  const declineConnection = useCallback(
    (req: IncomingConnectionRequest) => {
      const canonicalId = normalizePeerId(req.peerId);
      const myShortId = myProfile.id.slice(-6).toLowerCase();
      const targetShortId = req.peerId.slice(-6).toLowerCase();

      setIncomingRequest(null);
      setConnectionStateMap((prev) => ({
        ...prev,
        [req.peerId]: 'declined',
        [canonicalId]: 'declined',
        [`ble_${targetShortId}`]: 'declined',
      }));

      // Transmit decline packet back over the radio
      transportManager.sendPacket(canonicalId, {
        type: 'CONNECTION_DECLINED',
        id: `dec_${Date.now()}`,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        fullSenderId: myProfile.id,
        senderName: myProfile.displayName || myProfile.deviceName || 'Radii User',
        targetPeerId: canonicalId,
        targetShortId: targetShortId,
        timestamp: Date.now(),
      });
    },
    [myProfile]
  );

  const requestConnection = useCallback(
    (peer: Peer) => {
      const canonicalId = normalizePeerId(peer.id);
      const myShortId = myProfile.id.slice(-6).toLowerCase();
      const targetShortId = peer.id.slice(-6).toLowerCase();
      const code = Math.floor(1000 + Math.random() * 9000).toString();

      setConnectionStateMap((prev) => ({
        ...prev,
        [peer.id]: 'waiting',
        [canonicalId]: 'waiting',
        [`ble_${targetShortId}`]: 'waiting',
      }));
      setVerificationCodeMap((prev) => ({
        ...prev,
        [peer.id]: code,
        [canonicalId]: code,
        [`ble_${targetShortId}`]: code,
      }));

      // Transmit connection request packet over the radio
      transportManager.sendPacket(canonicalId, {
        type: 'CONNECTION_REQUEST',
        id: `req_${Date.now()}`,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        fullSenderId: myProfile.id,
        senderName: myProfile.displayName || myProfile.deviceName || 'Radii User',
        senderDevice: myProfile.deviceName || 'Android Radio',
        targetPeerId: canonicalId,
        targetShortId: targetShortId,
        verificationCode: code,
        transport: 'nearby',
        timestamp: Date.now(),
      });
    },
    [myProfile]
  );

  const cancelConnectionRequest = useCallback((peerId: string) => {
    const canonicalId = normalizePeerId(peerId);
    const targetShortId = peerId.slice(-6).toLowerCase();
    setConnectionStateMap((prev) => ({
      ...prev,
      [peerId]: 'idle',
      [canonicalId]: 'idle',
      [`ble_${targetShortId}`]: 'idle',
    }));
  }, []);

  const rescan = useCallback(async () => {
    startScanWithTimeout(18000);
    // Keep already paired peers, reset unpaired peers on radar
    setPeers((prev) => prev.filter((p) => p.isPaired));

    // Broadcast ROOM_QUERY so any existing rooms hosted nearby are immediately discovered
    const profile = getLocalProfile();
    const myShort = profile.id.slice(-6).toLowerCase();
    const queryPacket = {
      id: `query_rescan_${Date.now()}`,
      type: 'ROOM_QUERY',
      senderId: `peer_${myShort}`,
      senderShortId: myShort,
      timestamp: Date.now(),
    };
    transportManager.sendPacket('broadcast', queryPacket).catch(() => {});

    try {
      await transportManager.stop();
      await transportManager.start();
    } catch (err) {
      console.warn('Rescan error:', err);
    }
  }, [startScanWithTimeout]);

  const value = useMemo<OrbitorContextValue>(
    () => ({
      myProfile,
      peers,
      messages,
      networkMode,
      autoUpgrade,
      outboxItems,
      entitlements: entitlementState,
      activeSOS,
      eventRooms,
      fileTransfers,
      isScanning,
      permissionsGranted,
      setNetworkMode,
      setAutoUpgrade,
      sendMessage,
      sendVoiceNote,
      sendMediaTransfer,
      acceptMediaTransfer,
      declineMediaTransfer,
      cancelMediaTransfer,
      retryMediaTransfer,
      triggerSOS,
      dismissSOS,
      startFileFling,
      joinEventRoom,
      createEventRoom,
      startPlusTrial,
      subscribePlus,
      canUseFeature,
      updateUserProfile,
      pairPeer,
      unpairPeer,
      deleteConversation,
      deleteEventRoom,
      removeEventRoom,
      savedPeers,
      savePeer,
      typingMap,
      sendTypingStatus,
      markChatAsRead,
      setActiveChatPeerId,
      incomingRequest,
      connectionStateMap,
      verificationCodeMap,
      acceptConnection,
      declineConnection,
      requestConnection,
      cancelConnectionRequest,
      rescan,
      setPermissionsGranted,
    }),
    [
      myProfile,
      peers,
      savedPeers,
      savePeer,
      messages,
      typingMap,
      sendTypingStatus,
      markChatAsRead,
      setActiveChatPeerId,
      networkMode,
      autoUpgrade,
      outboxItems,
      entitlementState,
      activeSOS,
      eventRooms,
      fileTransfers,
      isScanning,
      permissionsGranted,
      setNetworkMode,
      setAutoUpgrade,
      sendMessage,
      sendVoiceNote,
      sendMediaTransfer,
      acceptMediaTransfer,
      declineMediaTransfer,
      cancelMediaTransfer,
      retryMediaTransfer,
      triggerSOS,
      dismissSOS,
      startFileFling,
      joinEventRoom,
      createEventRoom,
      startPlusTrial,
      subscribePlus,
      canUseFeature,
      updateUserProfile,
      pairPeer,
      unpairPeer,
      deleteConversation,
      deleteEventRoom,
      removeEventRoom,
      incomingRequest,
      connectionStateMap,
      verificationCodeMap,
      acceptConnection,
      declineConnection,
      requestConnection,
      cancelConnectionRequest,
      rescan,
    ]
  );

  return <OrbitorContext.Provider value={value}>{children}</OrbitorContext.Provider>;
};

export function useOrbitor(): OrbitorContextValue {
  const ctx = useContext(OrbitorContext);
  if (!ctx) {
    throw new Error('useOrbitor must be used within an OrbitorProvider');
  }
  return ctx;
}
