import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { AudioPlayer } from '../../utils/audioPlayer';

interface PTTVoiceButtonProps {
  onSendVoice: (durationSeconds: number, audioUri?: string, audioBase64?: string) => void;
  disabled?: boolean;
}

export const PTTVoiceButton: React.FC<PTTVoiceButtonProps> = ({ onSendVoice, disabled = false }) => {
  const theme = useOrbitorTheme();
  const [isHolding, setIsHolding] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const timerRef = useRef<any>(null);
  const recordSecondsRef = useRef(0);

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

  const finishRecording = async (seconds: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const finalDuration = Math.min(10, Math.max(1, seconds));
    setIsHolding(false);
    setRecordSeconds(0);
    recordSecondsRef.current = 0;

    const audioResult = await AudioPlayer.stopRecording();
    if (audioResult && (audioResult.filePath || audioResult.base64)) {
      onSendVoice(finalDuration, audioResult.filePath, audioResult.base64);
    }
  };

  const handlePressIn = () => {
    if (disabled) return;
    setIsHolding(true);
    setRecordSeconds(0);
    recordSecondsRef.current = 0;

    const recordId = `rec_${Date.now()}`;
    AudioPlayer.startRecording(recordId).catch(() => {});

    timerRef.current = setInterval(() => {
      recordSecondsRef.current += 1;
      const current = recordSecondsRef.current;
      setRecordSeconds(current);

      // Auto-stop and transmit at 10 seconds limit for fast radio transmission
      if (current >= 10) {
        finishRecording(10);
      }
    }, 1000);
  };

  const handlePressOut = () => {
    if (!isHolding) return;
    finishRecording(recordSecondsRef.current);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formattedSec = recordSeconds < 10 ? `0${recordSeconds}` : `${recordSeconds}`;

  return (
    <View style={styles.container}>
      {isHolding && (
        <View style={[styles.timerBadge, { backgroundColor: theme.dangerMuted }]}>
          <View style={[styles.recordingDot, { backgroundColor: theme.danger }]} />
          <Text style={[styles.timerText, { color: theme.danger }]}>
            PTT 0:{formattedSec} / 0:10
          </Text>
        </View>
      )}

      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityLabel="Push to talk voice note"
        style={({ pressed }) => [
          styles.buttonWrapper,
          {
            backgroundColor: isHolding ? theme.accentCyan : theme.surfaceElevated,
            opacity: disabled ? 0.4 : pressed ? 0.9 : 1,
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
        <Ionicons
          name={isHolding ? 'mic' : 'mic-outline'}
          size={21}
          color={isHolding ? theme.background : theme.text}
        />
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
    borderWidth: 0,
    ...Shadows.subtle,
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
