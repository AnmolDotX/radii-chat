import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { Badge } from '../common/Badge';
import { EventRoom } from '../../core/types';

interface RoomsModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateRoom: (name: string, description?: string, customCode?: string) => void;
  onJoinRoom?: (code: string) => void;
  eventRooms?: EventRoom[];
  connectedPeersCount?: number;
}

export const RoomsModal: React.FC<RoomsModalProps> = ({
  visible,
  onClose,
  onCreateRoom,
  connectedPeersCount = 0,
}) => {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // Create Room State
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  // Auto-generate preview 4-digit code for creation
  const suggestedCode = useMemo(() => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }, [visible]);

  const handleCreate = () => {
    if (!createName.trim()) return;
    const finalCode = (createCode.trim() || suggestedCode).toUpperCase();
    onCreateRoom(createName.trim(), createDesc.trim(), finalCode);
    setCreateName('');
    setCreateCode('');
    setCreateDesc('');
    onClose();
  };

  const isKeyboardOpen = keyboardHeight > 0;
  const maxSheetHeight = isKeyboardOpen
    ? Math.max(300, windowHeight - keyboardHeight - (insets.top || 24) - 20)
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
          accessibilityLabel="Close create room modal"
          accessibilityRole="button"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              maxHeight: maxSheetHeight,
              marginBottom: isKeyboardOpen && Platform.OS === 'android' ? keyboardHeight : 0,
              paddingBottom: sheetBottomPadding,
            },
          ]}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={{ width: 32 }} />
            <Text style={[styles.sheetTitle, { color: theme.textTertiary }]}>
              CREATE MESH ROOM
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

          {/* Radio Companion Presence Pill */}
          <View style={[styles.presencePill, { backgroundColor: theme.surfaceHighlight }]}>
            <View
              style={[
                styles.presenceDot,
                { backgroundColor: connectedPeersCount > 0 ? theme.success : theme.textTertiary },
              ]}
            />
            <Text style={[styles.presenceText, { color: theme.textSecondary }]}>
              {connectedPeersCount > 0
                ? `${connectedPeersCount} companion${connectedPeersCount === 1 ? '' : 's'} in radio range`
                : 'Zero companions in range · Broadcast ready'}
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={false}
            contentContainerStyle={styles.scrollBody}>
            <View style={styles.body}>
              <View style={styles.headerGroup}>
                <Text style={[styles.title, { color: theme.text }]}>New Broadcast Room</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Broadcast a local mesh channel over antenna radio. Nearby companions can discover this room and join using your 4-digit PIN.
                </Text>
              </View>

              {/* Room Name Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Room Name *</Text>
                <TextInput
                  value={createName}
                  onChangeText={setCreateName}
                  placeholder="e.g. Hostel Wing B or Hackathon Team"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceElevated,
                      color: theme.text,
                    },
                  ]}
                />
              </View>

              {/* Room PIN Code Input */}
              <View style={styles.inputGroup}>
                <View style={styles.codeLabelRow}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    4-Digit Room PIN
                  </Text>
                  <Badge label="Required to Join" variant="cyan" size="sm" />
                </View>
                <TextInput
                  value={createCode}
                  onChangeText={(t) => setCreateCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder={suggestedCode}
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="characters"
                  maxLength={6}
                  style={[
                    styles.input,
                    styles.codeInput,
                    {
                      backgroundColor: theme.surfaceElevated,
                      color: theme.text,
                    },
                  ]}
                />
                <Text style={[styles.hintText, { color: theme.textTertiary }]}>
                  Default generated: <Text style={{ color: theme.accentCyan, fontWeight: 'bold' }}>{suggestedCode}</Text>. Share this PIN with companions so they can enter the room.
                </Text>
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Topic / Purpose (Optional)
                </Text>
                <TextInput
                  value={createDesc}
                  onChangeText={setCreateDesc}
                  placeholder="e.g. Direct offline broadcast group"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceElevated,
                      color: theme.text,
                    },
                  ]}
                />
              </View>

              {/* Security Banner */}
              <View style={[styles.infoBanner, { backgroundColor: theme.surfaceElevated }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={theme.accentCyan} />
                <Text style={[styles.infoBannerText, { color: theme.textSecondary }]}>
                  Rooms in range require this 4-digit PIN to join. No unverified peer can access your group chat.
                </Text>
              </View>

              {/* Create Button */}
              <Pressable
                onPress={handleCreate}
                disabled={!createName.trim()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: createName.trim() ? theme.accentCyan : theme.surfaceHighlight,
                    opacity: pressed || !createName.trim() ? 0.75 : 1,
                  },
                ]}>
                <Ionicons
                  name="radio-outline"
                  size={18}
                  color={createName.trim() ? '#FFFFFF' : theme.textTertiary}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: createName.trim() ? '#FFFFFF' : theme.textTertiary },
                  ]}>
                  Create & Broadcast Room
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
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
  presencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    gap: 6,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presenceText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
  scrollBody: {
    paddingBottom: Spacing.lg,
  },
  body: {
    gap: Spacing.md,
  },
  headerGroup: {
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    lineHeight: 18,
  },
  inputGroup: {
    gap: 6,
  },
  codeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 0,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.base,
  },
  codeInput: {
    fontWeight: Typography.weights.bold,
    letterSpacing: 4,
    fontSize: 18,
  },
  hintText: {
    fontSize: 11,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  primaryButton: {
    height: 50,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  primaryButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
  },
});
