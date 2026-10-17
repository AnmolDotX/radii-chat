import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { NetworkMode } from '../../core/types';

interface RadioPillBarProps {
  networkMode: NetworkMode;
  onSelectMode: (mode: NetworkMode) => void;
  autoUpgrade: boolean;
  onToggleAutoUpgrade: (enabled: boolean) => void;
}

export const RadioPillBar: React.FC<RadioPillBarProps> = ({
  networkMode,
  onSelectMode,
}) => {
  const theme = useOrbitorTheme();

  const toggleMode = () => {
    onSelectMode(networkMode === 'offline' ? 'lan' : 'offline');
  };

  const isOffline = networkMode === 'offline';

  return (
    <Pressable
      onPress={toggleMode}
      style={({ pressed }) => [
        styles.pillContainer,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <View style={[styles.activeDot, { backgroundColor: theme.success }]} />
      <Text style={[styles.statusText, { color: theme.text }]}>
        {isOffline ? 'Offline Radio Mesh' : 'Campus LAN Mode'}
      </Text>
      <Text style={[styles.divider, { color: theme.border }]}>·</Text>
      <Text style={[styles.subText, { color: theme.textTertiary }]}>
        {isOffline ? 'BLE & Nearby' : 'Hostel Wi-Fi'}
      </Text>
      <View style={[styles.switchIndicator, { backgroundColor: theme.surfaceElevated }]}>
        <Text style={[styles.switchText, { color: theme.accentCyan }]}>
          {isOffline ? 'LAN ↗' : 'Radio ↗'}
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
    width: 6,
    height: 6,
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
