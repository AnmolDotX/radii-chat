import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { Peer } from '../../core/types';
import { PeerAvatar } from '../common/PeerAvatar';
import { Badge } from '../common/Badge';
import { useOrbitor } from '../../context/OrbitorContext';

interface PeerDetailSheetProps {
  peer: Peer | null;
  visible: boolean;
  onClose: () => void;
  onConnect?: (peer: Peer) => void;
  isInsideChat?: boolean;
  onDisconnect?: () => void;
}

export const PeerDetailSheet: React.FC<PeerDetailSheetProps> = ({
  peer,
  visible,
  onClose,
  onConnect,
  isInsideChat = false,
  onDisconnect,
}) => {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unpairPeer, deleteConversation } = useOrbitor();

  if (!peer) return null;

  const handleDisconnect = () => {
    Alert.alert(
      'Unpair & Delete Chat',
      `Are you sure you want to unpair and remove all messages with ${peer.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair & Delete',
          style: 'destructive',
          onPress: () => {
            deleteConversation(peer.id);
            unpairPeer(peer.id);
            onClose();
            onDisconnect?.();
            if (isInsideChat) {
              router.back();
            }
          },
        },
      ]
    );
  };

  const handleChat = () => {
    onClose();
    router.push({
      pathname: '/chat/[id]',
      params: { id: peer.id, name: peer.name },
    });
  };

  const connectionLabel =
    peer.activeTransport === 'nearby'
      ? 'Wi-Fi Direct (Nearby)'
      : peer.activeTransport === 'ble'
      ? 'Bluetooth LE Mesh'
      : (peer.activeTransport || 'NEARBY').toUpperCase();

  // Android navigation bar clearance: native 3-button bar is 48dp, ensure large clearance so it never overlaps
  const sheetBottomPadding =
    (Platform.OS === 'android' ? Math.max(insets.bottom, 48) : Math.max(insets.bottom, 16)) +
    Spacing.base;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Tapping anywhere on the dimmed background closes the bottomsheet */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close bottom sheet"
          accessibilityRole="button"
        />

        {/* Bottom Sheet Card */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: sheetBottomPadding,
            },
          ]}>
          {/* Top Bar with Title and Close Cross Icon */}
          <View style={styles.topBar}>
            <View style={{ width: 36 }} />
            <Text style={[styles.sheetTitle, { color: theme.textTertiary }]}>
              COMPANION PROFILE
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.header}>
            <PeerAvatar peer={peer} size={64} showSignal={true} />
            <Text style={[styles.name, { color: theme.text }]}>{peer.name}</Text>
            <Text style={[styles.deviceModel, { color: theme.textSecondary }]}>
              {peer.deviceName || (peer.platform === 'android' ? 'Android Device' : peer.platform.toUpperCase())}
            </Text>
          </View>

          <View style={[styles.specsBox, { backgroundColor: theme.surfaceElevated }]}>
            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Radio Signal</Text>
              <Text
                style={[
                  styles.specValue,
                  { color: peer.rssi && peer.rssi > -95 ? theme.success : theme.text },
                ]}>
                {peer.rssi && peer.rssi > -99 ? `${peer.rssi} dBm` : 'Offline / Cached'}
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Device Model</Text>
              <Text style={[styles.specValue, { color: theme.text }]}>
                {peer.deviceName || (peer.platform === 'android' ? 'Android Phone' : 'Radio Device')}
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Connection Type</Text>
              <Badge label={connectionLabel} transport={peer.activeTransport || 'nearby'} size="sm" />
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Pairing Status</Text>
              <Text style={[styles.specValue, { color: peer.isPaired ? theme.success : theme.warning }]}>
                {peer.isPaired ? 'Paired Companion' : 'Not Connected'}
              </Text>
            </View>
          </View>

          {/* Bottom Action: Unpair/Disconnect or Connect */}
          <View style={styles.actionsRow}>
            {isInsideChat ? (
              <Pressable
                onPress={handleDisconnect}
                style={({ pressed }) => [
                  styles.fullDisconnectButton,
                  {
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Ionicons name="trash-outline" size={16} color={theme.danger} style={{ marginRight: 6 }} />
                <Text style={[styles.disconnectText, { color: theme.danger }]}>
                  Unpair & Delete Chat
                </Text>
              </Pressable>
            ) : peer.isPaired ? (
              <>
                <Pressable
                  onPress={handleDisconnect}
                  style={({ pressed }) => [
                    styles.disconnectButton,
                    {
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <Text style={[styles.disconnectText, { color: theme.danger }]}>Disconnect</Text>
                </Pressable>

                <Pressable
                  onPress={handleChat}
                  style={({ pressed }) => [
                    styles.connectButton,
                    {
                      backgroundColor: theme.text,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <Text style={[styles.connectText, { color: theme.background }]}>
                    Open Chat
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => {
                  onClose();
                  onConnect?.(peer);
                }}
                style={({ pressed }) => [
                  styles.connectButton,
                  {
                    backgroundColor: theme.text,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text style={[styles.connectText, { color: theme.background }]}>
                  Request Connect
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 0,
    ...Shadows.elevated,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    gap: Spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  sheetTitle: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  deviceModel: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
  },
  specsBox: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.subtle,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  specLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  specValue: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.medium,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  dismissButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.lg,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
  connectButton: {
    flex: 2,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.lg,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.subtle,
  },
  connectText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  disconnectButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.lg,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  fullDisconnectButton: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
