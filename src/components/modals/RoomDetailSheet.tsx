import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { EventRoom, Peer } from '../../core/types';
import { Badge } from '../common/Badge';
import { getLocalProfile } from '../../core/identity';

interface RoomDetailSheetProps {
  room: EventRoom | null;
  visible: boolean;
  onClose: () => void;
  peers: Peer[];
  onLeaveRoom: () => void;
}

export const RoomDetailSheet: React.FC<RoomDetailSheetProps> = ({
  room,
  visible,
  onClose,
  peers,
  onLeaveRoom,
}) => {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();

  if (!room) return null;

  const profile = getLocalProfile();
  const myShort = profile.id.slice(-6).toLowerCase();
  const isOwner = Boolean(
    room.creatorId &&
      (room.creatorId === profile.id ||
        room.creatorId === `peer_${myShort}` ||
        room.creatorId.toLowerCase().endsWith(myShort))
  );

  const totalMembers = room.memberCount || (room.members?.length || 1);

  const handleAction = () => {
    if (isOwner) {
      Alert.alert(
        'Delete Room',
        `Are you sure you want to delete ${room.name}? Everyone will be removed and the broadcast room will be closed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Room',
            style: 'destructive',
            onPress: () => {
              onClose();
              onLeaveRoom();
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Leave Room',
        `Are you sure you want to leave ${room.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave Room',
            style: 'destructive',
            onPress: () => {
              onClose();
              onLeaveRoom();
            },
          },
        ]
      );
    }
  };

  const sheetBottomPadding =
    (Platform.OS === 'android' ? Math.max(insets.bottom, 48) : Math.max(insets.bottom, 16)) +
    Spacing.base;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop tap to close */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close room details"
          accessibilityRole="button"
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: sheetBottomPadding,
            },
          ]}>
          {/* Top Bar with Title and Cross Icon */}
          <View style={styles.topBar}>
            <View style={{ width: 36 }} />
            <Text style={[styles.sheetTitle, { color: theme.textTertiary }]}>
              MESH ROOM DETAILS
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          {/* Room Header Info */}
          <View style={styles.header}>
            <View
              style={[
                styles.groupIconCircle,
                { backgroundColor: theme.surfaceElevated },
              ]}>
              <Ionicons name="people" size={32} color={theme.accentCyan} />
            </View>
            <Text style={[styles.name, { color: theme.text }]}>{room.name}</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {room.description || 'Offline LAN & Direct Radio Channel'}
            </Text>
          </View>

          {/* Specs / Meta Box */}
          <View style={[styles.specsBox, { backgroundColor: theme.surfaceElevated }]}>
            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Room Code</Text>
              <Badge label={room.code} variant="cyan" size="md" />
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Radio Members</Text>
              <Text style={[styles.specValue, { color: theme.success }]}>
                {totalMembers} Active ({totalMembers} joined)
              </Text>
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Role</Text>
              <Badge
                label={isOwner ? 'Host (Owner)' : 'Member'}
                variant={isOwner ? 'cyan' : 'neutral'}
                size="sm"
              />
            </View>

            <View style={styles.specRow}>
              <Text style={[styles.specLabel, { color: theme.textTertiary }]}>Mesh Broadcast</Text>
              <Text style={[styles.specValue, { color: theme.text }]}>
                Zero Internet · Direct Packets
              </Text>
            </View>
          </View>

          {/* Joined Members Section */}
          <View style={styles.peersSection}>
            <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>
              JOINED MEMBERS ({totalMembers})
            </Text>
            <View style={styles.peerPillsRow}>
              {/* Creator Pill */}
              <View
                style={[
                  styles.peerPill,
                  { backgroundColor: theme.surfaceElevated },
                ]}>
                <View style={[styles.dot, { backgroundColor: theme.accentCyan }]} />
                <Text numberOfLines={1} style={[styles.peerPillText, { color: theme.text }]}>
                  {room.creatorName || 'Host'}
                </Text>
                <Badge label="Host" variant="cyan" size="sm" />
              </View>

              {/* Other Joined Members */}
              {(room.members || [])
                .filter((m) => {
                  const creatorShort = room.creatorId ? room.creatorId.slice(-6).toLowerCase() : '';
                  return m !== creatorShort;
                })
                .map((mShort) => {
                  const memberName = room.memberNames?.[mShort] || `Peer ${mShort.toUpperCase()}`;
                  return (
                    <View
                      key={mShort}
                      style={[
                        styles.peerPill,
                        { backgroundColor: theme.surfaceElevated },
                      ]}>
                      <View style={[styles.dot, { backgroundColor: theme.success }]} />
                      <Text numberOfLines={1} style={[styles.peerPillText, { color: theme.text }]}>
                        {memberName}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </View>

          {/* Leave or Delete Room Action Button */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleAction}
              style={({ pressed }) => [
                styles.leaveButton,
                {
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Ionicons
                name={isOwner ? 'trash-outline' : 'exit-outline'}
                size={18}
                color={theme.danger}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.leaveText, { color: theme.danger }]}>
                {isOwner ? 'Delete & Close Room' : 'Leave Room'}
              </Text>
            </Pressable>
            {isOwner && (
              <Text style={[styles.ownerWarningText, { color: theme.textTertiary }]}>
                As the owner, deleting this room will remove all members and end the mesh broadcast.
              </Text>
            )}
          </View>
        </View>
      </View>
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
    gap: Spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  sheetTitle: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  groupIconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    ...Shadows.subtle,
  },
  name: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  description: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  specsBox: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.subtle,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  specLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  specValue: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.medium,
  },
  peersSection: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    letterSpacing: 0.5,
  },
  peerPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  peerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 0,
    maxWidth: 180,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  peerPillText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  actionsRow: {
    marginTop: Spacing.xs,
    gap: 6,
  },
  leaveButton: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.subtle,
  },
  leaveText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  ownerWarningText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
});
