import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Peer } from '../../core/types';
import { PeerAvatar } from '../common/PeerAvatar';
import { Badge } from '../common/Badge';
import { useOrbitor } from '../../context/OrbitorContext';

interface ConnectPeerDialogProps {
  peer: Peer | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: (peer: Peer) => void;
}

export const ConnectPeerDialog: React.FC<ConnectPeerDialogProps> = ({
  peer,
  visible,
  onClose,
  onSuccess,
}) => {
  const theme = useOrbitorTheme();
  const {
    requestConnection,
    connectionStateMap,
    verificationCodeMap,
    cancelConnectionRequest,
  } = useOrbitor();

  const peerId = peer?.id || '';
  const shortId = (peer?.shortId || peerId.slice(-6)).toLowerCase();
  const canonicalId = `peer_${shortId}`;
  const currentStatus =
    connectionStateMap[canonicalId] ||
    connectionStateMap[peerId] ||
    connectionStateMap[`ble_${shortId}`] ||
    'idle';
  const verificationCode =
    verificationCodeMap[canonicalId] ||
    verificationCodeMap[peerId] ||
    verificationCodeMap[`ble_${shortId}`] ||
    '----';

  useEffect(() => {
    if (currentStatus === 'accepted' && peer) {
      const timer = setTimeout(() => {
        onSuccess(peer);
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentStatus, peer, onSuccess, onClose]);

  if (!peer) return null;

  const handleSendRequest = () => {
    requestConnection(peer);
  };

  const handleCancel = () => {
    cancelConnectionRequest(peerId);
    cancelConnectionRequest(canonicalId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor:
                currentStatus === 'accepted'
                  ? theme.success
                  : currentStatus === 'waiting'
                  ? theme.accentCyan
                  : theme.border,
            },
          ]}>
          <View style={styles.header}>
            <PeerAvatar peer={peer} size={54} showSignal={true} />
            <Text style={[styles.title, { color: theme.text }]}>
              {currentStatus === 'accepted'
                ? 'Connected Successfully!'
                : currentStatus === 'waiting'
                ? 'Waiting for Acceptance...'
                : currentStatus === 'declined'
                ? 'Connection Declined'
                : `Connect with ${peer.name}?`}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {peer.deviceName || peer.platform.toUpperCase()} · Direct {peer.activeTransport.toUpperCase()}
            </Text>
          </View>

          {/* Idle State: Confirmation to Send Request */}
          {currentStatus === 'idle' && (
            <View style={styles.contentWrap}>
              <Text style={[styles.bodyDescription, { color: theme.textSecondary }]}>
                A mutual pairing request will be sent to {peer.name}. Once accepted, you can securely chat and fling files offline.
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={handleCancel}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleSendRequest}
                  style={({ pressed }) => [
                    styles.connectButton,
                    {
                      backgroundColor: theme.text,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <Text style={[styles.connectText, { color: theme.background }]}>
                    Send Request
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Waiting State: Request Sent, Waiting for other user to tap Accept */}
          {currentStatus === 'waiting' && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={theme.accentCyan} />
              <Text style={[styles.pairingText, { color: theme.textSecondary }]}>
                Request sent to {peer.name}. Waiting for them to accept on their phone...
              </Text>

              {/* Matching Security Code */}
              <View style={[styles.pinBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[styles.pinLabel, { color: theme.textTertiary }]}>
                  SECURITY VERIFICATION PIN
                </Text>
                <Text style={[styles.pinCode, { color: theme.accentCyan }]}>
                  {verificationCode}
                </Text>
                <Text style={[styles.pinHint, { color: theme.textTertiary }]}>
                  This 4-digit code will appear on {peer.name}&apos;s screen.
                </Text>
              </View>

              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelWaitButton,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Text style={[styles.cancelWaitText, { color: theme.danger }]}>
                  Cancel Request
                </Text>
              </Pressable>
            </View>
          )}

          {/* Accepted State: Partner confirmed */}
          {currentStatus === 'accepted' && (
            <View style={styles.loaderContainer}>
              <Badge label="MUTUAL ACCEPTANCE VERIFIED" variant="green" size="md" />
              <Text style={[styles.successSubtext, { color: theme.textSecondary }]}>
                {peer.name} accepted your request. Added to Discovered Peers!
              </Text>
              <Pressable
                onPress={() => {
                  onSuccess(peer);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.openChatButton,
                  {
                    backgroundColor: theme.text,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text style={[styles.openChatText, { color: theme.background }]}>
                  Open Chat Now ↗
                </Text>
              </Pressable>
            </View>
          )}

          {/* Declined State */}
          {currentStatus === 'declined' && (
            <View style={styles.loaderContainer}>
              <Badge label="REQUEST DECLINED" variant="red" size="md" />
              <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
                {peer.name} declined the connection request.
              </Text>
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.cancelWaitButton,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Text style={[styles.cancelWaitText, { color: theme.text }]}>Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: Spacing.xl,
    gap: Spacing.base,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.monoFamily,
    textAlign: 'center',
  },
  contentWrap: {
    gap: Spacing.md,
  },
  bodyDescription: {
    fontSize: Typography.sizes.sm,
    lineHeight: 19,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  connectButton: {
    flex: 1.4,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  connectText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
  },
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  pairingText: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
  pinBox: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pinCode: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Typography.monoFamily,
    letterSpacing: 6,
  },
  pinHint: {
    fontSize: Typography.sizes.xs - 1,
    textAlign: 'center',
  },
  cancelWaitButton: {
    width: '100%',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  cancelWaitText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  successSubtext: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorSubtext: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  openChatButton: {
    width: '100%',
    paddingVertical: Spacing.sm + 3,
    alignItems: 'center',
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
  },
  openChatText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
  },
});
