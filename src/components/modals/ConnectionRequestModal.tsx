import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { PeerAvatar } from '../common/PeerAvatar';
import { Badge } from '../common/Badge';

export interface IncomingConnectionRequest {
  id: string;
  peerId: string;
  peerName: string;
  peerDevice: string;
  verificationCode: string;
  transport: 'nearby' | 'ble' | 'lan';
}

interface ConnectionRequestModalProps {
  request: IncomingConnectionRequest | null;
  onAccept: (req: IncomingConnectionRequest) => void;
  onDecline: (req: IncomingConnectionRequest) => void;
}

export const ConnectionRequestModal: React.FC<ConnectionRequestModalProps> = ({
  request,
  onAccept,
  onDecline,
}) => {
  const theme = useOrbitorTheme();

  if (!request) return null;

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.accentCyan,
            },
          ]}>
          <View style={styles.header}>
            <Badge label="INCOMING CONNECTION" variant="cyan" size="sm" />
            <Text style={[styles.title, { color: theme.text }]}>
              Accept Direct Connection?
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              A nearby phone is requesting a secure offline radio link with your device.
            </Text>
          </View>

          <View
            style={[
              styles.peerCard,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
              },
            ]}>
            <PeerAvatar name={request.peerName} size={44} showSignal={true} />
            <View style={styles.peerDetails}>
              <Text style={[styles.peerName, { color: theme.text }]}>{request.peerName}</Text>
              <Text style={[styles.peerSub, { color: theme.textTertiary }]}>
                {request.peerDevice} · Direct {request.transport.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Verification Security PIN Code */}
          <View style={[styles.pinBox, { backgroundColor: theme.surfaceHighlight }]}>
            <Text style={[styles.pinLabel, { color: theme.textTertiary }]}>
              SECURITY VERIFICATION CODE
            </Text>
            <Text style={[styles.pinCode, { color: theme.accentCyan }]}>
              {request.verificationCode}
            </Text>
            <Text style={[styles.pinHint, { color: theme.textSecondary }]}>
              Verify that the same code appears on the other phone screen.
            </Text>
          </View>

          {/* Two-Way Accept or Decline Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => onDecline(request)}
              style={({ pressed }) => [
                styles.declineButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Text style={[styles.declineText, { color: theme.danger }]}>Decline</Text>
            </Pressable>

            <Pressable
              onPress={() => onAccept(request)}
              style={({ pressed }) => [
                styles.acceptButton,
                {
                  backgroundColor: theme.text,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text style={[styles.acceptText, { color: theme.background }]}>
                Accept
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
  },
  peerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  peerDetails: {
    flex: 1,
    gap: 2,
  },
  peerName: {
    fontSize: Typography.sizes.sm + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  peerSub: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
  },
  pinBox: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  pinLabel: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  pinCode: {
    fontSize: Typography.sizes.display - 4,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
    letterSpacing: 4,
  },
  pinHint: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  declineButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  acceptButton: {
    flex: 2,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
});
