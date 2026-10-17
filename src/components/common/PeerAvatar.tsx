import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOrbitorTheme, Typography, Radius } from '../../theme';
import { Peer } from '../../core/types';

interface PeerAvatarProps {
  peer?: Peer;
  name?: string;
  size?: number;
  showSignal?: boolean;
}

export const PeerAvatar: React.FC<PeerAvatarProps> = ({
  peer,
  name,
  size = 40,
  showSignal = false,
}) => {
  const theme = useOrbitorTheme();
  const rawName = peer ? peer.name : name || 'Peer';

  // Strip non-letter characters like (Galaxy S24) before calculating clean initials
  const cleanName = rawName.replace(/[\(\)\[\]\{\}\-_]/g, ' ').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : (parts[0]?.[0] || 'P').toUpperCase();

  const getSignalColor = () => {
    if (!peer) return theme.accentCyan;
    if (peer.rssi > -60) return theme.success;
    if (peer.rssi > -78) return theme.accentCyan;
    return theme.warning;
  };

  const signalColor = getSignalColor();

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <View
        style={[
          styles.circle,
          {
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.border,
          },
        ]}>
        <Text
          style={[
            styles.initials,
            {
              color: theme.text,
              fontSize: Math.round(size * 0.36),
            },
          ]}>
          {initials}
        </Text>
      </View>

      {showSignal && (
        <View
          style={[
            styles.signalDot,
            {
              backgroundColor: signalColor,
              borderColor: theme.background,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  signalDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
});
