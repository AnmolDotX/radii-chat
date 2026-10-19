import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { UserProfile } from '../../core/types';
import { Badge } from '../common/Badge';

import { requestRadioAndNearbyPermissions } from '../../utils/permissions';

interface ProfileSetupModalProps {
  visible: boolean;
  profile: UserProfile;
  onSave: (name: string, deviceName: string, visibility: UserProfile['visibility']) => void;
}

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  visible,
  profile,
  onSave,
}) => {
  const theme = useOrbitorTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [isRequestingPerms, setIsRequestingPerms] = useState(false);
  const [name, setName] = useState(profile.displayName || '');
  const [deviceName, setDeviceName] = useState(profile.deviceName || profile.deviceModel);
  const [visibility, setVisibility] = useState<UserProfile['visibility']>(profile.visibility || 'everyone');

  const handleGrantPermissions = async () => {
    setIsRequestingPerms(true);
    try {
      await requestRadioAndNearbyPermissions();
    } catch (err) {
      console.warn('Onboarding permissions error:', err);
    } finally {
      setIsRequestingPerms(false);
      setStep(2);
    }
  };

  const handleFinishSetup = () => {
    const finalName = name.trim() || 'Radii User';
    const finalDevice = deviceName.trim() || profile.deviceModel;
    onSave(finalName, finalDevice, visibility);
  };

  const visibilityOptions: { id: UserProfile['visibility']; title: string; desc: string }[] = [
    {
      id: 'everyone',
      title: 'Everyone Nearby',
      desc: 'Visible to all nearby companions running Radii within ~30 meters',
    },
    {
      id: 'contacts',
      title: 'Contacts / Paired Only',
      desc: 'Only devices you have previously paired with can discover you',
    },
    {
      id: 'hidden',
      title: 'None (Hidden)',
      desc: 'You can discover nearby peers, but your device stays silent on radar',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
            },
          ]}>
          {/* Stepper Progress Indicator */}
          <View style={styles.stepperHeader}>
            <View style={styles.stepBadgeRow}>
              <View
                style={[
                  styles.stepPill,
                  { backgroundColor: theme.text },
                ]}>
                <Text style={[styles.stepPillText, { color: theme.background }]}>
                  STEP {step} OF 2
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
                {step === 1 ? 'Offline Radio Permissions' : 'Profile & Visibility'}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.success,
                    width: step === 1 ? '50%' : '100%',
                  },
                ]}
              />
            </View>
          </View>

          {step === 1 ? (
            /* STEP 1: PERMISSION GRANT */
            <View style={styles.contentWrap}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Enable Offline Connection</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Radii uses your device antennas (Bluetooth & Nearby Wi-Fi Direct) to discover and chat with people around you with zero internet.
                </Text>
              </View>

              <View style={styles.permCardsList}>
                <View style={[styles.permCard, { backgroundColor: theme.surfaceElevated }]}>
                  <View style={styles.permIconBadge}>
                    <Text style={styles.permEmoji}>📡</Text>
                  </View>
                  <View style={styles.permCardText}>
                    <Text style={[styles.permTitle, { color: theme.text }]}>Bluetooth & BLE Discovery</Text>
                    <Text style={[styles.permDesc, { color: theme.textSecondary }]}>
                      Scans & advertises local radio beacon signals to discover devices nearby.
                    </Text>
                  </View>
                </View>

                <View style={[styles.permCard, { backgroundColor: theme.surfaceElevated }]}>
                  <View style={styles.permIconBadge}>
                    <Text style={styles.permEmoji}>⚡</Text>
                  </View>
                  <View style={styles.permCardText}>
                    <Text style={[styles.permTitle, { color: theme.text }]}>Nearby Wi-Fi Direct</Text>
                    <Text style={[styles.permDesc, { color: theme.textSecondary }]}>
                      High-speed antenna-to-antenna pipeline for direct messages and file flings.
                    </Text>
                  </View>
                </View>

                <View style={[styles.permCard, { backgroundColor: theme.surfaceElevated }]}>
                  <View style={styles.permIconBadge}>
                    <Text style={styles.permEmoji}>📍</Text>
                  </View>
                  <View style={styles.permCardText}>
                    <Text style={[styles.permTitle, { color: theme.text }]}>Local Hardware Discovery</Text>
                    <Text style={[styles.permDesc, { color: theme.textSecondary }]}>
                      Android OS requirement to locate nearby hardware radios without cell towers.
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={handleGrantPermissions}
                disabled={isRequestingPerms}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: theme.text,
                    opacity: pressed || isRequestingPerms ? 0.85 : 1,
                  },
                ]}>
                {isRequestingPerms ? (
                  <ActivityIndicator size="small" color={theme.background} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.background }]}>
                    Grant Permissions & Continue →
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            /* STEP 2: PROFILE & VISIBILITY */
            <View style={styles.contentWrap}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Profile & Visibility</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Choose your display name and how you appear to companions on the radar.
                </Text>
              </View>

              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>YOUR NAME</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Anmol"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.surfaceElevated,
                      color: theme.text,
                    },
                  ]}
                />
              </View>

              {/* Visibility Options */}
              <View style={styles.visibilityGroup}>
                <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>
                  SELECT YOUR RADAR VISIBILITY
                </Text>
                {visibilityOptions.map((opt) => {
                  const isSelected = visibility === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setVisibility(opt.id)}
                      style={({ pressed }) => [
                        styles.visibilityOption,
                        {
                          backgroundColor: isSelected ? theme.surfaceHighlight : theme.surfaceElevated,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      <View style={styles.visibilityTextWrap}>
                        <Text
                          style={[
                            styles.visibilityTitle,
                            {
                              color: isSelected ? theme.text : theme.textSecondary,
                              fontWeight: isSelected ? Typography.weights.semibold : Typography.weights.regular,
                            },
                          ]}>
                          {opt.title}
                        </Text>
                        <Text style={[styles.visibilityDesc, { color: theme.textTertiary }]}>
                          {opt.desc}
                        </Text>
                      </View>
                      {isSelected && <Badge label="ACTIVE" variant="green" size="sm" />}
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={handleFinishSetup}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: theme.text,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text style={[styles.primaryButtonText, { color: theme.background }]}>
                  Enter Radii & Start Scanning ⚡
                </Text>
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
  stepperHeader: {
    gap: 8,
    marginBottom: 4,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  stepPillText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
  },
  stepLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
  },
  progressTrack: {
    height: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  contentWrap: {
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
  permCardsList: {
    gap: Spacing.sm,
  },
  permCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0,
    ...Shadows.subtle,
  },
  permIconBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0, 194, 13, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permEmoji: {
    fontSize: 18,
  },
  permCardText: {
    flex: 1,
    gap: 2,
  },
  permTitle: {
    fontSize: Typography.sizes.xs + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  permDesc: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 15,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  textInput: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0,
    ...Shadows.subtle,
    fontSize: Typography.sizes.sm + 1,
    fontFamily: Typography.fontFamily,
  },
  visibilityGroup: {
    gap: Spacing.xs + 2,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 0,
    ...Shadows.subtle,
    gap: Spacing.sm,
  },
  visibilityTextWrap: {
    flex: 1,
    gap: 2,
  },
  visibilityTitle: {
    fontSize: Typography.sizes.xs + 2,
    fontFamily: Typography.fontFamily,
  },
  visibilityDesc: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 14,
  },
  primaryButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    ...Shadows.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  primaryButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
});
