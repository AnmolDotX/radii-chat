import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Peer,
  Message,
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
import { normalizePeerId } from '../transport/NativeRadioTransport';
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
  sendMessage: (peerId: string, text: string) => Promise<boolean>;
  sendVoiceNote: (peerId: string, durationSec: number) => Promise<boolean>;
  triggerSOS: (message?: string) => void;
  dismissSOS: () => void;
  startFileFling: (peerId: string, fileName: string, sizeBytes: number) => void;
  joinEventRoom: (code: string) => boolean;
  createEventRoom: (name: string, description?: string, customCode?: string) => EventRoom;
  startPlusTrial: () => void;
  subscribePlus: () => void;
  canUseFeature: (feature: Parameters<typeof entitlements.can>[0]) => boolean;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  pairPeer: (peerId: string) => void;
  unpairPeer: (peerId: string) => void;
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

const INITIAL_ROOMS: EventRoom[] = [];

export const OrbitorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [myProfile, setMyProfile] = useState<UserProfile>(getLocalProfile);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
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

  const startScanWithTimeout = useCallback((durationMs: number = 18000) => {
    setIsScanning(true);
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = setTimeout(() => {
      setIsScanning(false);
    }, durationMs);
  }, []);

  // Initialize transport and subscriptions
  useEffect(() => {
    let cancelled = false;

    const initTransport = async () => {
      // CRITICAL: Load profile FIRST so identity is stable before native BLE starts
      const persisted = await loadPersistedProfile();
      if (cancelled) return;
      setMyProfile({ ...persisted });

      // Automatically sync OS permission status on start
      try {
        const hasPerms = await checkRadioPermissions();
        if (!cancelled && hasPerms) {
          setPermissionsGranted(true);
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

        setPeers((prev) => {
          const index = prev.findIndex(
            (p) => p.id === canonicalId || p.id.toLowerCase().endsWith(shortId)
          );

          if (index >= 0) {
            const existing = prev[index];
            const mergedTransports = Array.from(
              new Set([...existing.availableTransports, ...discovered.availableTransports])
            );
            const isNearby = Boolean(discovered.ipAddress || existing.ipAddress);

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
              isPaired: existing.isPaired || discovered.isPaired,
              availableTransports: mergedTransports,
              activeTransport: isNearby ? 'nearby' : 'ble',
              macAddress: discovered.macAddress || existing.macAddress,
              ipAddress: discovered.ipAddress || existing.ipAddress,
              statusMessage: isNearby ? 'Direct Wi-Fi Mesh' : 'Direct BLE Radio Signal',
            };

            const updated = [...prev];
            updated[index] = updatedPeer;
            return updated;
          }

          return [...prev, { ...discovered, id: canonicalId, shortId }];
        });
      });

      const unsubPeerLost = transport.onPeerLost((lostId) => {
        const canonicalId = normalizePeerId(lostId);
        const shortId = lostId.slice(-6).toLowerCase();
        setPeers((prev) =>
          prev.filter((p) => p.id !== lostId && p.id !== canonicalId && !p.id.toLowerCase().endsWith(shortId))
        );
      });

      const unsubMsg = transport.onMessageReceived((incoming) => {
        const msgType = incoming.type || 'CHAT_MSG';
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
                return { ...p, isPaired: true };
              }
              return p;
            })
          );
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
          setPeers((prev) =>
            prev.map((p) => {
              if (p.id === canonicalSenderId || p.id.toLowerCase().endsWith(senderShortId)) {
                return { ...p, isPaired: false };
              }
              return p;
            })
          );
          setConnectionStateMap((prev) => ({
            ...prev,
            [incoming.senderId]: 'idle',
            [canonicalSenderId]: 'idle',
          }));
          return;
        }

        // 5. MSG_ACK (Delivery Confirmation from recipient)
        if (msgType === 'MSG_ACK' && incoming.ackMessageId) {
          setMessages((prev) => {
            const list = prev[canonicalSenderId] || [];
            return {
              ...prev,
              [canonicalSenderId]: list.map((m) =>
                m.id === incoming.ackMessageId ? { ...m, status: 'delivered' } : m
              ),
            };
          });
          return;
        }

        // 6. REGULAR CHAT MESSAGE
        const convoKey = canonicalSenderId;
        setMessages((prev) => {
          const list = prev[convoKey] || [];
          if (list.some((m) => m.id === incoming.id)) return prev;
          return {
            ...prev,
            [convoKey]: [
              ...list,
              { ...incoming, conversationId: convoKey, senderId: canonicalSenderId },
            ],
          };
        });

        // Automatically transmit MSG_ACK back to sender so sender shows double ticks (✓✓)
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
        });
      });

      const unsubOutbox = outbox.subscribe((items) => {
        setOutboxItems(items);
      });

      const unsubEntitlements = entitlements.subscribe((state) => {
        setEntitlementState(state);
      });

      // Store cleanup refs
      cleanupRef.current = () => {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
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

  const sendMessage = useCallback(
    async (peerId: string, text: string): Promise<boolean> => {
      const canonicalId = normalizePeerId(peerId);
      const peer = peers.find(
        (p) => p.id === canonicalId || p.id.toLowerCase().endsWith(peerId.slice(-6).toLowerCase())
      );
      const isPeerInRange = peer && peer.distanceBracket !== 'out_of_range';

      const myShortId = myProfile.id.slice(-6).toLowerCase();
      const targetShortId = peerId.slice(-6).toLowerCase();

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
      };

      setMessages((prev) => ({
        ...prev,
        [canonicalId]: [...(prev[canonicalId] || []), newMsg],
      }));

      if (isPeerInRange) {
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
    [peers, myProfile]
  );

  const sendVoiceNote = useCallback(
    async (peerId: string, durationSec: number): Promise<boolean> => {
      const peer = peers.find((p) => p.id === peerId);
      const newVoiceMsg: Message = {
        id: `voice_${Date.now()}`,
        conversationId: peerId,
        senderId: myProfile.id,
        senderName: myProfile.displayName,
        text: 'Voice PTT audio note',
        timestamp: Date.now(),
        transport: peer?.activeTransport || 'nearby',
        status: 'delivered',
        isMe: true,
        isVoice: true,
        audioDurationSeconds: durationSec,
      };

      setMessages((prev) => ({
        ...prev,
        [peerId]: [...(prev[peerId] || []), newVoiceMsg],
      }));

      return transportManager.sendVoice(peerId, durationSec);
    },
    [peers, myProfile]
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
    (code: string): boolean => {
      const formatted = code.trim().toUpperCase();
      const existing = eventRooms.find((r) => r.code === formatted);
      if (existing) return true;

      const newRoom: EventRoom = {
        id: `room_${Date.now()}`,
        name: `Mesh Room ${formatted}`,
        code: formatted,
        category: 'campus',
        memberCount: 5,
        isActive: true,
        description: 'Joined via QR Mesh invite',
      };
      setEventRooms((prev) => [newRoom, ...prev]);
      return true;
    },
    [eventRooms]
  );

  const createEventRoom = useCallback(
    (name: string, description?: string, customCode?: string): EventRoom => {
      const code = (customCode?.trim().toUpperCase() || Math.random().toString(36).substring(2, 6).toUpperCase());
      const newRoom: EventRoom = {
        id: `room_${Date.now()}`,
        name: name.trim() || `Room ${code}`,
        code,
        category: 'campus',
        memberCount: 1,
        isActive: true,
        description: description?.trim() || 'Offline LAN & Mesh Channel',
      };
      setEventRooms((prev) => [newRoom, ...prev]);
      return newRoom;
    },
    []
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

      setPeers((prev) =>
        prev.map((p) =>
          p.id === canonicalId || p.id.toLowerCase().endsWith(targetShortId)
            ? { ...p, isPaired: false }
            : p
        )
      );
      setConnectionStateMap((prev) => ({
        ...prev,
        [peerId]: 'idle',
        [canonicalId]: 'idle',
        [`ble_${targetShortId}`]: 'idle',
      }));

      // Transmit disconnection notice over the radio
      transportManager.sendPacket(canonicalId, {
        type: 'CONNECTION_DISCONNECTED',
        id: `disc_${Date.now()}`,
        senderId: `peer_${myShortId}`,
        senderShortId: myShortId,
        targetPeerId: canonicalId,
        targetShortId: targetShortId,
        timestamp: Date.now(),
      });
    },
    [myProfile]
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
            ? { ...p, isPaired: true }
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
        transport: peer.activeTransport || 'nearby',
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
      messages,
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
