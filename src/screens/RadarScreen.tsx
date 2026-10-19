import React, { useState, useCallback, useMemo } from 'react';
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
import { useOrbitorTheme, Typography, Radius, Spacing, Layout, Shadows } from '@/theme';
import { useOrbitor } from '@/context/OrbitorContext';
import { transportManager } from '@/transport/TransportManager';
import { normalizePeerId } from '@/transport/NativeRadioTransport';
import { RadarSweep } from '@/components/radar/RadarSweep';
import { PeerAvatar } from '@/components/common/PeerAvatar';
import { Badge } from '@/components/common/Badge';
import { OutboxNotice } from '@/components/common/OutboxNotice';
import { ChatTeardropIcon } from '@/components/common/ActionIcons';
import { Ionicons } from '@expo/vector-icons';
import { RadioPermissionModal } from '@/components/modals/RadioPermissionModal';
import { ConnectionRequestModal } from '@/components/modals/ConnectionRequestModal';
import { ProfileSetupModal } from '@/components/modals/ProfileSetupModal';
import { ConnectPeerDialog } from '@/components/modals/ConnectPeerDialog';
import { PeerDetailSheet } from '@/components/modals/PeerDetailSheet';
import { Peer } from '@/core/types';

export default function RadarScreen() {
  const theme = useOrbitorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    myProfile,
    updateUserProfile,
    peers,
    savedPeers,
    networkMode,
    setNetworkMode,
    autoUpgrade,
    setAutoUpgrade,
    outboxItems,
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

  const [permVisible, setPermVisible] = useState(false);
  const [visibilitySheetVisible, setVisibilitySheetVisible] = useState(false);
  const [connectDialogPeer, setConnectDialogPeer] = useState<Peer | null>(null);
  const [detailPeer, setDetailPeer] = useState<Peer | null>(null);

  // View Controls
  const [viewMode, setViewMode] = useState<'radar' | 'list'>('radar');
  const [maxPeersFilter, setMaxPeersFilter] = useState<number | 'all'>(10);
  const [isRadioActive, setIsRadioActive] = useState<boolean>(true);

  // Determine if a peer is already saved or paired
  const isPeerSavedOrPaired = useCallback((p: Peer) => {
    if (p.isPaired) return true;
    const canonicalId = normalizePeerId(p.id);
    const shortId = (p.shortId || canonicalId.slice(-6)).toLowerCase();
    return savedPeers.some(
      (sp) => sp.id === canonicalId || sp.id.toLowerCase().endsWith(shortId)
    );
  }, [savedPeers]);

  // Only unpaired live peers in radio range appear as discoverable blips on the radar sweep & list
  const liveRadarPeers = useMemo(
    () => peers.filter((p) => !isPeerSavedOrPaired(p) && p.distanceBracket !== 'out_of_range'),
    [peers, isPeerSavedOrPaired]
  );

  // Paired / Connected companions reconciliation
  const connectedCompanions = useMemo(() => {
    const map = new Map<string, { peer: Peer; isOnline: boolean }>();
    savedPeers.forEach((p) => {
      const canonicalId = normalizePeerId(p.id);
      map.set(canonicalId, { peer: { ...p, id: canonicalId, isPaired: true }, isOnline: false });
    });
    peers.forEach((p) => {
      const canonicalId = normalizePeerId(p.id);
      const isOnline = p.distanceBracket !== 'out_of_range';
      if (map.has(canonicalId)) {
        const existing = map.get(canonicalId)!;
        map.set(canonicalId, {
          peer: { ...existing.peer, ...p, id: canonicalId, isPaired: true },
          isOnline,
        });
      } else if (p.isPaired) {
        map.set(canonicalId, { peer: p, isOnline });
      }
    });
    return Array.from(map.values());
  }, [savedPeers, peers]);

  const handleRadarPeerPress = (peer: Peer) => {
    if (isPeerSavedOrPaired(peer)) {
      handleOpenChat(peer);
    } else {
      setConnectDialogPeer(peer);
    }
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

        {/* View Controls Toolbar: Radar vs List View & Max Displayed Peers */}
        <View style={[styles.controlBar, { backgroundColor: theme.surface }]}>
          {/* Left: View Mode Segment */}
          <View style={styles.viewSegment}>
            <Pressable
              onPress={() => setViewMode('radar')}
              style={[
                styles.segmentBtn,
                viewMode === 'radar' && { backgroundColor: theme.surfaceElevated },
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
                viewMode === 'list' && { backgroundColor: theme.surfaceElevated },
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
            peers={maxPeersFilter === 'all' ? liveRadarPeers : liveRadarPeers.slice(0, maxPeersFilter)}
            onSelectPeer={handleRadarPeerPress}
            onLongPressPeer={handleRadarPeerLongPress}
            isScanning={isScanning}
            onPressRadar={!isScanning ? rescan : undefined}
          />
        ) : (
          <View style={[styles.radarListView, { backgroundColor: theme.surface }]}>
            <View style={styles.listHeaderRow}>
              <Text style={[styles.listHeaderTitle, { color: theme.textSecondary }]}>
                NEARBY DISCOVERED PEERS ({liveRadarPeers.length})
              </Text>
              <Badge label="LOCAL RADIO SCAN" variant="cyan" size="sm" />
            </View>

            {liveRadarPeers.length === 0 ? (
              <View style={styles.emptyListWrap}>
                <Text style={[styles.emptyListText, { color: theme.textTertiary }]}>
                  Searching nearby radius over BLE & Wi-Fi Direct...
                </Text>
              </View>
            ) : (
              (maxPeersFilter === 'all' ? liveRadarPeers : liveRadarPeers.slice(0, maxPeersFilter)).map((peer: Peer) => (
                <View
                  key={peer.id}
                  style={styles.peerListItem}>
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
                    <Text style={[styles.quickPairBtnText, { color: theme.background }]}>
                      {isPeerSavedOrPaired(peer) ? 'Chat' : 'Pair'}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* Section: Radar Spectrum Summary & Controls */}
        <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
            <View style={[styles.emptyStatusBadge, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.pulseDot, { backgroundColor: permissionsGranted ? (isScanning ? theme.success : theme.accentCyan) : theme.warning }]} />
              <Text style={[styles.emptyStatusBadgeText, { color: permissionsGranted ? (isScanning ? theme.success : theme.textSecondary) : theme.warning }]}>
                {permissionsGranted
                  ? isScanning
                    ? `SCANNING ACTIVE · ${liveRadarPeers.length} DETECTED`
                    : `SCAN TIMEOUT · ${liveRadarPeers.length} FOUND`
                  : 'OFFLINE RADIOS DISABLED'}
              </Text>
            </View>

            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {liveRadarPeers.length > 0
                ? `${liveRadarPeers.length} Companion${liveRadarPeers.length === 1 ? '' : 's'} on Radar`
                : permissionsGranted
                ? isScanning
                  ? 'Scanning Offline Spectrum'
                  : 'Scan Complete · Ready to Rescan'
                : 'Enable Radios to Start Scanning'}
            </Text>

            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {liveRadarPeers.length > 0
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
                <View style={[styles.metricChip, { backgroundColor: theme.surfaceElevated }]}>
                  <Ionicons name="radio-outline" size={12} color={theme.accentCyan} />
                  <Text style={[styles.metricChipText, { color: theme.textSecondary }]}>
                    Range: ≤ 10m ideal
                  </Text>
                </View>
                <View style={[styles.metricChip, { backgroundColor: theme.surfaceElevated }]}>
                  <Ionicons name="hardware-chip-outline" size={12} color={theme.success} />
                  <Text style={[styles.metricChipText, { color: theme.textSecondary }]}>
                    BLE + Mesh
                  </Text>
                </View>
                <View style={[styles.metricChip, { backgroundColor: theme.surfaceElevated }]}>
                  <Ionicons name="people-outline" size={12} color={theme.accentBlue} />
                  <Text style={[styles.metricChipText, { color: theme.textSecondary }]}>
                    {liveRadarPeers.length} Found
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

        {/* PAIRED & SAVED COMPANIONS LIST */}
        {connectedCompanions.length > 0 && (
          <View style={styles.peersSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
                PAIRED COMPANIONS ({connectedCompanions.length})
              </Text>
              <Pressable
                onPress={() => rescan()}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.rescanHeaderBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}>
                <Ionicons name="refresh-outline" size={13} color={theme.accentCyan} />
                <Text style={[styles.rescanHeaderBtnText, { color: theme.accentCyan }]}>Scan Radio</Text>
              </Pressable>
            </View>

            <View style={styles.peersList}>
              {connectedCompanions.map(({ peer, isOnline }: { peer: Peer; isOnline: boolean }) => (
                <View
                  key={peer.id}
                  style={[
                    styles.peerRow,
                    {
                      backgroundColor: theme.surface,
                    },
                  ]}>
                  <PeerAvatar peer={peer} size={42} showSignal={isOnline} />

                  <View style={styles.peerInfo}>
                    <View style={styles.peerNameRow}>
                      <Text style={[styles.peerName, { color: theme.text }]}>
                        {peer.name}
                      </Text>
                      <Badge
                        label={isOnline ? (peer.activeTransport || 'nearby').toUpperCase() : 'OFFLINE'}
                        variant={isOnline ? 'green' : 'neutral'}
                        size="sm"
                      />
                    </View>

                    <Text style={[styles.peerDistance, { color: theme.textTertiary }]}>
                      {isOnline
                        ? `In Range · ${peer.rssi} dBm · Direct Link`
                        : 'Offline · Out of range'}
                    </Text>
                  </View>

                  <View style={styles.peerActionButtons}>
                    <Pressable
                      onPress={() => handleOpenChat(peer)}
                      accessibilityLabel={`Chat with ${peer.name}`}
                      style={({ pressed }) => [
                        styles.actionCircleBtn,
                        {
                          backgroundColor: theme.surfaceElevated,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <ChatTeardropIcon size={18} color={theme.text} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
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
              { backgroundColor: theme.surface },
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
    borderWidth: 0,
    ...Shadows.subtle,
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
    borderWidth: 0,
    ...Shadows.subtle,
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
    borderWidth: 0,
  },
  safetyText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  visibilitySheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xl,
    borderWidth: 0,
    ...Shadows.elevated,
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
    borderWidth: 0,
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
    borderWidth: 0,
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
    borderWidth: 0,
    ...Shadows.card,
    gap: Spacing.xs + 3,
  },
  emptyStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    borderWidth: 0,
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
    borderWidth: 0,
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
    borderWidth: 0,
    ...Shadows.subtle,
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
    borderWidth: 0,
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
    borderWidth: 0,
    ...Shadows.subtle,
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
    borderWidth: 0,
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
    borderWidth: 0,
    ...Shadows.subtle,
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
    borderWidth: 0,
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
    borderWidth: 0,
    ...Shadows.subtle,
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
    borderWidth: 0,
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
    borderWidth: 0,
  },
  filterPillText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
  },
  radarListView: {
    borderRadius: Radius.xl,
    borderWidth: 0,
    ...Shadows.card,
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
    borderBottomWidth: 0,
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
    borderWidth: 0,
    ...Shadows.subtle,
  },
  quickPairBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
});
