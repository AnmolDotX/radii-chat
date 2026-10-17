import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Badge } from '../common/Badge';

interface SOSModalProps {
  visible: boolean;
  onClose: () => void;
  onBroadcastSOS: (message: string) => void;
}

export const SOSModal: React.FC<SOSModalProps> = ({
  visible,
  onClose,
  onBroadcastSOS,
}) => {
  const theme = useOrbitorTheme();
  const [selectedType, setSelectedType] = useState<string>('Medical / First Aid');

  const emergencyTypes = [
    'Medical / First Aid',
    'Lost / Off-trail',
    'Equipment / Power Loss',
    'General Urgent Alert',
  ];

  const handleBroadcast = () => {
    onBroadcastSOS(`EMERGENCY SOS: ${selectedType}. Need urgent local assistance.`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.danger,
            },
          ]}>
          <View style={styles.header}>
            <View style={[styles.dangerIconBadge, { backgroundColor: theme.dangerMuted }]}>
              <Text style={styles.dangerIcon}>🚨</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Emergency Offline Beacon</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Broadcasts high-priority emergency signal to all nearby BLE & Nearby devices in range. No internet or SIM required.
            </Text>
          </View>

          <View style={styles.radioGroup}>
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>
              SELECT EMERGENCY TYPE
            </Text>
            {emergencyTypes.map((type) => {
              const isSelected = selectedType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setSelectedType(type)}
                  style={({ pressed }) => [
                    styles.radioItem,
                    {
                      backgroundColor: isSelected ? theme.surfaceHighlight : theme.surfaceElevated,
                      borderColor: isSelected ? theme.danger : theme.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.radioLabel,
                      {
                        color: isSelected ? theme.text : theme.textSecondary,
                        fontWeight: isSelected
                          ? Typography.weights.semibold
                          : Typography.weights.regular,
                      },
                    ]}>
                    {type}
                  </Text>
                  {isSelected && <Badge label="ACTIVE" variant="red" size="sm" />}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancelButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleBroadcast}
              style={({ pressed }) => [
                styles.broadcastButton,
                {
                  backgroundColor: theme.danger,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text style={[styles.buttonText, { color: '#FFFFFF', fontWeight: '700' }]}>
                Broadcast SOS
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
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  dangerIconBadge: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  dangerIcon: {
    fontSize: 24,
  },
  title: {
    fontSize: Typography.sizes.lg,
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
  radioGroup: {
    gap: Spacing.xs + 2,
  },
  sectionLabel: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 3,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  radioLabel: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastButton: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontFamily,
  },
});
