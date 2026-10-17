import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Peer } from '../../core/types';
import { PeerAvatar } from '../common/PeerAvatar';
import { Badge } from '../common/Badge';

interface PeerDetailSheetProps {
  peer: Peer | null;
  visible: boolean;
  onClose: () => void;
  onConnect: (peer: Peer) => void;
}

export const PeerDetailSheet: React.FC<PeerDetailSheetProps> = ({
  peer,
  visible,
  onClose,
  onConnect,
}) => {
  const theme = useOrbitorTheme();

  if (!peer) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          <View style={styles.header}>
            <PeerAvatar peer={peer} size={56} showSignal={true} />
            <Text style={[styles.name, { color: theme.text }]}>{peer.name}</Text>
            <Text style={[styles.deviceModel, { color: theme.textSecondary }]}>
              {peer.deviceName || peer.platform.toUpperCase()}
            </Text>
          </View>

          <View style={[styles.specsBox, { backgroundColor: theme.surfaceElevated }]}>
            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Radio Signal</Text>
              <Text style={[styles.specValue, { color: theme.text }]}>{peer.rssi} dBm</Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Estimated Distance</Text>
              <Text style={[styles.specValue, { color: theme.text }]}>
                {peer.distanceBracket.toUpperCase()} (~
                {peer.distanceBracket === 'immediate'
                  ? '1-3m'
                  : peer.distanceBracket === 'near'
                  ? '4-12m'
                  : '15-30m'}
                )
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Direct Link</Text>
              <Badge label={peer.activeTransport} transport={peer.activeTransport} size="sm" />
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Pairing Status</Text>
              <Text style={[styles.specValue, { color: peer.isPaired ? theme.success : theme.warning }]}>
                {peer.isPaired ? 'Paired & Verified' : 'Not Connected'}
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.dismissButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Text style={[styles.dismissText, { color: theme.textSecondary }]}>Close</Text>
            </Pressable>

            {!peer.isPaired && (
              <Pressable
                onPress={() => {
                  onClose();
                  onConnect(peer);
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
    borderTopWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
    marginTop: 4,
  },
  deviceModel: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
  },
  specsBox: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
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
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
});
