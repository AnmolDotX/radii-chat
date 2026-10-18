import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform, PermissionsAndroid, ActivityIndicator, Linking } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Badge } from '../common/Badge';

import { requestRadioAndNearbyPermissions, checkRadioPermissions } from '../../utils/permissions';

interface RadioPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  visibilityMode?: 'everyone' | 'contacts' | 'hidden';
}

export const RadioPermissionModal: React.FC<RadioPermissionModalProps> = ({
  visible,
  onClose,
  onConfirm,
  visibilityMode = 'everyone',
}) => {
  const theme = useOrbitorTheme();
  const [isRequesting, setIsRequesting] = useState(false);
  const [isAlreadyGranted, setIsAlreadyGranted] = useState(false);

  useEffect(() => {
    if (visible) {
      checkRadioPermissions().then((granted) => {
        setIsAlreadyGranted(granted);
      });
    }
  }, [visible]);

  const permissions = [
    {
      title: 'Bluetooth & BLE Discovery',
      desc: 'Required by Android to advertise beacon signals and locate nearby companions without cell towers.',
      tag: 'HARDWARE · ANTENNA',
    },
    {
      title: 'Nearby Wi-Fi Direct',
      desc: 'Connects directly antenna-to-antenna for instant messages and file transfers without internet.',
      tag: 'TRANSPORT · DIRECT',
    },
    {
      title: 'Nearby Radar Visibility',
      desc: `Your device will broadcast as "${visibilityMode === 'everyone' ? 'Everyone Nearby' : 'Contacts Only'}" to allow nearby peers to discover you.`,
      tag: 'RADAR · VISIBILITY',
    },
  ];

  const handleRequestAndConnect = () => {
    setIsRequesting(true);
    // Dismiss the modal first so Android Activity gets full focus for the system permission prompt
    onClose();
    setTimeout(async () => {
      try {
        await requestRadioAndNearbyPermissions();
      } catch (err) {
        console.warn('Permission error:', err);
      } finally {
        setIsRequesting(false);
        onConfirm();
      }
    }, 150);
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
            <View style={styles.headerTopBadge}>
              <Badge
                label={isAlreadyGranted ? 'ALL RADIOS ACTIVE' : 'PERMISSIONS REQUIRED'}
                variant={isAlreadyGranted ? 'green' : 'cyan'}
                size="sm"
              />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {isAlreadyGranted ? 'Radios & Hardware Active' : 'Enable Offline Radios & Connect'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {isAlreadyGranted
                ? 'Your device Bluetooth, Nearby, and Location hardware radios are authorized and actively scanning.'
                : "Radii uses your phone's hardware antennas directly. Zero internet, cell reception, or cloud tracking required."}
            </Text>
          </View>

          <View style={styles.list}>
            {permissions.map((p) => (
              <View
                key={p.title}
                style={[
                  styles.item,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{p.title}</Text>
                  <Badge label={p.tag} variant="cyan" size="sm" />
                </View>
                <Text style={[styles.itemDesc, { color: theme.textSecondary }]}>{p.desc}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={onClose}
              disabled={isRequesting}
              style={({ pressed }) => [
                styles.cancelButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  opacity: pressed || isRequesting ? 0.75 : 1,
                },
              ]}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleRequestAndConnect}
              disabled={isRequesting}
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: theme.text,
                  opacity: pressed || isRequesting ? 0.85 : 1,
                },
              ]}>
              {isRequesting ? (
                <ActivityIndicator size="small" color={theme.background} />
              ) : (
                <Text style={[styles.confirmText, { color: theme.background }]}>
                  Grant & Connect
                </Text>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    gap: 4,
  },
  headerTopBadge: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  subtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
  },
  list: {
    gap: Spacing.xs + 2,
  },
  item: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm + 2,
    gap: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: Typography.sizes.xs + 2,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  itemDesc: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
  confirmButton: {
    flex: 2,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
});
