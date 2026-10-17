import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Badge } from '../common/Badge';

interface RadioPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const RadioPermissionModal: React.FC<RadioPermissionModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const theme = useOrbitorTheme();

  const permissions = [
    {
      title: 'Bluetooth',
      desc: 'Low-energy beacon advertising & discovery of nearby peers',
      tag: 'CONTROL',
    },
    {
      title: 'Wi-Fi & Wi-Fi Direct',
      desc: 'High-speed device-to-device direct payload transmission without internet',
      tag: 'TRANSPORT',
    },
    {
      title: 'Nearby Devices & Location',
      desc: 'Android OS requirement for discovering local hardware radios',
      tag: 'SYSTEM',
    },
  ];

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
            <Text style={[styles.title, { color: theme.text }]}>
              Enable Offline Radios
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              To connect directly phone-to-phone without internet, Orbitor uses your device antennas.
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
              onPress={() => {
                onConfirm();
                onClose();
              }}
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: theme.text,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text style={[styles.confirmText, { color: theme.background }]}>
                Enable & Connect
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
