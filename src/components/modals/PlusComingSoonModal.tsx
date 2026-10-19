import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { Badge } from '../common/Badge';

interface PlusComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PlusComingSoonModal: React.FC<PlusComingSoonModalProps> = ({
  visible,
  onClose,
}) => {
  const theme = useOrbitorTheme();
  const [notified, setNotified] = useState(false);

  const perks = [
    {
      title: 'Radii Link Relay',
      desc: 'Deliver encrypted messages over the internet when friends walk out of radio range.',
      tag: 'CLOUD RELAY',
    },
    {
      title: 'Cloud Drop 2 GB',
      desc: 'Send large high-bandwidth files to a 7-day link without size limits.',
      tag: 'STORAGE',
    },
    {
      title: 'Encrypted Cloud Backup',
      desc: 'Secure keypair & chat backup with instant new-phone restore.',
      tag: 'SECURITY',
    },
    {
      title: 'Expanded Event Rooms (50 Peers)',
      desc: 'Higher concurrency for campus fests, student clubs, and large trek teams.',
      tag: 'SCALE',
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
            },
          ]}>
          <View style={styles.header}>
            <Badge label="COMING SOON // CLOUD LAYER" variant="purple" size="sm" />
            <Text style={[styles.title, { color: theme.text }]}>Radii Plus</Text>
            <Text style={[styles.priceTag, { color: theme.plus }]}>₹99 / month</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              All offline mesh radio features (BLE, Nearby, LAN, Voice, Files, SOS) remain 100% free forever. Plus adds the optional cloud layer when friends are far away.
            </Text>
          </View>

          <View style={styles.perksList}>
            {perks.map((p) => (
              <View
                key={p.title}
                style={[
                  styles.perkItem,
                  {
                    backgroundColor: theme.surfaceElevated,
                  },
                ]}>
                <View style={styles.perkHeader}>
                  <Text style={[styles.perkTitle, { color: theme.text }]}>{p.title}</Text>
                  <Badge label={p.tag} variant="purple" size="sm" />
                </View>
                <Text style={[styles.perkDesc, { color: theme.textSecondary }]}>{p.desc}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => setNotified(true)}
            style={({ pressed }) => [
              styles.notifyButton,
              {
                backgroundColor: notified ? theme.success : theme.plus,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <Text style={[styles.notifyText, { color: '#FFFFFF' }]}>
              {notified ? '✓ Added to Priority Waitlist' : 'Notify Me When Cloud Layer Launches'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.dismissButton,
              {
                backgroundColor: theme.surfaceElevated,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.dismissText, { color: theme.textSecondary }]}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 0,
    ...Shadows.elevated,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
    marginTop: 4,
  },
  priceTag: {
    fontSize: Typography.sizes.md,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
  },
  subtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.xs,
  },
  perksList: {
    gap: Spacing.xs + 2,
    marginVertical: Spacing.xs,
  },
  perkItem: {
    borderRadius: Radius.md,
    borderWidth: 0,
    ...Shadows.subtle,
    padding: Spacing.sm + 2,
    gap: 3,
  },
  perkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  perkTitle: {
    fontSize: Typography.sizes.xs + 2,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  perkDesc: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
  },
  notifyButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    ...Shadows.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  dismissButton: {
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: 0,
    ...Shadows.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
});
