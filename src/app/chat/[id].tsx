import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useOrbitorTheme, Typography, Radius, Spacing, Layout } from '@/theme';
import { useOrbitor } from '@/context/OrbitorContext';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { PTTVoiceButton } from '@/components/chat/PTTVoiceButton';
import { PeerAvatar } from '@/components/common/PeerAvatar';
import { Badge } from '@/components/common/Badge';
import { OutboxNotice } from '@/components/common/OutboxNotice';
import { PlusComingSoonModal } from '@/components/modals/PlusComingSoonModal';

export default function ChatRoomScreen() {
  const theme = useOrbitorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const peerId = params.id || 'peer_aarav';

  const { peers, messages, sendMessage, sendVoiceNote, outboxItems } = useOrbitor();
  const [inputText, setInputText] = useState('');
  const [plusVisible, setPlusVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const activePeer = peers.find((p) => p.id === peerId);
  const peerName = params.name || activePeer?.name || 'Nearby Peer';
  const peerMessages = messages[peerId] || [];

  const peerOutbox = outboxItems.filter((i) => i.recipientId === peerId);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [peerMessages.length]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(peerId, text);
  };

  const handleSendVoice = async (durationSec: number) => {
    await sendVoiceNote(peerId, durationSec);
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header Bar */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}>
            <Text style={[styles.backArrow, { color: theme.accentCyan }]}>‹</Text>
          </Pressable>

          <PeerAvatar peer={activePeer} name={peerName} size={36} showSignal={true} />

          <View style={styles.headerInfo}>
            <Text numberOfLines={1} style={[styles.headerName, { color: theme.text }]}>
              {peerName}
            </Text>
            <View style={styles.headerMetaRow}>
              <Badge
                label={activePeer?.activeTransport || 'nearby'}
                transport={activePeer?.activeTransport || 'nearby'}
                size="sm"
              />
              <Text style={[styles.headerSignal, { color: theme.textTertiary }]}>
                {activePeer ? `${activePeer.rssi} dBm · Direct Link` : 'Mesh Relay'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setPlusVisible(true)}
            style={({ pressed }) => [
              styles.plusInfoButton,
              {
                backgroundColor: theme.plusMuted,
                borderColor: theme.plus,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text style={[styles.plusInfoText, { color: theme.plus }]}>Plus</Text>
          </Pressable>
        </View>

        {/* Queued Outbox Notice */}
        <OutboxNotice
          items={peerOutbox}
          onPressDeliverWithPlus={() => setPlusVisible(true)}
        />

        {/* Message Thread */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: Spacing.md },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Radio Encryption Notice */}
          <View style={styles.encryptionNotice}>
            <Text style={[styles.encryptionText, { color: theme.textTertiary }]}>
              ● DIRECT RADIO PACKET CHANNEL // ZERO INTERNET USAGE ●
            </Text>
          </View>

          {peerMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </ScrollView>

        {/* Quick Radio Chips */}
        <View style={styles.quickChipsRow}>
          <Pressable
            onPress={() => sendMessage(peerId, '📍 Radio Ping: Signal strength verified.')}
            style={({ pressed }) => [
              styles.quickChip,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.quickChipText, { color: theme.accentCyan }]}>
              Send Radio Ping 📡
            </Text>
          </Pressable>

          <Pressable
            onPress={() => sendMessage(peerId, 'Ready to fling files over Wi-Fi Direct.')}
            style={({ pressed }) => [
              styles.quickChip,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.quickChipText, { color: theme.textSecondary }]}>
              Request File Fling 📦
            </Text>
          </Pressable>
        </View>

        {/* Bottom Input Composer Bar */}
        <View
          style={[
            styles.composerBar,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          <PTTVoiceButton onSendVoice={handleSendVoice} />

          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type mesh radio message..."
            placeholderTextColor={theme.textTertiary}
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: inputText.trim() ? theme.accentCyan : theme.surfaceElevated,
                opacity: pressed || !inputText.trim() ? 0.6 : 1,
              },
            ]}>
            <Text
              style={[
                styles.sendIcon,
                { color: inputText.trim() ? theme.background : theme.textTertiary },
              ]}>
              ↑
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Cloud Reach Preview Modal */}
      <PlusComingSoonModal
        visible={plusVisible}
        onClose={() => setPlusVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
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
  plusInfoButton: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  plusInfoText: {
    fontSize: Typography.sizes.xs - 1,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.monoFamily,
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
  quickChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs + 2,
  },
  quickChip: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.xs + 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
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
});
