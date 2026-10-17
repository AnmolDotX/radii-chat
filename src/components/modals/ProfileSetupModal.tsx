import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { UserProfile } from '../../core/types';
import { Badge } from '../common/Badge';

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
  const [name, setName] = useState(profile.displayName || '');
  const [deviceName, setDeviceName] = useState(profile.deviceName || profile.deviceModel);
  const [visibility, setVisibility] = useState<UserProfile['visibility']>(profile.visibility || 'everyone');

  const handleSave = () => {
    const finalName = name.trim() || 'Orbitor User';
    const finalDevice = deviceName.trim() || profile.deviceModel;
    onSave(finalName, finalDevice, visibility);
  };

  const visibilityOptions: { id: UserProfile['visibility']; title: string; desc: string }[] = [
    {
      id: 'everyone',
      title: 'Everyone Nearby',
      desc: 'Visible to all nearby phones running Orbitor within ~30 meters',
    },
    {
      id: 'contacts',
      title: 'Paired Contacts Only',
      desc: 'Only phones you have previously accepted can see you',
    },
    {
      id: 'hidden',
      title: 'Hidden',
      desc: 'You can discover nearby peers, but your radio stays silent',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
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
            <Text style={[styles.title, { color: theme.text }]}>Welcome to Orbitor</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Set up your offline identity. No account, email, or internet required.
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
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
          </View>

          {/* Device Name Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>DEVICE NAME</Text>
            <TextInput
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="Device Model"
              placeholderTextColor={theme.textTertiary}
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
          </View>

          {/* Visibility Selector */}
          <View style={styles.visibilityGroup}>
            <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>
              RADAR VISIBILITY
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
                      borderColor: isSelected ? theme.accentCyan : theme.border,
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
                  {isSelected && <Badge label="ACTIVE" variant="cyan" size="sm" />}
                </Pressable>
              );
            })}
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={!name.trim()}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: name.trim() ? theme.text : theme.surfaceElevated,
                opacity: pressed || !name.trim() ? 0.6 : 1,
              },
            ]}>
            <Text
              style={[
                styles.saveButtonText,
                { color: name.trim() ? theme.background : theme.textTertiary },
              ]}>
              Enter Radar
            </Text>
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
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  subtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
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
    borderWidth: 1,
    fontSize: Typography.sizes.base,
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
    borderWidth: 1,
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
  saveButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  saveButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
});
