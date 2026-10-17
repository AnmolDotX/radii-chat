import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Peer } from '../../core/types';
import { PeerAvatar } from '../common/PeerAvatar';

const { width } = Dimensions.get('window');
const RADAR_SIZE = Math.min(width - Spacing.xl * 2, 290);
const RADIUS = RADAR_SIZE / 2;

interface RadarSweepProps {
  peers: Peer[];
  onSelectPeer: (peer: Peer) => void;
  onLongPressPeer?: (peer: Peer) => void;
  isScanning?: boolean;
}

export const RadarSweep: React.FC<RadarSweepProps> = ({
  peers,
  onSelectPeer,
  onLongPressPeer,
  isScanning = true,
}) => {
  const theme = useOrbitorTheme();

  const rotation = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isScanning) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 4500, easing: Easing.linear }),
        -1,
        false
      );
      pulse.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
    }
  }, [isScanning, rotation, pulse]);

  const sweepAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const pulseAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.8, 1.3]);
    const opacity = interpolate(pulse.value, [0, 0.6, 1], [0.5, 0.15, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const getPeerPosition = (peer: Peer, index: number, total: number) => {
    const normalizedRssi = Math.max(-95, Math.min(-40, peer.rssi));
    const distanceFraction = 0.32 + ((normalizedRssi - -40) / (-95 - -40)) * 0.55;
    const peerRadius = RADIUS * distanceFraction;

    const angleRad = (index * 2 * Math.PI) / (total || 1) + 0.5;
    const x = RADIUS + peerRadius * Math.cos(angleRad);
    const y = RADIUS + peerRadius * Math.sin(angleRad);

    return { x, y };
  };

  return (
    <View style={[styles.container, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
      {/* Outer Glow & Background */}
      <View
        style={[
          styles.outerRing,
          {
            borderColor: theme.borderSubtle,
            backgroundColor: theme.surface,
          },
        ]}
      />

      {/* Ultra-fine Concentric Distance Rings */}
      <View
        style={[
          styles.ring,
          {
            width: RADAR_SIZE * 0.72,
            height: RADAR_SIZE * 0.72,
            borderColor: theme.borderSubtle,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: RADAR_SIZE * 0.44,
            height: RADAR_SIZE * 0.44,
            borderColor: theme.borderSubtle,
          },
        ]}
      />

      {/* Sweep Beam */}
      <Animated.View
        style={[
          styles.sweepContainer,
          { width: RADAR_SIZE, height: RADAR_SIZE },
          sweepAnimatedStyle,
        ]}>
        <View style={[styles.sweepLine, { backgroundColor: theme.accentCyan }]} />
      </Animated.View>

      {/* Center Emitter Halo & Dot */}
      <Animated.View
        style={[
          styles.pulseHalo,
          {
            borderColor: theme.accentCyan,
            width: 48,
            height: 48,
          },
          pulseAnimatedStyle,
        ]}
      />
      <View
        style={[
          styles.centerNode,
          {
            backgroundColor: theme.accentCyan,
          },
        ]}>
        <View style={[styles.centerInnerDot, { backgroundColor: theme.background }]} />
      </View>

      {/* Orbiting Unpaired Peers */}
      {peers.map((peer, idx) => {
        const { x, y } = getPeerPosition(peer, idx, peers.length);
        const nodeSize = 36;
        const cleanShortName = peer.name.replace(/[\(\)\[\]\{\}\-_]/g, ' ').trim().split(/\s+/)[0];

        return (
          <Pressable
            key={peer.id}
            onPress={() => onSelectPeer(peer)}
            onLongPress={() => onLongPressPeer && onLongPressPeer(peer)}
            delayLongPress={400}
            style={({ pressed }) => [
              styles.peerNodeWrapper,
              {
                left: x - nodeSize / 2,
                top: y - nodeSize / 2,
                width: nodeSize,
                height: nodeSize,
                transform: [{ scale: pressed ? 0.9 : 1 }],
              },
            ]}>
            <PeerAvatar peer={peer} size={nodeSize} showSignal={true} />
            <Text
              numberOfLines={1}
              style={[
                styles.peerLabelText,
                { color: theme.textSecondary, backgroundColor: theme.surfaceElevated },
              ]}>
              {cleanShortName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  outerRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  ring: {
    position: 'absolute',
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sweepContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sweepLine: {
    width: 1.5,
    height: '50%',
    opacity: 0.5,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  pulseHalo: {
    position: 'absolute',
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  centerNode: {
    width: 14,
    height: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  centerInnerDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  peerNodeWrapper: {
    position: 'absolute',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerLabelText: {
    position: 'absolute',
    top: 38,
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
});
