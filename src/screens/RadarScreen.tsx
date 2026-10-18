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
import { transportManager } from '@/transport/TransportManager';
import { RadarSweep } from '@/components/radar/RadarSweep';
import { PeerAvatar } from '@/components/common/PeerAvatar';
import { Badge } from '@/components/common/Badge';
import { OutboxNotice } from '@/components/common/OutboxNotice';
import { ChatTeardropIcon, FileFlingIcon } from '@/components/common/ActionIcons';
import { Ionicons } from '@expo/vector-icons';
import { SOSModal } from '@/components/modals/SOSModal';
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
    rescan,
    isScanning,
    permissionsGranted,
    setPermissionsGranted,
  } = useOrbitor();

  const [sosVisible, setSosVisible] = useState(false);
  const [permVisible, setPermVisible] = useState(false);
  const [visibilitySheetVisible, setVisibilitySheetVisible] = useState(false);
  const [connectDialogPeer, setConnectDialogPeer] = useState<Peer | null>(null);
  const [detailPeer, setDetailPeer] = useState<Peer | null>(null);

  // New View Controls: Radar vs List View & Max peers to display filter
  const [viewMode, setViewMode] = useState<'radar' | 'list'>('radar');
  const [maxPeersFilter, setMaxPeersFilter] = useState<number | 'all'>(10);
  const [isRadioActive, setIsRadioActive] = useState<boolean>(true);

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
            <Text style={[styles.brandTitle, { color: theme.text }]}>Radii</Text>
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

          </View>
        </View>

        {/* Central Mode Switcher: Offline Connection vs Online Connection */}
        <Pressable
          onPress={() => setNetworkMode(networkMode === 'offline' ? 'online' : 'offline')}
          accessibilityRole="button"
          accessibilityLabel={`Current mode: ${networkMode === 'offline' ? 'Offline Connection' : 'Online Connection'}. Tap to switch.`}
          style={({ pressed }) => [
            styles.modeSwitcherBanner,
            {
              backgroundColor: theme.surface,
              borderColor: networkMode === 'offline' ? theme.border : theme.accentCyan,
              opacity: pressed ? 0.82 : 1,
            },
          ]}>
          <View style={styles.modeSwitcherLeft}>
            <View
              style={[
                styles.pulseDot,
                {
                  backgroundColor:
                    networkMode === 'offline' ? theme.success : theme.accentCyan,
                },
              ]}
            />
            <View style={styles.modeSwitcherTextCol}>
              <View style={styles.modeSwitcherTitleRow}>
                <Text style={[styles.modeSwitcherTitle, { color: theme.text }]}>
                  {networkMode === 'offline' ? 'Offline Connection' : 'Online Connection'}
                </Text>
                <Badge
                  label={networkMode === 'offline' ? 'BLE & NEARBY' : 'LOCATION GPS'}
                  variant={networkMode === 'offline' ? 'green' : 'cyan'}
                  size="sm"
                />
              </View>
              <Text style={[styles.modeSwitcherSubtitle, { color: theme.textSecondary }]}>
                {networkMode === 'offline'
                  ? 'Antenna mesh (Bluetooth & Nearby) · Zero internet'
                  : 'Proximity-based discovery using device location'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.modeSwitchActionPill,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}>
            <Text
              style={[
                styles.modeSwitchActionText,
                { color: networkMode === 'offline' ? theme.accentCyan : theme.accentBlue },
              ]}>
              {networkMode === 'offline' ? 'Switch Online ↗' : 'Switch Offline ↗'}
            </Text>
          </View>
        </Pressable>

        {/* View Controls Toolbar: Radar vs List View & Max Displayed Peers */}
        <View style={[styles.controlBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Left: View Mode Segment */}
          <View style={styles.viewSegment}>
            <Pressable
              onPress={() => setViewMode('radar')}
              style={[
                styles.segmentBtn,
                viewMode === 'radar' && { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              ]}>
              <Ionicons
                name="radio"
                size={14}
                color={viewMode === 'radar' ? theme.accentCyan : theme.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: viewMode === 'radar' ? theme.text : theme.textSecondary, fontWeight: viewMode === 'radar' ? '600' : '400' },
                ]}>
                Radar
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setViewMode('list')}
              style={[
                styles.segmentBtn,
                viewMode === 'list' && { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              ]}>
              <Ionicons
                name="list"
                size={14}
                color={viewMode === 'list' ? theme.accentCyan : theme.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: viewMode === 'list' ? theme.text : theme.textSecondary, fontWeight: viewMode === 'list' ? '600' : '400' },
                ]}>
                List
              </Text>
            </Pressable>
          </View>

          {/* Right: Max Peers Filter Pills */}
          <View style={styles.filterPills}>
            <Text style={[styles.filterLabel, { color: theme.textTertiary }]}>MAX:</Text>
            {([5, 10, 20, 'all'] as const).map((count) => {
              const isSelected = maxPeersFilter === count;
              return (
                <Pressable
                  key={String(count)}
                  onPress={() => setMaxPeersFilter(count)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isSelected ? theme.text : theme.surfaceElevated,
                      borderColor: isSelected ? theme.text : theme.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: isSelected ? theme.background : theme.textSecondary },
                    ]}>
                    {count === 'all' ? 'ALL' : count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Zero-leak Outbox Banner */}
        <OutboxNotice items={outboxItems} />

        {/* Dynamic Display: Radar View OR List View */}
        {viewMode === 'radar' ? (
          <RadarSweep
            peers={maxPeersFilter === 'all' ? unpairedRadarPeers : unpairedRadarPeers.slice(0, maxPeersFilter)}
            onSelectPeer={handleRadarPeerPress}
            onLongPressPeer={handleRadarPeerLongPress}
            isScanning={isScanning}
            onPressRadar={!isScanning ? rescan : undefined}
          />
        ) : (
          <View style={[styles.radarListView, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.listHeaderRow}>
              <Text style={[styles.listHeaderTitle, { color: theme.textSecondary }]}>
                NEARBY DISCOVERED PEERS ({unpairedRadarPeers.length})
              </Text>
              <Badge label="LOCAL RADIO SCAN" variant="cyan" size="sm" />
            </View>

            {unpairedRadarPeers.length === 0 ? (
              <View style={styles.emptyListWrap}>
                <Text style={[styles.emptyListText, { color: theme.textTertiary }]}>
                  Searching nearby radius over BLE & Wi-Fi Direct...
                </Text>
              </View>
            ) : (
              (maxPeersFilter === 'all' ? unpairedRadarPeers : unpairedRadarPeers.slice(0, maxPeersFilter)).map((peer) => (
                <View
                  key={peer.id}
                  style={[styles.peerListItem, { borderBottomColor: theme.border }]}>
                  <PeerAvatar peer={peer} size={40} showSignal={true} />
                  <View style={styles.peerListInfo}>
                    <View style={styles.peerListNameRow}>
                      <Text style={[styles.peerListName, { color: theme.text }]}>{peer.name}</Text>
                      <Badge label={peer.activeTransport.toUpperCase()} variant="cyan" size="sm" />
                    </View>
                    <Text style={[styles.peerListMeta, { color: theme.textTertiary }]}>
                      {peer.rssi} dBm · ~{peer.distanceBracket === 'immediate' ? '1-3m' : peer.distanceBracket === 'near' ? '5-10m' : '15-30m'} · {peer.deviceName || 'Local Mesh'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRadarPeerPress(peer)}
                    style={({ pressed }) => [
                      styles.quickPairBtn,
                      { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 },
                    ]}>
                    <Text style={[styles.quickPairBtnText, { color: theme.background }]}>Pair</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* Section: Discovered / Connected Peers */}
        {pairedPeers.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.emptyStatusBadge, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={[styles.pulseDot, { backgroundColor: permissionsGranted ? (isScanning ? theme.success : theme.accentCyan) : theme.warning }]} />
              <Text style={[styles.emptyStatusBadgeText, { color: permissionsGranted ? (isScanning ? theme.success : theme.textSecondary) : theme.warning }]}>
                {permissionsGranted
                  ? isScanning
                    ? `SCANNING ACTIVE · ${unpairedRadarPeers.length} DETECTED`
                    : `SCAN TIMEOUT · ${unpairedRadarPeers.length} FOUND`
                  : 'OFFLINE RADIOS DISABLED'}
              </Text>
            </View>

            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {unpairedRadarPeers.length > 0
                ? `${unpairedRadarPeers.length} Companion${unpairedRadarPeers.length === 1 ? '' : 's'} on Radar`
                : permissionsGranted
                ? isScanning
                  ? 'Scanning Offline Spectrum'
                  : 'Scan Complete · Ready to Rescan'
                : 'Enable Radios to Start Scanning'}
            </Text>

            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {unpairedRadarPeers.length > 0
                ? 'Tap any companion blip on the radar sweep circle above to pair and start chatting.'
                : permissionsGranted
                ? isScanning
                  ? 'Radii is broadcasting and scanning over Bluetooth & offline mesh. Companions within range appear automatically.'
                  : 'Scanning timed out to preserve device battery. Tap "Rescan Nearby" to scan the radio spectrum again.'
                : 'Grant Bluetooth, Location, and Nearby permissions so Radii can discover companions around you.'}
            </Text>

            {/* Live Metrics / Range info row */}
            {permissionsGranted && (
              <View style={styles.metricsRow}>
                <View style={[styles.metricChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Ionicons name="radio-outline" size={12} color={theme.accentCyan} />
                  <Text style={[styles.metricChipText, { color: theme.textSecondary }]}>
                    Range: ≤ 10m ideal
                  </Text>
                </View>
                <View style={[styles.metricChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Ionicons name="hardware-chip-outline" size={12} color={theme.success} />
                  <Text style={[styles.metricChipText, { color: theme.textSecondary }]}>
                    BLE + Mesh
                  </Text>
                </View>
                <View style={[styles.metricChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Ionicons name="people-outline" size={12} color={theme.accentBlue} />
                  <Text style={[styles.metricChipText, { color: theme.textSecondary }]}>
                    {unpairedRadarPeers.length} Found
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.emptyActionsRow}>
              {!permissionsGranted ? (
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
                    Grant & Enable Radios
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    rescan();
                  }}
                  style={({ pressed }) => [
                    styles.primaryActionButton,
                    {
                      backgroundColor: theme.text,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <Ionicons name="refresh" size={14} color={theme.background} style={{ marginRight: 6 }} />
                  <Text style={[styles.primaryActionText, { color: theme.background }]}>
                    {isScanning ? 'Scanning...' : 'Rescan Nearby'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.peersSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
                DISCOVERED & PAIRED PEERS ({pairedPeers.length})
              </Text>
              <Pressable
                onPress={() => rescan()}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.rescanHeaderBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}>
                <Ionicons name="refresh-outline" size={13} color={theme.accentCyan} />
                <Text style={[styles.rescanHeaderBtnText, { color: theme.accentCyan }]}>Rescan</Text>
              </Pressable>
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
          setPermissionsGranted(true);
          transportManager.start();
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

      {/* Radio Permissions Modal */}
      <RadioPermissionModal
        visible={permVisible}
        visibilityMode={myProfile.visibility}
        onClose={() => setPermVisible(false)}
        onConfirm={() => {
          updateUserProfile({ visibility: 'everyone' });
          setIsRadioActive(true);
          setPermissionsGranted(true);
          transportManager.start();
        }}
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
  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.xs + 3,
  },
  emptyStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: 4,
  },
  emptyStatusBadgeText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
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
    maxWidth: 320,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  metricChipText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.medium,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  rescanHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  rescanHeaderBtnText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
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
  modeSwitcherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 1,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  modeSwitcherLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  modeSwitcherTextCol: {
    flex: 1,
    gap: 2,
  },
  modeSwitcherTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeSwitcherTitle: {
    fontSize: Typography.sizes.xs + 2,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  modeSwitcherSubtitle: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 14,
  },
  modeSwitchActionPill: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  modeSwitchActionText: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  viewSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  filterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterLabel: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
    marginRight: 2,
  },
  filterPill: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
  },
  radarListView: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
  },
  listHeaderTitle: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  emptyListWrap: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  peerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  peerListInfo: {
    flex: 1,
    gap: 3,
  },
  peerListNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  peerListName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  peerListMeta: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
  },
  quickPairBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
  },
  quickPairBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
});
