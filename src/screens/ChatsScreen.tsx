import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOrbitorTheme, Typography, Radius, Spacing, Layout, Shadows } from '@/theme';
import { useOrbitor } from '@/context/OrbitorContext';
import { normalizePeerId } from '@/transport/NativeRadioTransport';
import { PeerAvatar } from '@/components/common/PeerAvatar';
import { Badge } from '@/components/common/Badge';
import { OutboxNotice } from '@/components/common/OutboxNotice';
import { RoomsModal } from '@/components/modals/RoomsModal';
import { JoinRoomPinModal } from '@/components/modals/JoinRoomPinModal';
import { Ionicons } from '@expo/vector-icons';
import { Peer, EventRoom } from '@/core/types';

interface ChatsScreenProps {
  onNavigateToRadar?: () => void;
}

function formatChatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatsScreen({ onNavigateToRadar }: ChatsScreenProps) {
  const theme = useOrbitorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    myProfile,
    peers,
    savedPeers,
    messages,
    typingMap,
    eventRooms,
    outboxItems,
    joinEventRoom,
    createEventRoom,
    deleteConversation,
    deleteEventRoom,
    removeEventRoom,
    rescan,
    isScanning,
  } = useOrbitor();

  const [roomsModalVisible, setRoomsModalVisible] = useState(false);
  const [selectedRoomForPin, setSelectedRoomForPin] = useState<EventRoom | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'personal' | 'rooms'>('all');

  const handleOpenConversation = (id: string, name: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id, name },
    });
  };

  const handleCreateRoom = (name: string, description?: string, customCode?: string) => {
    const room = createEventRoom(name, description, customCode);
    handleOpenConversation(room.id, room.name);
  };

  const handleJoinRoom = (code: string) => {
    const room = joinEventRoom(code);
    handleOpenConversation(room.id, room.name);
  };

  const handleRoomLongPress = (room: EventRoom) => {
    const myShort = myProfile.id.slice(-6).toLowerCase();
    const isCreator =
      room.creatorId === myProfile.id ||
      room.creatorId === `peer_${myShort}` ||
      (room.creatorId && room.creatorId.toLowerCase().endsWith(myShort));

    if (isCreator) {
      Alert.alert(
        'Delete Room',
        `Do you want to permanently delete "${room.name}"? This will close the room for everyone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Room',
            style: 'destructive',
            onPress: () => deleteEventRoom(room.id),
          },
        ]
      );
    } else {
      Alert.alert(
        'Leave Room',
        `Do you want to leave "${room.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave Room',
            style: 'destructive',
            onPress: () => deleteEventRoom(room.id),
          },
        ]
      );
    }
  };

  const handleInRangeRoomLongPress = (room: EventRoom) => {
    Alert.alert(
      'Remove Room',
      `Remove "${room.name}" from detected rooms list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeEventRoom(room.id),
        },
      ]
    );
  };

  // Distinct room categories: Joined vs Discovered in Range (PIN required)
  // REQUIREMENT 3: If everyone has left, room is automatically removed and not visible in Nearby list
  const joinedRooms = useMemo(() => {
    return eventRooms.filter((r) => r && r.isJoined === true && (r.memberCount === undefined || r.memberCount > 0));
  }, [eventRooms]);

  const inRangeRooms = useMemo(() => {
    return eventRooms.filter((r) => {
      if (!r || r.isJoined) return false;
      if (r.id?.includes('Testing') || r.name?.includes('Testing 123')) return false;
      return r.memberCount === undefined || r.memberCount > 0;
    });
  }, [eventRooms]);

  // Combine saved paired peers with live radio status
  const allConversations = useMemo(() => {
    const map = new Map<string, { peer: Peer; isOnline: boolean; lastSeen?: number }>();

    const isGhostOrCorrupt = (id?: string, name?: string) => {
      if (!id) return true;
      const lowerId = id.toLowerCase();
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

    // 1. Add saved paired peers only (unpaired/deleted peers must not appear)
    savedPeers.forEach((p) => {
      if (isGhostOrCorrupt(p.id, p.name)) return;
      if (p.isPaired === false) return;
      const canonicalId = normalizePeerId(p.id);
      map.set(canonicalId, {
        peer: { ...p, id: canonicalId, isPaired: true },
        isOnline: false,
        lastSeen: p.lastSeen,
      });
    });

    // 2. Reconcile with live discovered radio peers (updates online status & signal for paired companions)
    peers.forEach((livePeer) => {
      if (isGhostOrCorrupt(livePeer.id, livePeer.name)) return;
      const canonicalId = normalizePeerId(livePeer.id);
      const isOnline = livePeer.distanceBracket !== 'out_of_range';

      if (map.has(canonicalId)) {
        const existing = map.get(canonicalId)!;
        map.set(canonicalId, {
          peer: {
            ...existing.peer,
            ...livePeer,
            id: canonicalId,
            isPaired: true,
          },
          isOnline,
          lastSeen: livePeer.lastSeen || Date.now(),
        });
      }
    });

    // Sort by latest message timestamp, or lastSeen
    return Array.from(map.values())
      .filter((c) => !isGhostOrCorrupt(c.peer.id, c.peer.name))
      .sort((a, b) => {
        const aMsgs = messages[a.peer.id] || [];
        const bMsgs = messages[b.peer.id] || [];
        const aLast = aMsgs[aMsgs.length - 1]?.timestamp || a.lastSeen || 0;
        const bLast = bMsgs[bMsgs.length - 1]?.timestamp || b.lastSeen || 0;
        return bLast - aLast;
      });
  }, [savedPeers, peers, messages]);

  const totalRoomsCount = joinedRooms.length + inRangeRooms.length;
  const totalAllCount = allConversations.length + totalRoomsCount;
  const hasAnyChat = totalAllCount > 0;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Layout.tabBarHeight + insets.bottom + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Mesh Chats</Text>
            <Text style={[styles.subtitle, { color: theme.textTertiary }]}>
              Saved radio companions & offline rooms
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={rescan}
              disabled={isScanning}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: theme.surface,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              {isScanning ? (
                <ActivityIndicator size="small" color={theme.accentCyan} />
              ) : (
                <Ionicons name="refresh" size={16} color={theme.text} />
              )}
            </Pressable>

            <Pressable
              onPress={() => setRoomsModalVisible(true)}
              style={({ pressed }) => [
                styles.qrButton,
                {
                  backgroundColor: theme.surface,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Text style={[styles.qrButtonText, { color: theme.text }]}>+ Rooms</Text>
            </Pressable>
          </View>
        </View>

        {/* Tab-based Filter: All, Personal, Rooms */}
        <View style={styles.filterTabsRow}>
          <Pressable
            onPress={() => setFilterTab('all')}
            accessibilityRole="tab"
            accessibilityState={{ selected: filterTab === 'all' }}
            style={({ pressed }) => [
              styles.filterTabPill,
              {
                backgroundColor: filterTab === 'all' ? theme.accentCyan : theme.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text
              style={[
                styles.filterTabLabel,
                {
                  color: filterTab === 'all' ? '#FFFFFF' : theme.textSecondary,
                  fontWeight:
                    filterTab === 'all' ? Typography.weights.bold : Typography.weights.medium,
                },
              ]}>
              All
            </Text>
            {totalAllCount > 0 && (
              <View
                style={[
                  styles.filterTabBadge,
                  {
                    backgroundColor:
                      filterTab === 'all' ? 'rgba(255, 255, 255, 0.25)' : theme.surfaceElevated,
                  },
                ]}>
                <Text
                  style={[
                    styles.filterTabBadgeText,
                    {
                      color: filterTab === 'all' ? '#FFFFFF' : theme.textTertiary,
                    },
                  ]}>
                  {totalAllCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setFilterTab('personal')}
            accessibilityRole="tab"
            accessibilityState={{ selected: filterTab === 'personal' }}
            style={({ pressed }) => [
              styles.filterTabPill,
              {
                backgroundColor: filterTab === 'personal' ? theme.accentCyan : theme.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text
              style={[
                styles.filterTabLabel,
                {
                  color: filterTab === 'personal' ? '#FFFFFF' : theme.textSecondary,
                  fontWeight:
                    filterTab === 'personal' ? Typography.weights.bold : Typography.weights.medium,
                },
              ]}>
              Personal
            </Text>
            {allConversations.length > 0 && (
              <View
                style={[
                  styles.filterTabBadge,
                  {
                    backgroundColor:
                      filterTab === 'personal' ? 'rgba(255, 255, 255, 0.25)' : theme.surfaceElevated,
                  },
                ]}>
                <Text
                  style={[
                    styles.filterTabBadgeText,
                    {
                      color: filterTab === 'personal' ? '#FFFFFF' : theme.textTertiary,
                    },
                  ]}>
                  {allConversations.length}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setFilterTab('rooms')}
            accessibilityRole="tab"
            accessibilityState={{ selected: filterTab === 'rooms' }}
            style={({ pressed }) => [
              styles.filterTabPill,
              {
                backgroundColor: filterTab === 'rooms' ? theme.accentCyan : theme.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text
              style={[
                styles.filterTabLabel,
                {
                  color: filterTab === 'rooms' ? '#FFFFFF' : theme.textSecondary,
                  fontWeight:
                    filterTab === 'rooms' ? Typography.weights.bold : Typography.weights.medium,
                },
              ]}>
              Rooms
            </Text>
            {totalRoomsCount > 0 && (
              <View
                style={[
                  styles.filterTabBadge,
                  {
                    backgroundColor:
                      filterTab === 'rooms' ? 'rgba(255, 255, 255, 0.25)' : theme.surfaceElevated,
                  },
                ]}>
                <Text
                  style={[
                    styles.filterTabBadgeText,
                    {
                      color: filterTab === 'rooms' ? '#FFFFFF' : theme.textTertiary,
                    },
                  ]}>
                  {totalRoomsCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Zero-leak Outbox Notice */}
        <OutboxNotice items={outboxItems} />

        {filterTab === 'all' && !hasAnyChat ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: theme.surface },
              ]}>
              <Ionicons name="chatbubbles-outline" size={36} color={theme.accentCyan} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No radio companions yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Connect with nearby users on the Radar sweep screen. Once paired, your conversations are saved here like paired Bluetooth devices.
            </Text>

            <View style={styles.emptyButtonRow}>
              <Pressable
                onPress={onNavigateToRadar}
                style={({ pressed }) => [
                  styles.emptyActionButton,
                  {
                    backgroundColor: theme.accentCyan,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text style={[styles.emptyActionText, { color: '#FFFFFF' }]}>
                  ⚡ Discover Companions on Radar
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRoomsModalVisible(true)}
                style={({ pressed }) => [
                  styles.secondaryActionButton,
                  {
                    backgroundColor: theme.surfaceElevated,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Text style={[styles.secondaryActionText, { color: theme.text }]}>
                  + Create or Join Room
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {/* Direct Companions (Bluetooth / Wi-Fi Mesh Saved Chats) */}
            {(filterTab === 'all' || filterTab === 'personal') && (
              allConversations.length > 0 ? (
                <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
                    SAVED COMPANIONS
                  </Text>
                  <Text style={[styles.sectionCount, { color: theme.textTertiary }]}>
                    {allConversations.filter((c) => c.isOnline).length} ONLINE · {allConversations.length} SAVED
                  </Text>
                </View>

                <View style={styles.peersList}>
                  {allConversations.map(({ peer, isOnline }) => {
                    const peerMessages = messages[peer.id] || [];
                    const lastMsg = peerMessages[peerMessages.length - 1];
                    const isTyping = Boolean(typingMap[peer.id]);

                    return (
                      <Pressable
                        key={peer.id}
                        onPress={() => handleOpenConversation(peer.id, peer.name)}
                        onLongPress={() => {
                          Alert.alert(
                            'Delete Conversation',
                            `Delete chat history and unpair ${peer.name}?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => deleteConversation(peer.id),
                              },
                            ]
                          );
                        }}
                        style={({ pressed }) => [
                          styles.peerItem,
                          {
                            backgroundColor: theme.surface,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <View style={styles.avatarWrapper}>
                          <PeerAvatar peer={peer} size={46} showSignal={isOnline} />
                          <View
                            style={[
                              styles.onlineBadge,
                              {
                                backgroundColor: isOnline ? theme.success : theme.surfaceElevated,
                              },
                            ]}
                          />
                        </View>

                        <View style={styles.peerChatInfo}>
                          <View style={styles.chatHeaderRow}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.peerName,
                                { color: isOnline ? theme.text : theme.textSecondary },
                              ]}>
                              {peer.name}
                            </Text>

                            <View style={styles.metaRightRow}>
                              {lastMsg ? (
                                <Text style={[styles.timeText, { color: theme.textTertiary }]}>
                                  {formatChatTime(lastMsg.timestamp)}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.messagePreviewRow}>
                            {/* If peer is typing */}
                            {isTyping ? (
                              <Text
                                style={[
                                  styles.typingText,
                                  { color: theme.success },
                                ]}>
                                typing...
                              </Text>
                            ) : lastMsg ? (
                              <View style={styles.lastMsgInline}>
                                {lastMsg.isMe && (
                                  <Text style={styles.tickIcon}>
                                    {lastMsg.status === 'read' ? (
                                      <Text style={{ color: '#38BDF8' }}>✓✓</Text>
                                    ) : lastMsg.status === 'delivered' ? (
                                      <Text style={{ color: theme.textTertiary }}>✓✓</Text>
                                    ) : lastMsg.status === 'queued_offline' ? (
                                      <Text style={{ color: theme.textTertiary, fontSize: 11 }}>⏱</Text>
                                    ) : (
                                      <Text style={{ color: theme.textTertiary }}>✓</Text>
                                    )}
                                  </Text>
                                )}
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.lastMessageText,
                                    { color: theme.textSecondary },
                                  ]}>
                                  {lastMsg.text}
                                </Text>
                              </View>
                            ) : (
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.emptyPreviewText,
                                  { color: theme.textTertiary },
                                ]}>
                                {isOnline
                                  ? 'Tap to start direct radio chat'
                                  : 'Offline · Out of radio range'}
                              </Text>
                            )}

                            {isOnline ? (
                              <Badge
                                label={peer.activeTransport || 'nearby'}
                                transport={peer.activeTransport || 'nearby'}
                                size="sm"
                              />
                            ) : (
                              <Text style={[styles.offlineLabel, { color: theme.textTertiary }]}>
                                Offline
                              </Text>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : filterTab === 'personal' ? (
              <View style={styles.filteredEmptyContainer}>
                <View
                  style={[
                    styles.filteredEmptyIcon,
                    { backgroundColor: theme.surfaceElevated },
                  ]}>
                  <Ionicons name="person-outline" size={28} color={theme.accentCyan} />
                </View>
                <Text style={[styles.filteredEmptyTitle, { color: theme.text }]}>
                  No Personal Chats
                </Text>
                <Text style={[styles.filteredEmptySubtitle, { color: theme.textSecondary }]}>
                  Discover and pair with nearby devices on the Radar tab to start direct 1-on-1 radio chats.
                </Text>
                {onNavigateToRadar && (
                  <Pressable
                    onPress={onNavigateToRadar}
                    style={({ pressed }) => [
                      styles.emptyActionButton,
                      {
                        backgroundColor: theme.accentCyan,
                        opacity: pressed ? 0.85 : 1,
                        marginTop: Spacing.sm,
                      },
                    ]}>
                    <Text style={[styles.emptyActionText, { color: '#FFFFFF' }]}>
                      ⚡ Discover Companions on Radar
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null)}

            {/* Mesh Event Rooms */}
            {(filterTab === 'all' || filterTab === 'rooms') && (
              <>
                {/* 1. JOINED ROOMS */}
                {joinedRooms.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
                        JOINED ROOMS
                      </Text>
                      <Text style={[styles.sectionCount, { color: theme.textTertiary }]}>
                        {joinedRooms.length} ACTIVE
                      </Text>
                    </View>

                    <View style={styles.roomsList}>
                      {joinedRooms.map((room) => {
                        const roomMsgs = messages[room.id] || messages[room.code] || [];
                        const lastMsg = roomMsgs[roomMsgs.length - 1];

                        return (
                          <Pressable
                            key={room.id}
                            onPress={() => handleOpenConversation(room.id, room.name)}
                            onLongPress={() => {
                              const isOwner = Boolean(
                                room.creatorId &&
                                  (room.creatorId === myProfile.id ||
                                    room.creatorId === `peer_${myProfile.id.slice(-6).toLowerCase()}` ||
                                    room.creatorId.toLowerCase().endsWith(myProfile.id.slice(-6).toLowerCase()))
                              );
                              if (isOwner) {
                                Alert.alert(
                                  'Delete Room',
                                  `Are you sure you want to delete ${room.name}? Everyone will be removed and the broadcast room will be closed.`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Delete Room',
                                      style: 'destructive',
                                      onPress: () => deleteEventRoom(room.id),
                                    },
                                  ]
                                );
                              } else {
                                Alert.alert(
                                  'Leave Room',
                                  `Leave broadcast room ${room.name}?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Leave Room',
                                      style: 'destructive',
                                      onPress: () => deleteEventRoom(room.id),
                                    },
                                  ]
                                );
                              }
                            }}
                            style={({ pressed }) => [
                              styles.peerItem,
                              {
                                backgroundColor: theme.surface,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}>
                            <View style={styles.avatarWrapper}>
                              <View
                                style={[
                                  styles.roomAvatarCircle,
                                  {
                                    backgroundColor: theme.surfaceElevated,
                                  },
                                ]}>
                                <Ionicons name="people" size={22} color={theme.accentCyan} />
                              </View>
                            </View>

                            <View style={styles.peerChatInfo}>
                              <View style={styles.chatHeaderRow}>
                                <Text
                                  numberOfLines={1}
                                  style={[styles.peerName, { color: theme.text }]}>
                                  {room.name}
                                </Text>
                                <Badge
                                  label={`${room.memberCount || 1} member${(room.memberCount || 1) === 1 ? '' : 's'}`}
                                  variant="neutral"
                                  size="sm"
                                />

                                <View style={styles.metaRightRow}>
                                  {lastMsg ? (
                                    <Text style={[styles.timeText, { color: theme.textTertiary }]}>
                                      {formatChatTime(lastMsg.timestamp)}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>

                              <View style={styles.messagePreviewRow}>
                                {lastMsg ? (
                                  <View style={styles.lastMsgInline}>
                                    <Text
                                      numberOfLines={1}
                                      style={[
                                        styles.lastMessageText,
                                        { color: theme.textSecondary },
                                      ]}>
                                      {lastMsg.isMe ? 'You' : lastMsg.senderName || 'Member'}: {lastMsg.text}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text
                                    numberOfLines={1}
                                    style={[
                                      styles.emptyPreviewText,
                                      { color: theme.textTertiary },
                                    ]}>
                                    {room.description || 'Tap to enter broadcast channel'}
                                  </Text>
                                )}

                                <Badge label={room.code} variant="cyan" size="sm" />
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 2. ROOMS IN RANGE (PIN REQUIRED TO JOIN) */}
                {inRangeRooms.length > 0 && (
                  <View style={[styles.section, { marginTop: joinedRooms.length > 0 ? Spacing.sm : 0 }]}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="lock-closed" size={13} color={theme.accentCyan} />
                        <Text style={[styles.sectionHeading, { color: theme.accentCyan }]}>
                          ROOMS IN RANGE (PIN REQUIRED)
                        </Text>
                      </View>
                      <Text style={[styles.sectionCount, { color: theme.accentCyan }]}>
                        {inRangeRooms.length} DETECTED
                      </Text>
                    </View>
                    <Text style={[styles.inRangeSubtext, { color: theme.textTertiary }]}>
                      Nearby broadcast rooms. Tap to enter 4-digit PIN and join.
                    </Text>

                    <View style={styles.roomsList}>
                      {inRangeRooms.map((room) => (
                        <Pressable
                          key={room.id}
                          onPress={() => setSelectedRoomForPin(room)}
                          onLongPress={() => handleInRangeRoomLongPress(room)}
                          style={({ pressed }) => [
                            styles.peerItem,
                            styles.inRangeRoomCard,
                            {
                              backgroundColor: theme.surface,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}>
                          <View style={styles.avatarWrapper}>
                            <View
                              style={[
                                styles.roomAvatarCircle,
                                {
                                  backgroundColor: theme.surfaceElevated,
                                },
                              ]}>
                              <Ionicons name="lock-closed" size={20} color={theme.accentCyan} />
                            </View>
                          </View>

                          <View style={styles.peerChatInfo}>
                            <View style={styles.chatHeaderRow}>
                              <Text
                                numberOfLines={1}
                                style={[styles.peerName, { color: theme.text }]}>
                                {room.name}
                              </Text>
                              <Badge label="4-Digit PIN" variant="cyan" size="sm" />
                            </View>

                            <View style={styles.messagePreviewRow}>
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.emptyPreviewText,
                                  { color: theme.textSecondary },
                                ]}>
                                {room.memberCount || 1} member{(room.memberCount || 1) === 1 ? '' : 's'} · {room.creatorName ? `Host: ${room.creatorName}` : 'Nearby Companion'}
                              </Text>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleInRangeRoomLongPress(room);
                                  }}
                                  hitSlop={8}
                                  accessibilityLabel={`Remove ${room.name}`}
                                  style={({ pressed }) => [
                                    styles.dismissBtnPill,
                                    {
                                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                      opacity: pressed ? 0.6 : 1,
                                    },
                                  ]}>
                                  <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                </Pressable>

                                <View
                                  style={[
                                    styles.joinBtnPill,
                                    {
                                      backgroundColor: theme.surfaceHighlight,
                                    },
                                  ]}>
                                  <Ionicons
                                    name="key-outline"
                                    size={12}
                                    color={theme.accentCyan}
                                    style={{ marginRight: 4 }}
                                  />
                                  <Text style={[styles.joinBtnText, { color: theme.text }]}>
                                    Join
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* Empty State when in Rooms Tab and nothing joined or in range */}
                {filterTab === 'rooms' && joinedRooms.length === 0 && inRangeRooms.length === 0 && (
                  <View style={styles.filteredEmptyContainer}>
                    <View
                      style={[
                        styles.filteredEmptyIcon,
                        { backgroundColor: theme.surfaceElevated },
                      ]}>
                      <Ionicons name="people-outline" size={28} color={theme.accentCyan} />
                    </View>
                    <Text style={[styles.filteredEmptyTitle, { color: theme.text }]}>
                      No Mesh Rooms Available
                    </Text>
                    <Text style={[styles.filteredEmptySubtitle, { color: theme.textSecondary }]}>
                      Create an offline broadcast room with '+ Rooms' or wait for a nearby companion to broadcast a room.
                    </Text>
                    <Pressable
                      onPress={() => setRoomsModalVisible(true)}
                      style={({ pressed }) => [
                        styles.emptyActionButton,
                        {
                          backgroundColor: theme.accentCyan,
                          opacity: pressed ? 0.85 : 1,
                          marginTop: Spacing.sm,
                        },
                      ]}>
                      <Text style={[styles.emptyActionText, { color: '#FFFFFF' }]}>
                        + Create Broadcast Room
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Create Mesh Rooms Modal */}
      <RoomsModal
        visible={roomsModalVisible}
        onClose={() => setRoomsModalVisible(false)}
        onCreateRoom={handleCreateRoom}
        connectedPeersCount={peers.filter((p) => p.distanceBracket !== 'out_of_range').length}
      />

      {/* Join Room PIN Modal */}
      <JoinRoomPinModal
        visible={Boolean(selectedRoomForPin)}
        room={selectedRoomForPin}
        onClose={() => setSelectedRoomForPin(null)}
        onJoinSuccess={(code) => handleJoinRoom(code)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    maxWidth: Layout.maxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
    fontFamily: Typography.fontFamily,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    borderWidth: 0,
    ...Shadows.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrButton: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: Radius.full,
    borderWidth: 0,
    ...Shadows.subtle,
  },
  qrButtonText: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
  },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: 2,
  },
  filterTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 0,
    gap: 6,
    ...Shadows.subtle,
  },
  filterTabLabel: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
  },
  filterTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabBadgeText: {
    fontSize: 10,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
  },
  filteredEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  filteredEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  filteredEmptyTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  filteredEmptySubtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    gap: Spacing.xs + 2,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    borderWidth: 0,
    ...Shadows.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyButtonRow: {
    gap: Spacing.sm,
    width: '100%',
    maxWidth: 280,
    marginTop: Spacing.sm,
  },
  emptyActionButton: {
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
    borderWidth: 0,
    ...Shadows.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    fontSize: Typography.sizes.xs + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  secondaryActionButton: {
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: Typography.sizes.xs + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  section: {
    gap: Spacing.xs + 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
  },
  peersList: {
    gap: Spacing.xs + 2,
  },
  peerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    ...Shadows.subtle,
    gap: Spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: Radius.full,
    borderWidth: 0,
  },
  peerChatInfo: {
    flex: 1,
    gap: 4,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peerName: {
    fontSize: Typography.sizes.sm + 2,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
    maxWidth: '75%',
  },
  timeText: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
  },
  messagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  lastMsgInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tickIcon: {
    fontSize: 12,
    fontFamily: Typography.monoFamily,
    lineHeight: 14,
  },
  lastMessageText: {
    flex: 1,
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
  },
  emptyPreviewText: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontStyle: 'italic',
  },
  typingText: {
    flex: 1,
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
    fontStyle: 'italic',
  },
  offlineLabel: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
  },
  roomsList: {
    gap: Spacing.xs + 2,
  },
  roomCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    ...Shadows.subtle,
  },
  roomInfo: {
    gap: 3,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomName: {
    fontSize: Typography.sizes.sm + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  roomDescription: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  roomAvatarCircle: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inRangeSubtext: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    marginBottom: Spacing.xs,
    paddingHorizontal: 4,
  },
  inRangeRoomCard: {},
  joinBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 0,
  },
  joinBtnText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
  },
  dismissBtnPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
