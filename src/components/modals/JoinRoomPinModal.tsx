import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { EventRoom } from '../../core/types';
import { Badge } from '../common/Badge';

interface JoinRoomPinModalProps {
  visible: boolean;
  room: EventRoom | null;
  onClose: () => void;
  onJoinSuccess: (code: string) => void;
}

export const JoinRoomPinModal: React.FC<JoinRoomPinModalProps> = ({
  visible,
  room,
  onClose,
  onJoinSuccess,
}) => {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setPin('');
      setError('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    }
  }, [visible, room]);

  if (!room) return null;

  const handleVerifyAndJoin = () => {
    const cleanPin = pin.trim().toUpperCase();
    if (!cleanPin) {
      setError('Please enter the 4-digit room PIN.');
      return;
    }

    const expectedCode = (room.code || '').trim().toUpperCase();
    if (cleanPin === expectedCode) {
      setError('');
      onJoinSuccess(cleanPin);
      onClose();
    } else {
      setError('Incorrect 4-digit PIN. Please ask the room host for the code.');
    }
  };

  const isKeyboardOpen = keyboardHeight > 0;
  const maxSheetHeight = isKeyboardOpen
    ? Math.max(260, windowHeight - keyboardHeight - (insets.top || 24) - 20)
    : windowHeight * 0.88;

  const sheetBottomPadding = isKeyboardOpen
    ? Spacing.base
    : (Platform.OS === 'android' ? Math.max(insets.bottom, 48) : Math.max(insets.bottom, 16)) +
      Spacing.base;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
          accessibilityLabel="Close PIN dialog"
          accessibilityRole="button"
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surfaceElevated,
              maxHeight: maxSheetHeight,
              marginBottom: isKeyboardOpen && Platform.OS === 'android' ? keyboardHeight : 0,
              paddingBottom: sheetBottomPadding,
            },
          ]}>
          {/* Header */}
          <View style={styles.topBar}>
            <View style={{ width: 36 }} />
            <Text style={[styles.sheetTitle, { color: theme.textTertiary }]}>
              PIN PROTECTED ROOM
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: theme.surfaceHighlight,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Room Summary Header */}
            <View style={styles.roomHeader}>
              <View
                style={[
                  styles.lockIconCircle,
                  {
                    backgroundColor: theme.accentCyanMuted,
                  },
                ]}>
                <Ionicons name="lock-closed" size={26} color={theme.accentCyan} />
              </View>

              <Text style={[styles.roomName, { color: theme.text }]}>{room.name}</Text>
              <Text style={[styles.roomSubtitle, { color: theme.textSecondary }]}>
                {room.creatorName ? `Host: ${room.creatorName}` : 'Nearby Companion'} ·{' '}
                {room.description || 'Offline Mesh Broadcast'}
              </Text>

              <View style={styles.badgeRow}>
                <Badge label="In Range" variant="cyan" size="sm" />
                <View style={{ width: 6 }} />
                <Badge label="4-Digit PIN Required" variant="neutral" size="sm" />
              </View>
            </View>

            {/* PIN Input Section */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputInstruction, { color: theme.textSecondary }]}>
                Enter the 4-digit code provided by the host to join:
              </Text>

              <TextInput
                ref={inputRef}
                value={pin}
                onChangeText={(t) => {
                  setPin(t.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  if (error) setError('');
                }}
                placeholder="••••"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="characters"
                maxLength={4}
                style={[
                  styles.pinInput,
                  {
                    backgroundColor: theme.surface,
                    color: theme.text,
                  },
                ]}
              />

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={theme.danger} />
                  <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                </View>
              ) : null}
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.surfaceHighlight,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleVerifyAndJoin}
                disabled={pin.trim().length === 0}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: pin.trim().length > 0 ? theme.accentCyan : theme.surfaceHighlight,
                    opacity: pressed || pin.trim().length === 0 ? 0.75 : 1,
                  },
                ]}>
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={pin.trim().length > 0 ? '#000000' : theme.textTertiary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      color: pin.trim().length > 0 ? '#000000' : theme.textTertiary,
                    },
                  ]}>
                  Unlock & Join
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 0,
    ...Shadows.elevated,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
  },
  scrollContent: {
    paddingBottom: Spacing.base,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  sheetTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  lockIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  roomName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    marginBottom: 4,
  },
  roomSubtitle: {
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputSection: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  inputInstruction: {
    fontSize: Typography.sizes.base,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  pinInput: {
    width: 180,
    height: 54,
    borderRadius: Radius.md,
    borderWidth: 0,
    fontSize: 24,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    letterSpacing: 10,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  errorText: {
    fontSize: Typography.sizes.xs,
    marginLeft: 6,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
  primaryButton: {
    flex: 2,
    height: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
  },
});
