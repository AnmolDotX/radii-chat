import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Peer } from '../../core/types';
import { PeerAvatar } from '../common/PeerAvatar';
import { Badge } from '../common/Badge';

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
  const [status, setStatus] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (visible) {
      setStatus('idle');
    }
  }, [visible]);

  if (!peer) return null;

  const handleConnect = () => {
    setStatus('pairing');

    // Simulate direct radio handshake
    setTimeout(() => {
      setStatus('success');
      setTimeout(() => {
        onSuccess(peer);
        onClose();
      }, 1000);
    }, 1800);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: status === 'success' ? theme.success : theme.border,
            },
          ]}>
          <View style={styles.header}>
            <PeerAvatar peer={peer} size={52} showSignal={true} />
            <Text style={[styles.title, { color: theme.text }]}>
              {status === 'success' ? 'Connected Successfully!' : `Connect with ${peer.name}?`}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {peer.deviceName || peer.platform.toUpperCase()} · Direct {peer.activeTransport.toUpperCase()}
            </Text>
          </View>

          {status === 'idle' && (
            <View style={styles.buttonRow}>
              <Pressable
                onPress={onClose}
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
                onPress={handleConnect}
                style={({ pressed }) => [
                  styles.connectButton,
                  {
                    backgroundColor: theme.text,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text style={[styles.connectText, { color: theme.background }]}>
                  Connect
                </Text>
              </Pressable>
            </View>
          )}

          {status === 'pairing' && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color={theme.accentCyan} />
              <Text style={[styles.pairingText, { color: theme.textSecondary }]}>
                Exchanging security tokens with {peer.name}...
              </Text>
            </View>
          )}

          {status === 'success' && (
            <View style={styles.loaderContainer}>
              <Badge label="MUTUAL ACCEPTANCE VERIFIED" variant="green" size="md" />
              <Text style={[styles.successSubtext, { color: theme.textSecondary }]}>
                Channel ready. Moving to Discovered list.
              </Text>
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
    fontSize: Typography.sizes.md + 1,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
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
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  pairingText: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
  },
  successSubtext: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
});
