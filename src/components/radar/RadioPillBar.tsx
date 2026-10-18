import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { NetworkMode } from '../../core/types';

interface RadioPillBarProps {
  networkMode: NetworkMode;
  onSelectMode: (mode: NetworkMode) => void;
}

export const RadioPillBar: React.FC<RadioPillBarProps> = ({
  networkMode,
  onSelectMode,
}) => {
  const theme = useOrbitorTheme();
  const isOffline = networkMode === 'offline';

  const toggleMode = () => {
    onSelectMode(isOffline ? 'online' : 'offline');
  };

  return (
    <Pressable
      onPress={toggleMode}
      accessibilityRole="button"
      accessibilityLabel={`Current mode: ${isOffline ? 'Offline Mesh' : 'Online Proximity'}. Tap to switch.`}
      style={({ pressed }) => [
        styles.pillContainer,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <View
        style={[
          styles.activeDot,
          { backgroundColor: isOffline ? theme.success : theme.accentBlue },
        ]}
      />
      <Text style={[styles.statusText, { color: theme.text }]}>
        {isOffline ? 'Offline Connection' : 'Online Connection'}
      </Text>
      <Text style={[styles.divider, { color: theme.border }]}>·</Text>
      <Text style={[styles.subText, { color: theme.textSecondary }]}>
        {isOffline ? 'Bluetooth & Nearby' : 'Location Proximity'}
      </Text>
      <View style={[styles.switchIndicator, { backgroundColor: theme.surfaceElevated }]}>
        <Text style={[styles.switchText, { color: isOffline ? theme.accentCyan : theme.accentBlue }]}>
          {isOffline ? 'Go Online ↗' : 'Go Offline ↗'}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pillContainer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 3,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: Spacing.xs + 2,
    marginVertical: Spacing.xs,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: Typography.sizes.xs + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  divider: {
    fontSize: Typography.sizes.xs,
  },
  subText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  switchIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginLeft: 2,
  },
  switchText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
  },
});
