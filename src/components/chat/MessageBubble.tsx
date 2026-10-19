import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { Message } from '../../core/types';
import { AudioPlayer, PlaybackStatus } from '../../utils/audioPlayer';

interface MessageBubbleProps {
  message: Message;
  showSenderName?: boolean;
}

const WAVEFORM_BARS = [
  6, 12, 18, 10, 16, 24, 14, 8, 16, 22, 18, 12, 20, 14, 10, 18, 12, 16, 8, 6,
];

interface VoiceNotePlayerProps {
  messageId: string;
  isMe: boolean;
  durationSeconds: number;
  audioUri?: string;
}

const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  messageId,
  isMe,
  durationSeconds,
  audioUri,
}) => {
  const theme = useOrbitorTheme();
  const [status, setStatus] = useState<PlaybackStatus>({
    messageId: null,
    isPlaying: false,
    progress: 0,
    elapsedSeconds: 0,
    totalSeconds: durationSeconds,
  });

  useEffect(() => {
    return AudioPlayer.subscribe((newStatus) => {
      if (newStatus.messageId === messageId) {
        setStatus(newStatus);
      } else {
        // If another note starts playing or stopped, reset this note to idle
        setStatus((prev) =>
          prev.isPlaying || prev.progress > 0
            ? {
                messageId: null,
                isPlaying: false,
                progress: 0,
                elapsedSeconds: 0,
                totalSeconds: durationSeconds,
              }
            : prev
        );
      }
    });
  }, [messageId, durationSeconds]);

  const isThisPlaying = status.messageId === messageId && status.isPlaying;
  const progress = status.messageId === messageId ? status.progress : 0;
  const elapsed = status.messageId === messageId ? status.elapsedSeconds : 0;

  const handleTogglePlay = () => {
    if (isThisPlaying) {
      AudioPlayer.pause(messageId);
    } else {
      AudioPlayer.play(messageId, durationSeconds, audioUri);
    }
  };

  const handleWaveformPress = (e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    // 20 bars * 6px per bar + gaps ~ 130px width
    const fraction = Math.max(0, Math.min(1, locationX / 130));
    AudioPlayer.seek(messageId, fraction, durationSeconds);
    if (!isThisPlaying) {
      AudioPlayer.play(messageId, durationSeconds, audioUri);
    }
  };

  const formattedTime = () => {
    const s = isThisPlaying || progress > 0 ? elapsed : durationSeconds;
    return `0:${s < 10 ? '0' : ''}${s}`;
  };

  const activeColor = isMe ? '#FFFFFF' : theme.accentCyan;
  const inactiveColor = isMe ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.2)';
  const textColor = isMe ? 'rgba(255, 255, 255, 0.85)' : theme.textSecondary;

  return (
    <View style={styles.voicePlayerContainer}>
      <Pressable
        onPress={handleTogglePlay}
        hitSlop={8}
        accessibilityLabel={isThisPlaying ? 'Pause voice note' : 'Play voice note'}
        style={({ pressed }) => [
          styles.playButton,
          {
            backgroundColor: isMe ? 'rgba(255,255,255,0.22)' : theme.accentCyanMuted,
            opacity: pressed ? 0.75 : 1,
          },
        ]}>
        <Ionicons
          name={isThisPlaying ? 'pause' : 'play'}
          size={18}
          color={activeColor}
          style={!isThisPlaying ? { marginLeft: 2 } : undefined}
        />
      </Pressable>

      <View style={styles.waveformWrapper}>
        <Pressable
          onPress={handleWaveformPress}
          hitSlop={{ top: 8, bottom: 8 }}
          style={styles.waveformRow}>
          {WAVEFORM_BARS.map((barHeight, idx) => {
            const barFraction = idx / (WAVEFORM_BARS.length - 1);
            const isPlayed = barFraction <= progress;
            return (
              <View
                key={idx}
                style={[
                  styles.waveformBar,
                  {
                    height: barHeight,
                    backgroundColor: isPlayed ? activeColor : inactiveColor,
                  },
                ]}
              />
            );
          })}
        </Pressable>

        <View style={styles.voiceMetaRow}>
          <Text style={[styles.voiceTimerText, { color: textColor }]}>
            {formattedTime()}
          </Text>
          <Ionicons
            name="mic"
            size={12}
            color={isThisPlaying ? activeColor : textColor}
          />
        </View>
      </View>
    </View>
  );
};

