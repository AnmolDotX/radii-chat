import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
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
import { entitlements, EntitlementState } from '../entitlements';
import { IncomingConnectionRequest } from '../components/modals/ConnectionRequestModal';

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

  // Actions
  setNetworkMode: (mode: NetworkMode) => void;
  setAutoUpgrade: (enabled: boolean) => void;
  sendMessage: (peerId: string, text: string) => Promise<boolean>;
  sendVoiceNote: (peerId: string, durationSec: number) => Promise<boolean>;
  triggerSOS: (message?: string) => void;
  dismissSOS: () => void;
  startFileFling: (peerId: string, fileName: string, sizeBytes: number) => void;
  joinEventRoom: (code: string) => boolean;
  startPlusTrial: () => void;
  subscribePlus: () => void;
  canUseFeature: (feature: Parameters<typeof entitlements.can>[0]) => boolean;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  pairPeer: (peerId: string) => void;
  incomingRequest: IncomingConnectionRequest | null;
  acceptConnection: (req: IncomingConnectionRequest) => void;
  declineConnection: (req: IncomingConnectionRequest) => void;
  requestConnection: (peer: Peer) => void;
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
  const [incomingRequest, setIncomingRequest] = useState<IncomingConnectionRequest | null>(null);

  // Initialize transport and subscriptions
  useEffect(() => {
    loadPersistedProfile().then((persisted) => {
      setMyProfile({ ...persisted });
    });

    const transport = transportManager.getTransport();
    transportManager.start();

    const unsubPeer = transport.onPeerDiscovered((discovered) => {
      setPeers((prev) => {
        const index = prev.findIndex((p) => p.id === discovered.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = discovered;
          return updated;
        }
        return [...prev, discovered];
      });
    });

    const unsubPeerLost = transport.onPeerLost((lostId) => {
      setPeers((prev) => prev.filter((p) => p.id !== lostId));
    });

    const unsubMsg = transport.onMessageReceived((incoming) => {
      setMessages((prev) => {
        const list = prev[incoming.conversationId] || [];
        return {
          ...prev,
          [incoming.conversationId]: [...list, incoming],
        };
      });
    });

    const unsubOutbox = outbox.subscribe((items) => {
      setOutboxItems(items);
    });

    const unsubEntitlements = entitlements.subscribe((state) => {
      setEntitlementState(state);
    });

    return () => {
      unsubPeer();
      unsubPeerLost();
      unsubMsg();
      unsubOutbox();
      unsubEntitlements();
      transportManager.stop();
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
      const peer = peers.find((p) => p.id === peerId);
      const isPeerInRange = peer && peer.distanceBracket !== 'out_of_range';

      const newMsg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        conversationId: peerId,
        senderId: myProfile.id,
        senderName: myProfile.displayName,
        text,
        timestamp: Date.now(),
        transport: peer?.activeTransport || 'nearby',
        status: isPeerInRange ? 'delivered' : 'queued_offline',
        isMe: true,
      };

      setMessages((prev) => ({
        ...prev,
        [peerId]: [...(prev[peerId] || []), newMsg],
      }));

      if (isPeerInRange) {
        return transportManager.send(peerId, text);
      } else {
        // Enqueue in zero-leak outbox
        outbox.enqueue(
          {
            conversationId: peerId,
            senderId: myProfile.id,
            senderName: myProfile.displayName,
            text,
            isMe: true,
            transport: 'nearby',
          },
          ['offline', 'lan'],
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
        transportBroadcast: ['ble', 'nearby', 'lan'],
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
    setPeers((prev) =>
      prev.map((p) => (p.id === peerId ? { ...p, isPaired: true } : p))
    );
  }, []);

  const acceptConnection = useCallback((req: IncomingConnectionRequest) => {
    setIncomingRequest(null);
    setPeers((prev) =>
      prev.map((p) => (p.id === req.peerId ? { ...p, isPaired: true } : p))
    );
  }, []);

  const declineConnection = useCallback((_req: IncomingConnectionRequest) => {
    setIncomingRequest(null);
  }, []);

  const requestConnection = useCallback((peer: Peer) => {
    // Triggers local handshake state
    setPeers((prev) =>
      prev.map((p) => (p.id === peer.id ? { ...p, isPaired: true } : p))
    );
  }, []);

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
      setNetworkMode,
      setAutoUpgrade,
      sendMessage,
      sendVoiceNote,
      triggerSOS,
      dismissSOS,
      startFileFling,
      joinEventRoom,
      startPlusTrial,
      subscribePlus,
      canUseFeature,
      updateUserProfile,
      pairPeer,
      incomingRequest,
      acceptConnection,
      declineConnection,
      requestConnection,
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
      setNetworkMode,
      setAutoUpgrade,
      sendMessage,
      sendVoiceNote,
      triggerSOS,
      dismissSOS,
      startFileFling,
      joinEventRoom,
      startPlusTrial,
      subscribePlus,
      canUseFeature,
      updateUserProfile,
      pairPeer,
      incomingRequest,
      acceptConnection,
      declineConnection,
      requestConnection,
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
