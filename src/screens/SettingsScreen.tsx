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
import { Badge } from '@/components/common/Badge';
import { ShareApkModal } from '@/components/modals/ShareApkModal';
import { PlusComingSoonModal } from '@/components/modals/PlusComingSoonModal';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

export default function SettingsScreen() {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();
  const { myProfile, updateUserProfile } = useOrbitor();

  const [apkModalVisible, setApkModalVisible] = useState(false);
  const [plusVisible, setPlusVisible] = useState(false);

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
          <Text style={[styles.title, { color: theme.text }]}>Settings & Mesh</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Local cryptographic identity and radio diagnostics
          </Text>
        </View>

        {/* Local Peer Identity Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
            LOCAL IDENTITY (NO ACCOUNT NEEDED)
          </Text>

          <View style={styles.identityRow}>
            <View
              style={[
                styles.identityAvatar,
                { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
              ]}>
              <Text style={[styles.identityAvatarText, { color: theme.accentCyan }]}>◎</Text>
            </View>
            <View style={styles.identityDetails}>
              <Text style={[styles.displayName, { color: theme.text }]}>
                {myProfile.displayName}
              </Text>
              <Text style={[styles.deviceModel, { color: theme.textTertiary }]}>
                {myProfile.deviceModel}
              </Text>
            </View>
            <Badge label="OFFLINE IDENTITY" variant="cyan" size="sm" />
          </View>

          <View style={[styles.keyBox, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.keyLabel, { color: theme.textTertiary }]}>Ed25519 Public Key</Text>
            <Text style={[styles.keyValue, { color: theme.textSecondary }]}>
              {myProfile.publicKey}
            </Text>
          </View>
        </View>

        {/* Share Orbitor APK Button */}
        <Pressable
          onPress={() => setApkModalVisible(true)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.accentCyan,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.accentCyan }]}>
              OFFLINE APP DISTRIBUTION
            </Text>
            <Badge label="ZERO DATA" variant="cyan" size="sm" />
          </View>
          <Text style={[styles.optionTitle, { color: theme.text }]}>
            Share Radii APK over Radio
          </Text>
          <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
            Beam the standalone APK to nearby friends with no internet access. Receiver enables 'install unknown apps' once.
          </Text>
        </Pressable>

        {/* Radio Diagnostics */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
            RADIO STACK DIAGNOSTICS
          </Text>

          <View style={styles.diagnosticItem}>
            <View>
              <Text style={[styles.diagName, { color: theme.text }]}>BLE Peripheral Advertiser</Text>
              <Text style={[styles.diagSub, { color: theme.textTertiary }]}>GATT Server + Beacon</Text>
            </View>
            <Badge label="ACTIVE" variant="green" size="sm" />
          </View>

          <View style={styles.diagnosticItem}>
            <View>
              <Text style={[styles.diagName, { color: theme.text }]}>Google Nearby Connections</Text>
              <Text style={[styles.diagSub, { color: theme.textTertiary }]}>High-speed Wi-Fi Direct</Text>
            </View>
            <Badge label="ACTIVE" variant="green" size="sm" />
          </View>

          <View style={styles.diagnosticItem}>
            <View>
              <Text style={[styles.diagName, { color: theme.text }]}>Campus LAN / mDNS Socket</Text>
              <Text style={[styles.diagSub, { color: theme.textTertiary }]}>Hostel Wi-Fi zero-cloud</Text>
            </View>
            <Badge label="READY" variant="cyan" size="sm" />
          </View>
        </View>

        {/* Visibility & Discovery Setting Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
            DISCOVERY & VISIBILITY
          </Text>
          <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
            Control who can discover your device on their radar circle over Bluetooth & Wi-Fi:
          </Text>

          <View style={styles.visibilityOptionsRow}>
            {(['everyone', 'contacts', 'hidden'] as const).map((mode) => {
              const isSelected = myProfile.visibility === mode;
              const labels = {
                everyone: 'Everyone Nearby',
                contacts: 'Same Contacts',
                hidden: 'Hidden',
              };
              return (
                <Pressable
                  key={mode}
                  onPress={() => updateUserProfile({ visibility: mode })}
                  style={({ pressed }) => [
                    styles.visibilityBtn,
                    {
                      backgroundColor: isSelected ? theme.text : theme.surfaceElevated,
                      borderColor: isSelected ? theme.text : theme.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.visibilityBtnText,
                      { color: isSelected ? theme.background : theme.textSecondary },
                    ]}>
                    {labels[mode]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Orbitor Plus & Cloud Layer Coming Soon Preview */}
        <Pressable
          onPress={() => setPlusVisible(true)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.plus,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.plus }]}>
              RADII PLUS // COMING SOON
            </Text>
            <Badge label="₹99 / MO" variant="purple" size="sm" />
          </View>
          <Text style={[styles.optionTitle, { color: theme.text }]}>
            Internet Layer & Cloud Reach
          </Text>
          <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
            Reach paired friends over the internet when they are far away. Encrypted backup, 2 GB Cloud Drop, and larger rooms.
          </Text>
          <Text style={[styles.learnMoreLink, { color: theme.plus }]}>
            View full roadmap details ↗
          </Text>
        </Pressable>

        {/* Zero-Internet Guarantee Statement */}
        <View style={styles.privacyNote}>
          <Text style={[styles.privacyTitle, { color: theme.textSecondary }]}>
            🔒 ZERO INTERNET LEAK GUARANTEE
          </Text>
          <Text style={[styles.privacyDesc, { color: theme.textTertiary }]}>
            Radii operates strictly on local device antennas (Bluetooth & Wi-Fi Direct). No servers receive your contacts, messages, or location coordinates.
          </Text>
        </View>
      </ScrollView>

      {/* Share APK Modal */}
      <ShareApkModal
        visible={apkModalVisible}
        onClose={() => setApkModalVisible(false)}
        onStartApkFling={() => {}}
      />

      {/* Plus Coming Soon Modal */}
      <PlusComingSoonModal
        visible={plusVisible}
        onClose={() => setPlusVisible(false)}
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
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  identityAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityAvatarText: {
    fontSize: 22,
    fontWeight: '800',
  },
  identityDetails: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: Typography.sizes.sm + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  deviceModel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  keyBox: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    gap: 2,
  },
  keyLabel: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
  },
  keyValue: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
  },
  optionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  optionDesc: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
  },
  learnMoreLink: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  diagnosticItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  diagName: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
  diagSub: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
  },
  visibilityOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: 4,
  },
  visibilityBtn: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityBtnText: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
  },
  privacyNote: {
    padding: Spacing.sm,
    gap: 4,
    marginTop: Spacing.xs,
  },
  privacyTitle: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.5,
  },
  privacyDesc: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
  },
});
