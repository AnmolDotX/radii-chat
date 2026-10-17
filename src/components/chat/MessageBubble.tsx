import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Message } from '../../core/types';
import { Badge } from '../common/Badge';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const theme = useOrbitorTheme();
  const isMe = message.isMe;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View
      style={[
        styles.container,
        isMe ? styles.alignRight : styles.alignLeft,
      ]}>
      {!isMe && (
        <Text style={[styles.senderName, { color: theme.textSecondary }]}>
          {message.senderName}
        </Text>
      )}

      <View
        style={[
          styles.bubble,
          isMe
            ? {
                backgroundColor: theme.accentBlue,
                borderBottomRightRadius: Radius.xs,
              }
            : {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
                borderWidth: 1,
                borderBottomLeftRadius: Radius.xs,
              },
        ]}>
        {message.isVoice ? (
          <View style={styles.voiceRow}>
            <View
              style={[
                styles.voicePlayIcon,
                { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : theme.accentCyanMuted },
              ]}>
              <Text style={{ color: isMe ? '#FFFFFF' : theme.accentCyan, fontSize: 11 }}>▶</Text>
            </View>
            <View style={styles.voiceWave}>
              <Text
                style={[
                  styles.voiceWaveText,
                  { color: isMe ? 'rgba(255,255,255,0.85)' : theme.textSecondary },
                ]}>
                ● ılılılılılılılılı
              </Text>
              <Text
                style={[
                  styles.voiceDuration,
                  { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textTertiary },
                ]}>
                0:0{message.audioDurationSeconds || 3}
              </Text>
            </View>
          </View>
        ) : (
          <Text
            style={[
              styles.messageText,
              { color: isMe ? '#FFFFFF' : theme.text },
            ]}>
            {message.text}
          </Text>
        )}

        {/* Footer info: time, transport badge, status */}
        <View style={styles.metaRow}>
          <Badge
            label={message.transport}
            transport={message.transport}
            size="sm"
            style={{
              paddingVertical: 1,
              paddingHorizontal: 4,
              backgroundColor: isMe ? 'rgba(0,0,0,0.2)' : undefined,
              borderColor: 'transparent',
            }}
          />

          <Text
            style={[
              styles.timeText,
              { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textTertiary },
            ]}>
            {formatTime(message.timestamp)}
          </Text>

          {isMe && (
            <Text style={[styles.statusIcon, { color: isMe ? '#FFFFFF' : theme.textTertiary }]}>
              {message.status === 'delivered' ? '✓✓' : message.status === 'queued_offline' ? '⏱' : '✓'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.base,
    maxWidth: '82%',
  },
  alignRight: {
    alignSelf: 'flex-end',
  },
  alignLeft: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs + 3,
  },
  messageText: {
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontFamily,
    lineHeight: 21,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 4,
    minWidth: 160,
  },
  voicePlayIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceWave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceWaveText: {
    fontSize: 13,
    letterSpacing: 1,
  },
  voiceDuration: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.monoFamily,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  timeText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
  },
  statusIcon: {
    fontSize: 10,
    fontWeight: '700',
  },
});
