import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOrbitorTheme, Typography, Radius, Spacing, Layout } from '@/theme';
import { useOrbitor } from '@/context/OrbitorContext';
import { PeerAvatar } from '@/components/common/PeerAvatar';
import { Badge } from '@/components/common/Badge';
import { OutboxNotice } from '@/components/common/OutboxNotice';
import { QRMeshModal } from '@/components/modals/QRMeshModal';

import { GestureDetector } from 'react-native-gesture-handler';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

export default function ChatsScreen() {
  const theme = useOrbitorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    myProfile,
    peers,
    messages,
    eventRooms,
    outboxItems,
    joinEventRoom,
  } = useOrbitor();

  const [qrVisible, setQrVisible] = useState(false);

  const handleOpenConversation = (id: string, name: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id, name },
    });
  };

  const hasAnyChat = eventRooms.length > 0 || peers.length > 0;

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
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]}>Chats</Text>

          <Pressable
            onPress={() => setQrVisible(true)}
            style={({ pressed }) => [
              styles.qrButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text style={[styles.qrButtonText, { color: theme.text }]}>+ Join Room</Text>
          </Pressable>
        </View>

        {/* Zero-leak Outbox Notice */}
        <OutboxNotice items={outboxItems} />

        {!hasAnyChat ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No active conversations yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Discovered peers on the Radar or campus event rooms will appear here. No internet required.
            </Text>

            <Pressable
              onPress={() => setQrVisible(true)}
              style={({ pressed }) => [
                styles.emptyActionButton,
                {
                  backgroundColor: theme.text,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text style={[styles.emptyActionText, { color: theme.background }]}>
                Join Event Room via Code
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {eventRooms.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
                  CAMPUS & EVENT ROOMS
                </Text>
                <View style={styles.roomsList}>
                  {eventRooms.map((room) => (
                    <Pressable
                      key={room.id}
                      onPress={() => handleOpenConversation(room.id, room.name)}
                      style={({ pressed }) => [
                        styles.roomCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}>
                      <View style={styles.roomInfo}>
                        <View style={styles.roomTitleRow}>
                          <Text style={[styles.roomName, { color: theme.text }]}>
                            {room.name}
                          </Text>
                          <Badge label={room.code} variant="cyan" size="sm" />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[styles.roomDescription, { color: theme.textSecondary }]}>
                          {room.description}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {peers.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
                  DIRECT PEERS
                </Text>
                <View style={styles.peersList}>
                  {peers.map((peer) => {
                    const peerMessages = messages[peer.id] || [];
                    const lastMsg = peerMessages[peerMessages.length - 1];

                    return (
                      <Pressable
                        key={peer.id}
                        onPress={() => handleOpenConversation(peer.id, peer.name)}
                        style={({ pressed }) => [
                          styles.peerItem,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}>
                        <PeerAvatar peer={peer} size={42} showSignal={true} />
                        <View style={styles.peerChatInfo}>
                          <View style={styles.chatHeaderRow}>
                            <Text style={[styles.peerName, { color: theme.text }]}>
                              {peer.name}
                            </Text>
                            <Badge
                              label={peer.activeTransport}
                              transport={peer.activeTransport}
                              size="sm"
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            style={[styles.lastMessageText, { color: theme.textSecondary }]}>
                            {lastMsg
                              ? `${lastMsg.isMe ? 'You: ' : ''}${lastMsg.text}`
                              : 'Tap to start direct radio chat'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* QR Code & Room Code Modal */}
      <QRMeshModal
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        myProfileName={myProfile.displayName}
        onJoinCode={joinEventRoom}
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
  qrButton: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  qrButtonText: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    gap: Spacing.xs + 2,
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
  emptyActionButton: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  emptyActionText: {
    fontSize: Typography.sizes.xs + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  section: {
    gap: Spacing.xs + 2,
  },
  sectionHeading: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  roomsList: {
    gap: Spacing.xs + 2,
  },
  roomCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
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
  peersList: {
    gap: Spacing.xs + 2,
  },
  peerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  peerChatInfo: {
    flex: 1,
    gap: 2,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  peerName: {
    fontSize: Typography.sizes.sm + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  lastMessageText: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
  },
});
