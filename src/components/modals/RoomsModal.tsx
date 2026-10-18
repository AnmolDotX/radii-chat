import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Badge } from '../common/Badge';

interface RoomsModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateRoom: (name: string, description?: string, customCode?: string) => void;
  onJoinRoom: (code: string) => void;
}

export const RoomsModal: React.FC<RoomsModalProps> = ({
  visible,
  onClose,
  onCreateRoom,
  onJoinRoom,
}) => {
  const theme = useOrbitorTheme();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  
  // Create Room State
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  // Join Room State
  const [joinCode, setJoinCode] = useState('');

  const handleCreate = () => {
    if (!createName.trim()) return;
    onCreateRoom(createName.trim(), createDesc.trim(), createCode.trim() || undefined);
    setCreateName('');
    setCreateCode('');
    setCreateDesc('');
    onClose();
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase());
    setJoinCode('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          {/* Tabs */}
          <View style={styles.tabHeader}>
            <Pressable
              onPress={() => setMode('create')}
              style={({ pressed }) => [
                styles.tabItem,
                mode === 'create' && { borderBottomColor: theme.accentCyan, borderBottomWidth: 2 },
                pressed && { opacity: 0.8 },
              ]}>
              <Text
                style={[
                  styles.tabText,
                  { color: mode === 'create' ? theme.text : theme.textSecondary },
                ]}>
                Create Room
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMode('join')}
              style={({ pressed }) => [
                styles.tabItem,
                mode === 'join' && { borderBottomColor: theme.accentCyan, borderBottomWidth: 2 },
                pressed && { opacity: 0.8 },
              ]}>
              <Text
                style={[
                  styles.tabText,
                  { color: mode === 'join' ? theme.text : theme.textSecondary },
                ]}>
                Join Room
              </Text>
            </Pressable>
          </View>

          {mode === 'create' ? (
            <View style={styles.body}>
              <View style={styles.headerGroup}>
                <Text style={[styles.title, { color: theme.text }]}>Create Offline Room</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Start an offline broadcast channel for your campus wing, hackathon squad, or trek group.
                </Text>
              </View>

              <TextInput
                value={createName}
                onChangeText={setCreateName}
                placeholder="Room Name (e.g. Hostel 4 Wing B)"
                placeholderTextColor={theme.textTertiary}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <TextInput
                value={createCode}
                onChangeText={setCreateCode}
                placeholder="Custom 4-letter Code (Optional)"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="characters"
                maxLength={6}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <TextInput
                value={createDesc}
                onChangeText={setCreateDesc}
                placeholder="Topic / Description (Optional)"
                placeholderTextColor={theme.textTertiary}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <Pressable
                onPress={handleCreate}
                disabled={!createName.trim()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: createName.trim() ? theme.text : theme.surfaceElevated,
                    opacity: pressed || !createName.trim() ? 0.85 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: createName.trim() ? theme.background : theme.textTertiary },
                  ]}>
                  Create Offline Channel
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.body}>
              <View style={styles.headerGroup}>
                <Text style={[styles.title, { color: theme.text }]}>Join Room via Code</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Enter the 4–6 character room code shared by your friend or displayed on the campus bulletin.
                </Text>
              </View>

              <TextInput
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="e.g. H4-GF or TF26"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="characters"
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <Pressable
                onPress={handleJoin}
                disabled={!joinCode.trim()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: joinCode.trim() ? theme.accentCyan : theme.surfaceElevated,
                    opacity: pressed || !joinCode.trim() ? 0.85 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: joinCode.trim() ? theme.background : theme.textTertiary },
                  ]}>
                  Join Room Now
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.dismissButton,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text style={[styles.dismissText, { color: theme.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  tabText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
  },
  body: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  headerGroup: {
    gap: 4,
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  subtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
  },
  input: {
    width: '100%',
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
  codeInput: {
    width: '100%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: Typography.sizes.lg,
    fontFamily: Typography.monoFamily,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: Typography.weights.bold,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  primaryButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  dismissButton: {
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
});