interface MessageBubbleProps {
  message: Message;
  showSenderName?: boolean;
  onAcceptTransfer?: (transferId: string) => void;
  onDeclineTransfer?: (transferId: string) => void;
  onCancelTransfer?: (transferId: string) => void;
  onRetryTransfer?: (transferId: string) => void;
  onPressImage?: (imageUri: string, senderName?: string, timestamp?: number) => void;
  onOpenFile?: (fileUri: string, mimeType?: string) => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(sec?: number): string {
  const s = sec || 0;
  return `0:${s < 10 ? '0' : ''}${s}`;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showSenderName = false,
  onAcceptTransfer,
  onDeclineTransfer,
  onCancelTransfer,
  onRetryTransfer,
  onPressImage,
  onOpenFile,
}) => {
  const theme = useOrbitorTheme();
  const isMe = message.isMe;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isDeclined =
    message.transferStatus === 'declined' ||
    message.transferStatus === 'cancelled' ||
    message.transferStatus === 'failed';
  const isAwaitingAcceptance = !isDeclined && message.transferStatus === 'awaiting_acceptance';
  const isTransferring = !isDeclined && message.transferStatus === 'transferring';
  const isCompleted =
    !isDeclined &&
    !isAwaitingAcceptance &&
    !isTransferring &&
    (message.transferStatus === 'completed' ||
      (!message.transferStatus && !message.transferId) ||
      Boolean((isMe ? message.fileUri : false) && !message.transferStatus));

  const showCancelChip = Boolean(
    onCancelTransfer &&
    (isTransferring || (isAwaitingAcceptance && isMe))
  );

  const showRetryChip = Boolean(
    onRetryTransfer &&
    message.transferStatus === 'failed'
  );

  const totalSizeBytes = message.fileSizeBytes || (message.totalChunks ? message.totalChunks * 4096 : 0);
  const currentProgress = message.transferProgress || 0;
  const transferredSizeBytes = totalSizeBytes > 0 ? Math.round((currentProgress / 100) * totalSizeBytes) : 0;
  const sizeProgressLabel = totalSizeBytes > 0 ? `${formatFileSize(transferredSizeBytes)} / ${formatFileSize(totalSizeBytes)}` : '';
  const showBottomBytes = Boolean(sizeProgressLabel && isTransferring);
  if (message.isSystem || message.senderId === 'system') {
    return (
      <View style={styles.systemMessageContainer}>
        <View
          style={[
            styles.systemMessagePill,
            { backgroundColor: theme.surfaceHighlight },
          ]}>
          <Text style={[styles.systemMessageText, { color: theme.textSecondary }]}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isMe ? styles.alignRight : styles.alignLeft,
      ]}>
      {!isMe && showSenderName && (
        <Text style={[styles.senderName, { color: theme.accentCyan }]}>
          {message.senderName || 'Radio Member'}
        </Text>
      )}

      <View
        style={[
          styles.bubble,
          isMe
            ? {
                backgroundColor: theme.accentCyan,
                borderBottomRightRadius: Radius.xs,
              }
            : {
                backgroundColor: theme.surfaceElevated,
                borderBottomLeftRadius: Radius.xs,
              },
          message.isImage && styles.imageBubble,
          message.isVoice && styles.voiceBubble,
          (isAwaitingAcceptance || isTransferring || isDeclined) && styles.transferBubble,
        ]}>

        {/* 1. AWAITING ACCEPTANCE STATE (Nearby Share prompt) */}
        {isAwaitingAcceptance ? (
          isMe ? (
            <View style={styles.senderPendingContainer}>
              {message.isImage && message.imageUri && (
                <View style={styles.imagePreviewWrapper}>
                  <Image
                    source={{ uri: message.imageUri }}
                    style={styles.pendingImagePreview}
                    contentFit="cover"
                  />
                  <View style={styles.pendingOverlay} />
                </View>
              )}
              {message.isVoice && (
                <View style={styles.voicePreviewRow}>
                  <Ionicons name="mic" size={16} color="#FFFFFF" />
                  <Text style={[styles.voicePendingText, { color: '#FFFFFF' }]}>
                    Voice note ({formatDuration(message.audioDurationSeconds)})
                  </Text>
                </View>
              )}
              {message.isFile && (
                <View style={styles.voicePreviewRow}>
                  <Ionicons name="document-text" size={16} color="#FFFFFF" />
                  <Text numberOfLines={1} style={[styles.voicePendingText, { color: '#FFFFFF' }]}>
                    {message.fileName || 'Document'} ({formatFileSize(message.fileSizeBytes)})
                  </Text>
                </View>
              )}
              <View style={styles.waitingBadgeRow}>
                <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.waitingBadgeText}>
                  Waiting for companion to accept ({formatFileSize(message.fileSizeBytes)})
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.nearbyPromptCard}>
              <View style={styles.nearbyHeaderRow}>
                <View style={[styles.nearbyIconBadge, { backgroundColor: theme.accentCyanMuted }]}>
                  <Ionicons
                    name={message.isVoice ? 'mic' : message.isFile ? 'document-text' : 'camera'}
                    size={20}
                    color={theme.accentCyan}
                  />
                </View>
                <View style={styles.nearbyMeta}>
                  <Text numberOfLines={1} style={[styles.nearbyTitle, { color: theme.text }]}>
                    {message.isVoice
                      ? 'Incoming Voice Note'
                      : message.isFile
                      ? `File: ${message.fileName || 'Document'}`
                      : 'Incoming Photo'}
                  </Text>
                  <Text style={[styles.nearbySubtitle, { color: theme.textSecondary }]}>
                    {message.isVoice
                      ? `${formatDuration(message.audioDurationSeconds)} · ${formatFileSize(message.fileSizeBytes)}`
                      : `${formatFileSize(message.fileSizeBytes)} · Direct Wi-Fi / BLE`}
                  </Text>
                </View>
              </View>

              <View style={styles.transferActionRow}>
                <Pressable
                  onPress={() => onDeclineTransfer?.(message.transferId || '')}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.declineBtn,
                    { backgroundColor: 'rgba(239, 68, 68, 0.12)', opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Ionicons name="close" size={15} color="#EF4444" />
                  <Text style={[styles.declineBtnText, { color: '#EF4444' }]}>Decline</Text>
                </Pressable>

                <Pressable
                  onPress={() => onAcceptTransfer?.(message.transferId || '')}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.acceptBtn,
                    { backgroundColor: theme.accentCyan, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <Ionicons name="download-outline" size={15} color="#000000" />
                  <Text style={[styles.acceptBtnText, { color: '#000000' }]}>Accept</Text>
                </Pressable>
              </View>
            </View>
          )
        ) : isTransferring ? (
          /* 2. LIVE TRANSFER PROGRESS (0% -> 100%) WITHOUT INLINE OVERFLOW */
          <View style={styles.transferringCard}>
            <View style={styles.transferProgressRow}>
              <View style={styles.transferProgressLeft}>
                <Ionicons
                  name="swap-vertical"
                  size={15}
                  color={isMe ? '#FFFFFF' : theme.accentCyan}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.transferProgressText,
                    { color: isMe ? '#FFFFFF' : theme.text },
                  ]}>
                  {isMe ? 'Sending media...' : 'Downloading media...'} {currentProgress}%
                </Text>
              </View>

            </View>

            <View style={[styles.progressBarTrack, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : theme.surface }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, Math.max(6, currentProgress))}%`,
                    backgroundColor: isMe ? '#FFFFFF' : theme.accentCyan,
                  },
                ]}
              />
            </View>
          </View>
        ) : isDeclined ? (
          /* 3. DECLINED / CANCELLED / FAILED TRANSFER STATE */
          <View style={styles.declinedCard}>
            <View style={styles.declinedInfoRow}>
              <Ionicons
                name={
                  message.transferStatus === 'cancelled'
                    ? 'close-circle-outline'
                    : message.transferStatus === 'failed'
                    ? 'alert-circle-outline'
                    : 'close-circle-outline'
                }
                size={16}
                color={message.transferStatus === 'failed' ? '#EF4444' : isMe ? 'rgba(255,255,255,0.7)' : theme.textTertiary}
              />
              <Text
                style={[
                  styles.declinedText,
                  {
                    color:
                      message.transferStatus === 'failed'
                        ? '#EF4444'
                        : isMe
                        ? 'rgba(255,255,255,0.85)'
                        : theme.textTertiary,
                  },
                ]}>
                {message.transferStatus === 'cancelled'
                  ? 'Transfer cancelled'
                  : message.transferStatus === 'failed'
                  ? 'Transfer stalled or failed'
                  : isMe
                  ? 'Transfer declined by companion'
                  : 'Transfer declined'}
              </Text>
            </View>

          </View>
        ) : isCompleted && message.isImage && message.imageUri ? (
          /* 4. COMPLETED PHOTO DISPLAY WITH FULLSCREEN PREVIEW */
          <Pressable
            onPress={() => onPressImage?.(message.imageUri!, message.senderName, message.timestamp)}
            style={styles.imageWrapper}>
            <Image
              source={{ uri: message.imageUri }}
              style={styles.bubbleImage}
              contentFit="cover"
              transition={200}
            />
            {message.text && message.text !== '📷 Photo' && (
              <Text
                style={[
                  styles.messageText,
                  styles.imageCaption,
                  { color: isMe ? '#FFFFFF' : theme.text },
                ]}>
                {message.text}
              </Text>
            )}
          </Pressable>
        ) : isCompleted && (message.isFile || (message.transferType === 'file' && (message.fileUri || message.imageUri))) ? (
          /* 5. COMPLETED DOCUMENT / FILE CARD (Tap to open with external app) */
          <Pressable
            onPress={() => onOpenFile?.(message.fileUri || message.imageUri || '', message.mimeType)}
            style={({ pressed }) => [
              styles.documentCard,
              {
                backgroundColor: isMe ? 'rgba(255,255,255,0.18)' : theme.surfaceElevated,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <View
              style={[
                styles.docIconBox,
                { backgroundColor: isMe ? 'rgba(255,255,255,0.22)' : theme.accentCyanMuted },
              ]}>
              <Ionicons
                name={
                  message.mimeType?.includes('pdf')
                    ? 'document-text'
                    : message.mimeType?.includes('video')
                    ? 'videocam'
                    : message.mimeType?.includes('audio')
                    ? 'musical-notes'
                    : 'document'
                }
                size={22}
                color={isMe ? '#FFFFFF' : theme.accentCyan}
              />
            </View>
            <View style={styles.docInfo}>
              <Text numberOfLines={1} style={[styles.docName, { color: isMe ? '#FFFFFF' : theme.text }]}>
                {message.fileName || 'Document'}
              </Text>
              <Text style={[styles.docMeta, { color: isMe ? 'rgba(255,255,255,0.75)' : theme.textSecondary }]}>
                {formatFileSize(message.fileSizeBytes)} · Tap to open
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={isMe ? '#FFFFFF' : theme.accentCyan} />
          </Pressable>
        ) : isCompleted && message.isVoice ? (
          /* 6. COMPLETED VOICE NOTE WITH PLAYBACK */
          <VoiceNotePlayer
            messageId={message.id}
            isMe={isMe}
            durationSeconds={message.audioDurationSeconds || 3}
            audioUri={message.audioUri}
          />
        ) : (
          /* 7. REGULAR TEXT MESSAGE */
          <Text
            style={[
              styles.messageText,
              { color: isMe ? '#FFFFFF' : theme.text },
            ]}>
            {message.text}
          </Text>
        )}

        {/* Footer info: bottom bytes counter on left, time + status on right */}
        <View style={[styles.metaRow, { justifyContent: showBottomBytes ? 'space-between' : 'flex-end' }]}>
          {showBottomBytes && (
            <Text
              style={[
                styles.bottomBytesText,
                { color: theme.success },
              ]}>
              {sizeProgressLabel}
            </Text>
          )}

          <View style={styles.metaRight}>
            <Text
              style={[
                styles.timeText,
                { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textTertiary },
              ]}>
              {formatTime(message.timestamp)}
            </Text>

            {isMe && (
              <Text
                style={[
                  styles.statusIcon,
                  {
                    color:
                      message.status === 'read'
                        ? '#38BDF8'
                        : isMe
                        ? 'rgba(255,255,255,0.85)'
                        : theme.textTertiary,
                    fontWeight: message.status === 'read' ? '700' : '500',
                  },
                ]}>
                {message.status === 'read'
                  ? '✓✓'
                  : message.status === 'delivered'
                  ? '✓✓'
                  : message.status === 'queued_offline' || message.status === 'pending'
                  ? '⏱'
                  : '✓'}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Floating Action Chip Row Below Message Bubble */}
      {(showCancelChip || showRetryChip) && (
        <View style={[styles.floatingChipRow, isMe ? styles.chipRowRight : styles.chipRowLeft]}>
          {showRetryChip && (
            <Pressable
              onPress={() => onRetryTransfer?.(message.transferId || message.id)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.floatingChip,
                {
                  backgroundColor: theme.surfaceHighlight,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Ionicons name="refresh" size={13} color={theme.accentCyan} />
              <Text style={[styles.floatingChipText, { color: theme.accentCyan }]}>
                Retry
              </Text>
            </Pressable>
          )}

          {showCancelChip && (
            <Pressable
              onPress={() => onCancelTransfer?.(message.transferId || message.id)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.floatingChip,
                {
                  backgroundColor: theme.surfaceHighlight,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Ionicons name="close-circle" size={13} color="#EF4444" />
              <Text style={[styles.floatingChipText, { color: '#EF4444' }]}>
                Cancel
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.base,
    maxWidth: '84%',
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
    ...Shadows.subtle,
  },
  messageText: {
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontFamily,
    lineHeight: 21,
  },
  voiceBubble: {
    minWidth: 210,
    paddingHorizontal: Spacing.sm + 4,
    paddingTop: Spacing.sm,
  },
  voicePlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    paddingVertical: 2,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformWrapper: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    gap: 3,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceTimerText: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  bottomBytesText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: '600',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
  },
  statusIcon: {
    fontSize: 10,
    fontWeight: '700',
  },
  imageBubble: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  imageWrapper: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  bubbleImage: {
    width: 230,
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  imageCaption: {
    marginTop: 4,
    paddingHorizontal: 6,
  },
  transferBubble: {
    minWidth: 220,
    paddingHorizontal: Spacing.sm + 4,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  senderPendingContainer: {
    gap: 6,
  },
  imagePreviewWrapper: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
    height: 120,
    width: '100%',
  },
  pendingImagePreview: {
    width: '100%',
    height: '100%',
  },
  pendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  voicePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  voicePendingText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  waitingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  waitingBadgeText: {
    fontSize: Typography.sizes.xs - 2,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500',
  },
  cancelPendingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.45)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    marginLeft: 4,
  },
  cancelPendingText: {
    fontSize: Typography.sizes.xs - 2,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nearbyPromptCard: {
    gap: 8,
    paddingVertical: 2,
  },
  nearbyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nearbyIconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyMeta: {
    flex: 1,
  },
  nearbyTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  nearbySubtitle: {
    fontSize: Typography.sizes.xs - 1,
    marginTop: 2,
  },
  transferActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  declineBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  acceptBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  transferringCard: {
    gap: 6,
    paddingVertical: 4,
    minWidth: 190,
  },
  transferProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  transferProgressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  transferProgressText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    flexShrink: 1,
  },
  transferActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transferMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
  },
  transferMiniBtnText: {
    fontSize: Typography.sizes.xs - 2,
    fontWeight: '700',
    fontFamily: Typography.fontFamily,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  declinedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 4,
  },
  declinedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  declinedText: {
    fontSize: Typography.sizes.xs,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: Radius.sm,
  },
  retryBtnText: {
    fontSize: Typography.sizes.xs - 2,
    fontWeight: '700',
    fontFamily: Typography.fontFamily,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    minWidth: 200,
    maxWidth: 260,
  },
  docIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
  },
  docMeta: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  systemMessageContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  systemMessagePill: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 0,
    ...Shadows.subtle,
    maxWidth: '90%',
  },
  systemMessageText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  floatingChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  chipRowRight: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  chipRowLeft: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  floatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 0,
    ...Shadows.subtle,
  },
  floatingChipText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    fontWeight: '600',
  },
});

