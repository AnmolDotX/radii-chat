import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';

interface PTTVoiceButtonProps {
  onSendVoice: (durationSeconds: number) => void;
}

export const PTTVoiceButton: React.FC<PTTVoiceButtonProps> = ({ onSendVoice }) => {
  const theme = useOrbitorTheme();
  const [isHolding, setIsHolding] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isHolding) {
      pulse.value = withRepeat(
        withTiming(1.35, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [isHolding, pulse]);

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
    };
  });

  const handlePressIn = () => {
    setIsHolding(true);
    setRecordSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
  };

  const handlePressOut = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const finalDuration = Math.max(1, recordSeconds);
    setIsHolding(false);
    onSendVoice(finalDuration);
  };

  return (
    <View style={styles.container}>
      {isHolding && (
        <View style={[styles.timerBadge, { backgroundColor: theme.dangerMuted }]}>
          <View style={[styles.recordingDot, { backgroundColor: theme.danger }]} />
          <Text style={[styles.timerText, { color: theme.danger }]}>
            PTT 0:0{recordSeconds}
          </Text>
        </View>
      )}

      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.buttonWrapper,
          {
            backgroundColor: isHolding ? theme.accentCyan : theme.surfaceElevated,
            borderColor: isHolding ? theme.accentCyan : theme.border,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}>
        {isHolding && (
          <Animated.View
            style={[
              styles.pulseRing,
              { borderColor: theme.accentCyan },
              pulseStyle,
            ]}
          />
        )}
        <Text style={[styles.icon, { color: isHolding ? theme.background : theme.text }]}>
          🎙
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrapper: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 2,
    opacity: 0.6,
  },
  icon: {
    fontSize: 18,
  },
  timerBadge: {
    position: 'absolute',
    top: -36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  timerText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
  },
});
