import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOrbitorTheme, Typography, Radius, Spacing, Layout } from '@/theme';
import { useOrbitor } from '@/context/OrbitorContext';
import { RadarSweep } from '@/components/radar/RadarSweep';
import { RadioPillBar } from '@/components/radar/RadioPillBar';
import { PeerAvatar } from '@/components/common/PeerAvatar';
import { Badge } from '@/components/common/Badge';
import { OutboxNotice } from '@/components/common/OutboxNotice';
import { ChatTeardropIcon, FileFlingIcon } from '@/components/common/ActionIcons';
import { SOSModal } from '@/components/modals/SOSModal';
import { QRMeshModal } from '@/components/modals/QRMeshModal';
import { ShareApkModal } from '@/components/modals/ShareApkModal';
import { RadioPermissionModal } from '@/components/modals/RadioPermissionModal';
import { ConnectionRequestModal } from '@/components/modals/ConnectionRequestModal';
import { ProfileSetupModal } from '@/components/modals/ProfileSetupModal';
import { ConnectPeerDialog } from '@/components/modals/ConnectPeerDialog';
import { PeerDetailSheet } from '@/components/modals/PeerDetailSheet';
import { Peer } from '@/core/types';

export default function RadarScreen({ onNavigateToFling }: { onNavigateToFling?: (peerId: string) => void }) {
  const theme = useOrbitorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    myProfile,
    updateUserProfile,
    peers,
    networkMode,
    setNetworkMode,
    autoUpgrade,
    setAutoUpgrade,
    outboxItems,
    triggerSOS,
    joinEventRoom,
    incomingRequest,
    acceptConnection,
    declineConnection,
    pairPeer,
  } = useOrbitor();

  const [sosVisible, setSosVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [apkVisible, setApkVisible] = useState(false);
  const [permVisible, setPermVisible] = useState(false);
  const [visibilitySheetVisible, setVisibilitySheetVisible] = useState(false);
  const [connectDialogPeer, setConnectDialogPeer] = useState<Peer | null>(null);
  const [detailPeer, setDetailPeer] = useState<Peer | null>(null);

  React.useEffect(() => {
    if (myProfile.visibility === 'everyone') {
      const timer = setTimeout(() => {
        updateUserProfile({ visibility: 'contacts' });
      }, 10 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [myProfile.visibility, updateUserProfile]);

  const unpairedRadarPeers = peers.filter((p) => !p.isPaired);
  const pairedPeers = peers.filter((p) => p.isPaired);

  const handleRadarPeerPress = (peer: Peer) => {
    setConnectDialogPeer(peer);
  };

  const handleRadarPeerLongPress = (peer: Peer) => {
    setDetailPeer(peer);
  };

  const handleOpenChat = (peer: Peer) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: peer.id, name: peer.name },
    });
  };

  const handleOpenFling = (peer: Peer) => {
    if (onNavigateToFling) {
      onNavigateToFling(peer.id);
    } else {
      router.push({
        pathname: '/fling' as any,
        params: { peerId: peer.id },
      });
    }
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Layout.tabBarHeight + insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Sleek, Minimal Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.titleRow}>
            <Text style={[styles.brandTitle, { color: theme.text }]}>Orbitor</Text>
            <View style={[styles.activeIndicator, { backgroundColor: theme.success }]} />
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setVisibilitySheetVisible(true)}
              style={({ pressed }) => [
                styles.visibilityPill,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <View
                style={[
                  styles.visibilityDot,
                  {
                    backgroundColor:
                      myProfile.visibility === 'everyone'
                        ? theme.accentCyan
                        : myProfile.visibility === 'contacts'
                        ? theme.success
                        : theme.textTertiary,
                  },
                ]}
              />
              <Text style={[styles.visibilityPillText, { color: theme.text }]}>
                {myProfile.visibility === 'everyone'
                  ? 'Visible (Everyone)'
                  : myProfile.visibility === 'contacts'
                  ? 'Contacts Only'
                  : 'Hidden'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setQrVisible(true)}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Text style={[styles.iconButtonText, { color: theme.text }]}>Pairing QR</Text>
            </Pressable>
          </View>
        </View>

        {/* Zero-leak Outbox Banner */}
        <OutboxNotice items={outboxItems} />

        {/* Minimal Central Radar Sweep showing UNPAIRED nearby peers */}
        <RadarSweep
          peers={unpairedRadarPeers}
          onSelectPeer={handleRadarPeerPress}
          onLongPressPeer={handleRadarPeerLongPress}
          isScanning={true}
        />

        {/* Minimal Radio Mode Capsule */}
        <RadioPillBar
          networkMode={networkMode}
          onSelectMode={setNetworkMode}
          autoUpgrade={autoUpgrade}
          onToggleAutoUpgrade={setAutoUpgrade}
        />

        {/* Section: Discovered / Connected Peers */}
        {pairedPeers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {unpairedRadarPeers.length > 0
                ? 'Nearby devices found on Radar'
                : 'Searching for nearby devices'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {unpairedRadarPeers.length > 0
                ? 'Tap any device above on the radar circle to pair and establish a secure offline link.'
                : 'Install Orbitor on a second phone within ~30 meters. Direct radio links establish automatically without internet.'}
            </Text>

            <View style={styles.emptyActionsRow}>
              <Pressable
                onPress={() => setPermVisible(true)}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  {
                    backgroundColor: theme.text,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text style={[styles.primaryActionText, { color: theme.background }]}>
                  Connect & Scan
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setQrVisible(true)}
                style={({ pressed }) => [
                  styles.secondaryActionButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Text style={[styles.secondaryActionText, { color: theme.text }]}>
                  Pairing QR
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.peersSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
                DISCOVERED & PAIRED PEERS ({pairedPeers.length})
              </Text>
            </View>

            <View style={styles.peersList}>
              {pairedPeers.map((peer) => (
                <View
                  key={peer.id}
                  style={[
                    styles.peerRow,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}>
                  <PeerAvatar peer={peer} size={42} showSignal={true} />

                  <View style={styles.peerInfo}>
                    <View style={styles.peerNameRow}>
                      <Text style={[styles.peerName, { color: theme.text }]}>
                        {peer.name}
                      </Text>
                      <Badge
                        label={peer.deviceName || peer.activeTransport.toUpperCase()}
                        variant="green"
                        size="sm"
                      />
                    </View>

                    <Text style={[styles.peerDistance, { color: theme.textTertiary }]}>
                      Paired · {peer.activeTransport.toUpperCase()} · {peer.rssi} dBm
                    </Text>
                  </View>

                  {/* Action buttons: Chat & File Fling */}
                  <View style={styles.peerActionButtons}>
                    <Pressable
                      onPress={() => handleOpenChat(peer)}
                      accessibilityLabel={`Chat with ${peer.name}`}
                      style={({ pressed }) => [
                        styles.actionCircleBtn,
                        {
                          backgroundColor: theme.surfaceElevated,
                          borderColor: theme.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <ChatTeardropIcon size={18} color={theme.text} />
                    </Pressable>

                    <Pressable
                      onPress={() => handleOpenFling(peer)}
                      accessibilityLabel={`Send file to ${peer.name}`}
                      style={({ pressed }) => [
                        styles.actionCircleBtn,
                        {
                          backgroundColor: theme.surfaceElevated,
                          borderColor: theme.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <FileFlingIcon size={18} color={theme.accentCyan} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Deliberate Emergency SOS Access */}
        <View style={styles.bottomSafetySection}>
          <Pressable
            onPress={() => setSosVisible(true)}
            style={({ pressed }) => [
              styles.safetyButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text style={[styles.safetyText, { color: theme.danger }]}>
              🚨 Emergency Offline Radio Broadcast (SOS)
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Visibility Quick Selector Modal */}
      <Modal
        visible={visibilitySheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisibilitySheetVisible(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.visibilitySheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.modalSheetTitle, { color: theme.text }]}>
              Nearby Radar Visibility
            </Text>
            <Text style={[styles.modalSheetSub, { color: theme.textSecondary }]}>
              Choose who can discover your device over Bluetooth and Wi-Fi Direct:
            </Text>

            <View style={styles.sheetOptionsList}>
              {(
                [
                  {
                    id: 'everyone',
                    title: 'Everyone Nearby (10 mins)',
                    desc: 'Visible to all nearby phones. Reverts to Contacts after 10 min.',
                  },
                  {
                    id: 'contacts',
                    title: 'Same Contacts Only',
                    desc: 'Only devices you have previously paired with can discover you.',
                  },
                  {
                    id: 'hidden',
                    title: 'Hidden',
                    desc: 'You can discover nearby peers, but your antenna stays silent.',
                  },
                ] as const
              ).map((opt) => {
                const isSelected = myProfile.visibility === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      updateUserProfile({ visibility: opt.id });
                      setVisibilitySheetVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.sheetOptionItem,
                      {
                        backgroundColor: isSelected
                          ? theme.surfaceHighlight
                          : theme.surfaceElevated,
                        borderColor: isSelected ? theme.accentCyan : theme.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}>
                    <View style={styles.sheetOptionTextWrap}>
                      <Text
                        style={[
                          styles.sheetOptionTitle,
                          {
                            color: isSelected ? theme.text : theme.textSecondary,
                            fontWeight: isSelected ? '600' : '400',
                          },
                        ]}>
                        {opt.title}
                      </Text>
                      <Text
                        style={[
                          styles.sheetOptionDesc,
                          { color: theme.textTertiary },
                        ]}>
                        {opt.desc}
                      </Text>
                    </View>
                    {isSelected && <Badge label="ACTIVE" variant="cyan" size="sm" />}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setVisibilitySheetVisible(false)}
              style={({ pressed }) => [
                styles.dismissBtn,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Text style={[styles.dismissBtnText, { color: theme.textSecondary }]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* First-load Profile & Device Setup Modal */}
      <ProfileSetupModal
        visible={!myProfile.isInitialSetupDone}
        profile={myProfile}
        onSave={(name, deviceName, visibility) => {
          updateUserProfile({ displayName: name, deviceName, visibility });
        }}
      />

      {/* Connect to Radar Peer Dialog */}
      <ConnectPeerDialog
        peer={connectDialogPeer}
        visible={connectDialogPeer !== null}
        onClose={() => setConnectDialogPeer(null)}
        onSuccess={(peer: Peer) => {
          pairPeer(peer.id);
        }}
      />

      {/* Long-press Peer Details Sheet */}
      <PeerDetailSheet
        peer={detailPeer}
        visible={detailPeer !== null}
        onClose={() => setDetailPeer(null)}
        onConnect={(peer) => {
          setDetailPeer(null);
          setConnectDialogPeer(peer);
        }}
      />

      {/* Emergency SOS Modal */}
      <SOSModal
        visible={sosVisible}
        onClose={() => setSosVisible(false)}
        onBroadcastSOS={triggerSOS}
      />

      {/* QR Mesh Pairing Modal */}
      <QRMeshModal
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        myProfileName={myProfile.displayName}
        onJoinCode={joinEventRoom}
      />

      {/* Share APK Modal */}
      <ShareApkModal
        visible={apkVisible}
        onClose={() => setApkVisible(false)}
        onStartApkFling={() => {}}
      />

      {/* Radio Permissions Modal */}
      <RadioPermissionModal
        visible={permVisible}
        onClose={() => setPermVisible(false)}
        onConfirm={() => {}}
      />

        {/* Two-Way Connection Acceptance Modal */}
        <ConnectionRequestModal
          request={incomingRequest}
          onAccept={acceptConnection}
          onDecline={declineConnection}
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    maxWidth: Layout.maxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
    fontFamily: Typography.fontFamily,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  iconButton: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  iconButtonText: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
  },
  visibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  visibilityDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  visibilityPillText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
  },
  bottomSafetySection: {
    marginTop: Spacing.base,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  safetyButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  safetyText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  visibilitySheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalSheetTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  modalSheetSub: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
  },
  sheetOptionsList: {
    gap: Spacing.sm,
  },
  sheetOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm + 3,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  sheetOptionTextWrap: {
    flex: 1,
    gap: 2,
  },
  sheetOptionTitle: {
    fontSize: Typography.sizes.xs + 2,
    fontFamily: Typography.fontFamily,
  },
  sheetOptionDesc: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 14,
  },
  dismissBtn: {
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs + 3,
  },
  emptyTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryActionButton: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
  },
  primaryActionText: {
    fontSize: Typography.sizes.xs + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  secondaryActionButton: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
  },
  peersSection: {
    gap: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  sectionHeaderRow: {
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  peersList: {
    gap: Spacing.xs + 2,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  peerInfo: {
    flex: 1,
    gap: 2,
  },
  peerActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  actionCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  peerName: {
    fontSize: Typography.sizes.sm + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  peerDistance: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
  },
});
