import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrbitorTheme, Typography, Radius, Spacing, Layout } from '@/theme';
import { useOrbitor } from '@/context/OrbitorContext';
import { useLocalSearchParams } from 'expo-router';
import { PeerAvatar } from '@/components/common/PeerAvatar';
import { Badge } from '@/components/common/Badge';
import { ShareApkModal } from '@/components/modals/ShareApkModal';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

export default function FlingScreen() {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ peerId?: string }>();
  const { peers, fileTransfers, startFileFling } = useOrbitor();

  const [apkModalVisible, setApkModalVisible] = useState(false);

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Layout.tabBarHeight + insets.bottom + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>File Fling</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            High-speed direct Wi-Fi Direct file drop
          </Text>
        </View>

        {/* Offline APK Share Card */}
        <Pressable
          onPress={() => setApkModalVisible(true)}
          style={({ pressed }) => [
            styles.apkCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <View style={styles.apkTextWrap}>
            <View style={styles.apkTitleRow}>
              <Text style={[styles.apkTitle, { color: theme.text }]}>Share Radii APK</Text>
              <Badge label="OFFLINE BEAM" variant="cyan" size="sm" />
            </View>
            <Text style={[styles.apkDesc, { color: theme.textSecondary }]}>
              Beam this APK to a nearby phone over Bluetooth/Nearby even with zero mobile data.
            </Text>
          </View>
        </Pressable>

        {/* Active Transfers */}
        {fileTransfers.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
              TRANSFERS
            </Text>
            {fileTransfers.map((ft) => (
              <View
                key={ft.id}
                style={[
                  styles.transferCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}>
                <View style={styles.transferHeader}>
                  <Text style={[styles.fileName, { color: theme.text }]}>{ft.fileName}</Text>
                  <Badge
                    label={ft.status === 'completed' ? 'DONE' : `${ft.progressPercent}%`}
                    variant={ft.status === 'completed' ? 'green' : 'cyan'}
                    size="sm"
                  />
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: ft.status === 'completed' ? theme.success : theme.accentCyan,
                        width: `${ft.progressPercent}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Fling Target Peers */}
        {peers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No peer drop targets nearby
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Open Radii on another device in range to fling documents, photos, or videos directly.
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionHeading, { color: theme.textTertiary }]}>
              SELECT PEER DROP TARGET
            </Text>

            <View style={styles.peerTargetsList}>
              {peers.map((peer) => (
                <Pressable
                  key={peer.id}
                  onPress={() => startFileFling(peer.id, 'Document.pdf', 5 * 1024 * 1024)}
                  style={({ pressed }) => [
                    styles.peerFlingCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}>
                  <PeerAvatar peer={peer} size={40} showSignal={true} />
                  <View style={styles.peerInfo}>
                    <Text style={[styles.peerName, { color: theme.text }]}>{peer.name}</Text>
                    <Text style={[styles.peerRadio, { color: theme.textTertiary }]}>
                      Tap to send file via {peer.activeTransport.toUpperCase()}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Share APK Modal */}
      <ShareApkModal
        visible={apkModalVisible}
        onClose={() => setApkModalVisible(false)}
        onStartApkFling={() => {}}
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
  header: {
    gap: 2,
    paddingVertical: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
    fontFamily: Typography.fontFamily,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  apkCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  apkTextWrap: {
    gap: 4,
  },
  apkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  apkTitle: {
    fontSize: Typography.sizes.sm + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  apkDesc: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
  },
  section: {
    gap: Spacing.xs + 2,
  },
  sectionHeading: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  transferCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.xs + 2,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    fontFamily: Typography.fontFamily,
  },
  progressTrack: {
    height: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    gap: Spacing.xs + 2,
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
    maxWidth: 280,
  },
  peerTargetsList: {
    gap: Spacing.xs + 2,
  },
  peerFlingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm + 2,
  },
  peerInfo: {
    flex: 1,
    gap: 2,
  },
  peerName: {
    fontSize: Typography.sizes.sm + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  peerRadio: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
  },
});
