import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  Alert,
  Keyboard,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Layout, Shadows } from '@/theme';
import { useOrbitor } from '@/context/OrbitorContext';
import { normalizePeerId } from '@/transport/NativeRadioTransport';
import { Peer, EventRoom } from '@/core/types';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { PeerAvatar } from '@/components/common/PeerAvatar';
import { OutboxNotice } from '@/components/common/OutboxNotice';
import { PlusComingSoonModal } from '@/components/modals/PlusComingSoonModal';
import { PeerDetailSheet } from '@/components/modals/PeerDetailSheet';
import { RoomDetailSheet } from '@/components/modals/RoomDetailSheet';
import { MediaAttachmentSheet } from '@/components/modals/MediaAttachmentSheet';
import { FullscreenMediaModal } from '@/components/modals/FullscreenMediaModal';
import { openFileWithNativeIntent } from '@/transport/NativeRadioTransport';
import { PTTVoiceButton } from '@/components/chat/PTTVoiceButton';
import { AudioPlayer } from '@/utils/audioPlayer';

export default function ChatRoomScreen() {
  const theme = useOrbitorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const rawId = params.id || 'peer_aarav';
  const peerId = normalizePeerId(rawId);
  const targetShortId = rawId.slice(-6).toLowerCase();

  const {
    peers,
    savedPeers,
    messages,
    sendMessage,
    sendVoiceNote,
    sendMediaTransfer,
    acceptMediaTransfer,
    declineMediaTransfer,
    cancelMediaTransfer,
    retryMediaTransfer,
    eventRooms,
    outboxItems,
    unpairPeer,
    deleteConversation,
    deleteEventRoom,
    typingMap,
    sendTypingStatus,
    markChatAsRead,
    setActiveChatPeerId,
  } = useOrbitor();

  // Detect whether this is a group room or 1-to-1 companion chat
  const rawCleanCode = rawId.replace('room_', '').toUpperCase();
  const foundRoom = eventRooms.find(
    (r) => r.id === rawId || r.code === rawId || r.code === rawCleanCode || r.id === `room_${rawCleanCode}`
  );
  const isRoom = Boolean(foundRoom || rawId.startsWith('room_'));
  const room: EventRoom | null = foundRoom || (isRoom ? {
    id: rawId.startsWith('room_') ? rawId : `room_${rawCleanCode}`,
    name: params.name || `Mesh Room ${rawCleanCode}`,
    code: rawCleanCode,
    category: 'campus',
    memberCount: 2,
    isActive: true,
    description: 'Offline LAN & Mesh Channel',
  } : null);

  const [inputText, setInputText] = useState('');
  const [plusVisible, setPlusVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [roomSheetVisible, setRoomSheetVisible] = useState(false);
  const [mediaSheetVisible, setMediaSheetVisible] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<{
    uri: string;
    senderName?: string;
    timestamp?: number;
  } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register active chat peer/room so notifications are suppressed while looking at this chat
  const activeConversationKey = isRoom ? (room?.id || rawId) : peerId;
  useEffect(() => {
    setActiveChatPeerId(activeConversationKey);
    return () => {
      setActiveChatPeerId(null);
      AudioPlayer.stop();
    };
  }, [activeConversationKey, setActiveChatPeerId]);

  // Find peer either in live radio peers or in saved peers (only relevant for 1-to-1 chats)
  const livePeer = isRoom ? undefined : peers.find(
    (p) => p.id === peerId || p.id.toLowerCase().endsWith(targetShortId)
  );
  const savedPeer = isRoom ? undefined : savedPeers.find(
    (p) => p.id === peerId || p.id.toLowerCase().endsWith(targetShortId)
  );
  const peer = livePeer || savedPeer;

  const isOnline = Boolean(
    isRoom || (livePeer && livePeer.distanceBracket !== 'out_of_range')
  );
  const isPeerTyping = Boolean(
    !isRoom && (typingMap[peerId] || typingMap[rawId] || typingMap[`peer_${targetShortId}`])
  );

  const displayName = isRoom
    ? room?.name || params.name || `Mesh Room ${rawCleanCode}`
    : params.name || peer?.name || `Radii·${targetShortId}`;

  const peerMessages = isRoom
    ? (messages[room?.id || rawId] || messages[rawCleanCode] || [])
    : (messages[peerId] || messages[rawId] || messages[`peer_${targetShortId}`] || []);
  const peerOutbox = outboxItems.filter((i) => i.recipientId === peerId || i.recipientId === rawId);

  // Auto-mark incoming messages as read when opening chat and when new messages arrive
  useEffect(() => {
    markChatAsRead(peerId);
  }, [peerId, peerMessages.length, markChatAsRead]);

  // WhatsApp-like robust keyboard appearance handling with exact pixel elevation
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 50);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Scroll to bottom when message thread changes
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, [peerMessages.length]);

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (!isRoom) {
      if (text.trim().length > 0) {
        sendTypingStatus(peerId, true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          sendTypingStatus(peerId, false);
        }, 2500);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        sendTypingStatus(peerId, false);
      }
    }
  };

  const handleInputBlur = () => {
    if (!isRoom) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      sendTypingStatus(peerId, false);
    }
  };

  const targetId = isRoom ? (room?.id || rawId) : peerId;

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (!isRoom) sendTypingStatus(peerId, false);

    await sendMessage(targetId, text);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  const handleVoiceSend = async (
    durationSec: number,
    audioUri?: string,
    audioBase64?: string
  ) => {
    await sendMediaTransfer(targetId, 'voice', audioUri || '', audioBase64, durationSec);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  const handleMediaSend = async (
    uri: string,
    base64?: string,
    mimeType?: string,
    fileName?: string,
    mediaType?: 'image' | 'voice' | 'file'
  ) => {
    await sendMediaTransfer(targetId, mediaType || 'image', uri, base64, undefined, fileName, mimeType);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  const displayPeer: Peer = (peer as Peer) || {
    id: peerId,
    name: displayName,
    platform: 'android',
    activeTransport: livePeer?.activeTransport || 'nearby',
    availableTransports: ['nearby', 'ble'],
    rssi: isOnline ? (livePeer?.rssi ?? -70) : -99,
    distanceBracket: isOnline ? (livePeer?.distanceBracket || 'near') : 'out_of_range',
    lastSeen: Date.now(),
    isPaired: true,
    avatarSeed: peerId,
    deviceName: livePeer?.deviceName || 'Radio Companion',
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('ROOM_KICKED_OUT', (data) => {
      if (
        isRoom &&
        (data.roomId === peerId ||
          data.roomCode === room?.code ||
          data.roomId === room?.id ||
          data.roomId === rawId)
      ) {
        Alert.alert('Room Closed', data.reason || 'This room has been closed.', [
          {
            text: 'OK',
            onPress: () => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            },
          },
        ]);
      }
    });
    return () => sub.remove();
  }, [isRoom, peerId, room?.code, room?.id, rawId]);

  const roomMemberCount = room?.memberCount || (room?.members?.length || 1);

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.chatWrapper,
          {
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + (Platform.OS === 'android' ? insets.bottom + 4 : 0)
                : Math.max(insets.bottom, Spacing.sm),
          },
        ]}>
        {/* Header Bar */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.surface,
            },
          ]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}>
            <Text style={[styles.backArrow, { color: theme.accentCyan }]}>‹</Text>
          </Pressable>

          {isRoom ? (
            <View
              style={[
                styles.roomAvatarCircle,
                { backgroundColor: theme.surfaceElevated },
              ]}>
              <Ionicons name="people" size={20} color={theme.accentCyan} />
            </View>
          ) : (
            <PeerAvatar peer={peer} name={displayName} size={38} showSignal={isOnline} />
          )}

          <View style={styles.headerInfo}>
            <Text numberOfLines={1} style={[styles.headerName, { color: theme.text }]}>
              {displayName}
            </Text>

            {/* Dynamic Status / Room member count */}
            {isRoom ? (
              <View style={styles.headerMetaRow}>
                <Text style={[styles.headerSignal, { color: theme.accentCyan }]}>
                  {roomMemberCount} members · Code: {room?.code}
                </Text>
              </View>
            ) : isPeerTyping ? (
              <View style={styles.typingHeaderRow}>
                <Text style={[styles.typingHeaderText, { color: theme.success }]}>
                  typing...
                </Text>
              </View>
            ) : (
              <View style={styles.headerMetaRow}>
                <Text
                  style={[
                    styles.headerSignal,
                    { color: isOnline ? theme.textSecondary : theme.textTertiary },
                  ]}>
                  {isOnline
                    ? livePeer?.rssi
                      ? `${livePeer.rssi} dBm · Direct Link`
                      : 'Online · Direct Radio Link'
                    : 'Offline · Out of range'}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => (isRoom ? setRoomSheetVisible(true) : setProfileVisible(true))}
            hitSlop={12}
            style={({ pressed }) => [
              styles.menuButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}>
            <Text style={[styles.menuDots, { color: theme.textSecondary }]}>⋮</Text>
          </Pressable>
        </View>

        {/* Queued Outbox Notice */}
        {!isRoom && (
          <OutboxNotice
            items={peerOutbox}
            onPressDeliverWithPlus={() => setPlusVisible(true)}
          />
        )}

        {/* Message Thread */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: Spacing.sm },
          ]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}>
          {/* Radio Encryption Notice */}
          <View style={styles.encryptionNotice}>
            <Text style={[styles.encryptionText, { color: theme.textTertiary }]}>
              {isRoom
                ? `● MESH ROOM // ${room?.code || 'OFFLINE'} // ZERO INTERNET DIRECT BROADCAST ●`
                : '● DIRECT RADIO PACKET CHANNEL // ZERO INTERNET USAGE ●'}
            </Text>
          </View>

          {peerMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              showSenderName={isRoom}
              onAcceptTransfer={(transferId) =>
                acceptMediaTransfer(activeConversationKey, transferId)
              }
              onDeclineTransfer={(transferId) =>
                declineMediaTransfer(activeConversationKey, transferId)
              }
              onCancelTransfer={(transferId) =>
                cancelMediaTransfer(activeConversationKey, transferId)
              }
              onRetryTransfer={(transferId) =>
                retryMediaTransfer(activeConversationKey, transferId)
              }
              onPressImage={(imageUri, senderName, timestamp) =>
                setFullscreenImage({ uri: imageUri, senderName, timestamp })
              }
              onOpenFile={async (fileUri, mimeType) => {
                if (!fileUri) {
                  Alert.alert('File Unavailable', 'This file has not completed downloading to your device.');
                  return;
                }
                const opened = await openFileWithNativeIntent(fileUri, mimeType);
                if (!opened) {
                  Alert.alert(
                    'No App Available',
                    'Could not find a compatible app on your phone to open this file format.'
                  );
                }
              }}
            />
          ))}

          {/* Peer Typing Indicator Bubble */}
          {!isRoom && isPeerTyping && (
            <View
              style={[
                styles.typingBubble,
                {
                  backgroundColor: theme.surface,
                },
              ]}>
              <View style={[styles.typingDot, { backgroundColor: theme.success }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.success, opacity: 0.6 }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.success, opacity: 0.3 }]} />
              <Text style={[styles.typingBubbleText, { color: theme.textSecondary }]}>
                {displayName} is typing...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Input Composer Bar (WhatsApp style, elevated above keyboard) */}
        <View
          style={[
            styles.composerBar,
            {
              backgroundColor: theme.surface,
            },
          ]}>
          {/* Media Attachment Action (+ button) */}
          <Pressable
            onPress={() => setMediaSheetVisible(true)}
            hitSlop={8}
            accessibilityLabel="Send photo or media"
            style={({ pressed }) => [
              styles.attachButton,
              {
                backgroundColor: theme.surfaceElevated,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Ionicons name="add" size={22} color={theme.text} />
          </Pressable>

          <TextInput
            value={inputText}
            onChangeText={handleTextChange}
            onBlur={handleInputBlur}
            placeholder={
              isRoom
                ? `Message ${room?.name || 'group'}...`
                : isOnline
                ? 'Type mesh radio message...'
                : 'Peer offline (will queue)...'
            }
            placeholderTextColor={theme.textTertiary}
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surfaceElevated,
                color: theme.text,
              },
            ]}
          />

          {/* WhatsApp-style dynamic toggle: Send button when text typed, 10s PTT mic when empty */}
          {inputText.trim().length > 0 ? (
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: theme.accentCyan,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Ionicons name="arrow-up" size={20} color={theme.background} />
            </Pressable>
          ) : (
            <PTTVoiceButton
              onSendVoice={handleVoiceSend}
              disabled={!isRoom && !isOnline}
            />
          )}
        </View>
      </View>

      {/* Media Attachment Picker Sheet */}
      <MediaAttachmentSheet
        visible={mediaSheetVisible}
        onClose={() => setMediaSheetVisible(false)}
        onSendMedia={handleMediaSend}
      />

      {/* Room Details & Members Sheet (WhatsApp group style) */}
      <RoomDetailSheet
        room={room || null}
        visible={roomSheetVisible}
        peers={peers}
        onClose={() => setRoomSheetVisible(false)}
        onLeaveRoom={() => {
          if (room) {
            deleteEventRoom(room.id);
          }
          router.back();
        }}
      />

      {/* Companion Profile & Disconnect Sheet (1-on-1 chats) */}
      <PeerDetailSheet
        peer={displayPeer}
        visible={profileVisible}
        isInsideChat={true}
        onClose={() => setProfileVisible(false)}
        onDisconnect={() => router.back()}
      />

      {/* Cloud Reach Preview Modal */}
      <PlusComingSoonModal
        visible={plusVisible}
        onClose={() => setPlusVisible(false)}
      />

      {/* WhatsApp style Fullscreen Photo Preview Modal */}
      <FullscreenMediaModal
        visible={Boolean(fullscreenImage)}
        imageUri={fullscreenImage?.uri || null}
        senderName={fullscreenImage?.senderName}
        timestamp={fullscreenImage?.timestamp}
        onClose={() => setFullscreenImage(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  chatWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0,
    ...Shadows.subtle,
    gap: Spacing.sm + 2,
  },
  backButton: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 28,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSignal: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
  },
  typingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingHeaderText: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
    fontStyle: 'italic',
  },
  menuButton: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDots: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingTop: Spacing.sm,
    gap: 4,
  },
  encryptionNotice: {
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  encryptionText: {
    fontSize: 9,
    fontFamily: Typography.monoFamily,
    letterSpacing: 0.5,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 0,
    ...Shadows.subtle,
    gap: 6,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  typingBubbleText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontStyle: 'italic',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs + 4,
    borderTopWidth: 0,
    ...Shadows.subtle,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.xs + 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 0,
    fontSize: Typography.sizes.base - 1,
    fontFamily: Typography.fontFamily,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    fontSize: 20,
    fontWeight: '800',
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
