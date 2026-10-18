import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Badge } from '../common/Badge';

interface ShareApkModalProps {
  visible: boolean;
  onClose: () => void;
  onStartApkFling: () => void;
}

export const ShareApkModal: React.FC<ShareApkModalProps> = ({
  visible,
  onClose,
  onStartApkFling,
}) => {
  const theme = useOrbitorTheme();
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSendApk = () => {
    setIsSending(true);
    setProgress(15);
    onStartApkFling();

    const intv = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(intv);
          setTimeout(() => {
            setIsSending(false);
            setProgress(0);
            onClose();
          }, 800);
          return 100;
        }
        return p + 25;
      });
    }, 400);
  };

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
            <View style={[styles.iconBadge, { backgroundColor: theme.accentCyanMuted }]}>
              <Text style={styles.icon}>📦</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Share Radii APK Offline</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Send the full Radii Android APK directly to friends via Nearby/Bluetooth. No internet, Play Store, or data required.
            </Text>
          </View>

          <View style={[styles.infoBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Package</Text>
              <Text style={[styles.infoVal, { color: theme.text }]}>radii-app-release.apk</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Size</Text>
              <Text style={[styles.infoVal, { color: theme.text }]}>18.4 MB</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Transfer Radio</Text>
              <Badge label="Wi-Fi Direct / BLE" transport="nearby" size="sm" />
            </View>
          </View>

          {isSending ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: theme.accentCyan }]}>
                  Flinging APK over Wi-Fi Direct...
                </Text>
                <Text style={[styles.progressPercent, { color: theme.text }]}>{progress}%</Text>
              </View>
              <View style={[styles.progressBarTrack, { backgroundColor: theme.surfaceElevated }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    { backgroundColor: theme.accentCyan, width: `${progress}%` },
                  ]}
                />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={handleSendApk}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: theme.accentCyan,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text style={[styles.sendButtonText, { color: theme.background }]}>
                Beam APK to Nearby Peer
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onClose}
            disabled={isSending}
            style={({ pressed }) => [
              styles.dismissButton,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
                opacity: pressed || isSending ? 0.5 : 1,
              },
            ]}>
            <Text style={[styles.dismissText, { color: theme.textSecondary }]}>Close</Text>
          </Pressable>
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
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.base,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
  },
  infoBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs + 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  infoVal: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.medium,
  },
  progressContainer: {
    gap: 8,
    paddingVertical: Spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
  },
  progressPercent: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.monoFamily,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  sendButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  dismissButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
});
