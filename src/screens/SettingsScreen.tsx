import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, useThemeContext, Typography, Radius, Spacing, Layout, Shadows } from '@/theme';
import { useOrbitor } from '@/context/OrbitorContext';
import { Badge } from '@/components/common/Badge';
import { PermissionsManagerSheet } from '@/components/modals/PermissionsManagerSheet';
import { ThemeSelectionSheet } from '@/components/modals/ThemeSelectionSheet';

export default function SettingsScreen() {
  const theme = useOrbitorTheme();
  const { themeMode, setThemeMode, isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { myProfile, updateUserProfile } = useOrbitor();

  const [permissionsModalVisible, setPermissionsModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  // Editable identity state
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(myProfile.displayName || '');
  const [editDeviceName, setEditDeviceName] = useState(myProfile.deviceName || myProfile.deviceModel || '');

  const handleStartEditing = () => {
    setEditDisplayName(myProfile.displayName || '');
    setEditDeviceName(myProfile.deviceName || myProfile.deviceModel || '');
    setIsEditingIdentity(true);
  };

  const handleSaveIdentity = () => {
    const trimmedName = editDisplayName.trim() || myProfile.displayName || 'Radii User';
    const trimmedDevice = editDeviceName.trim() || myProfile.deviceName || 'Android Radio';
    updateUserProfile({
      displayName: trimmedName,
      deviceName: trimmedDevice,
    });
    setIsEditingIdentity(false);
  };

  const handleCancelEditing = () => {
    setEditDisplayName(myProfile.displayName || '');
    setEditDeviceName(myProfile.deviceName || myProfile.deviceModel || '');
    setIsEditingIdentity(false);
  };

  const shortId = (myProfile.id || '').slice(-6).toUpperCase();

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
            Local offline identity, hardware radios, and diagnostics
          </Text>
        </View>

        {/* Local Peer Identity Card (Borderless, Material Elevation) */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.accentCyan }]}>
              OFFLINE IDENTITY
            </Text>
            <Badge label={`ID · #${shortId}`} variant="cyan" size="sm" />
          </View>

          {!isEditingIdentity ? (
            <View style={styles.identityViewWrap}>
              <View style={styles.identityRow}>
                <View
                  style={[
                    styles.identityAvatar,
                    { backgroundColor: theme.surfaceHighlight },
                  ]}>
                  <Text style={[styles.identityAvatarText, { color: theme.accentCyan }]}>
                    {(myProfile.displayName || 'R').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.identityDetails}>
                  <Text style={[styles.displayName, { color: theme.text }]}>
                    {myProfile.displayName}
                  </Text>
                  <Text style={[styles.deviceModel, { color: theme.textTertiary }]}>
                    {myProfile.deviceName || myProfile.deviceModel}
                  </Text>
                </View>
                <Pressable
                  onPress={handleStartEditing}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.editIconBtn,
                    { backgroundColor: theme.surfaceHighlight, opacity: pressed ? 0.75 : 1 },
                  ]}>
                  <Ionicons name="pencil" size={14} color={theme.text} />
                  <Text style={[styles.editIconBtnText, { color: theme.text }]}>Edit</Text>
                </Pressable>
              </View>
              <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                This name and device model are broadcast to nearby companions over Bluetooth & local Wi-Fi mesh. Zero accounts or internet required.
              </Text>
            </View>
          ) : (
            <View style={styles.identityEditWrap}>
              <View style={styles.editFieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Username / Display Name</Text>
                <TextInput
                  value={editDisplayName}
                  onChangeText={setEditDisplayName}
                  placeholder="Enter your name"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.editInput,
                    { backgroundColor: theme.surfaceElevated, color: theme.text },
                  ]}
                />
              </View>

              <View style={styles.editFieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Device Name</Text>
                <TextInput
                  value={editDeviceName}
                  onChangeText={setEditDeviceName}
                  placeholder="e.g. Motorola Edge, Pixel 8"
                  placeholderTextColor={theme.textTertiary}
                  style={[
                    styles.editInput,
                    { backgroundColor: theme.surfaceElevated, color: theme.text },
                  ]}
                />
              </View>

              <View style={styles.editActionRow}>
                <Pressable
                  onPress={handleCancelEditing}
                  style={({ pressed }) => [
                    styles.editCancelBtn,
                    { backgroundColor: theme.surfaceHighlight, opacity: pressed ? 0.75 : 1 },
                  ]}>
                  <Text style={[styles.editCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveIdentity}
                  style={({ pressed }) => [
                    styles.editSaveBtn,
                    { backgroundColor: theme.text, opacity: pressed ? 0.85 : 1 },
                  ]}>
                  <Text style={[styles.editSaveText, { color: theme.background }]}>Save Changes</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Appearance & Theme Setting Card (Click opens BottomSheet) */}
        <Pressable
          onPress={() => setThemeModalVisible(true)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.accentCyan }]}>
              APPEARANCE & THEME
            </Text>
            <Badge
              label={
                themeMode === 'system'
                  ? `AUTO (${isDark ? 'DARK' : 'LIGHT'})`
                  : themeMode.toUpperCase()
              }
              variant="green"
              size="sm"
            />
          </View>
          <View style={styles.clickableRow}>
            <View style={styles.clickableTextWrap}>
              <Text style={[styles.optionTitle, { color: theme.text }]}>
                {themeMode === 'dark'
                  ? 'Dark Theme'
                  : themeMode === 'light'
                  ? 'Light Theme'
                  : 'System Default'}
              </Text>
              <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                {themeMode === 'dark'
                  ? 'OLED deep black solid surfaces, gentle on eyes in dim lighting'
                  : themeMode === 'light'
                  ? 'Apple solid white cards with soft subtle depth for daytime use'
                  : 'Automatically matches your phone light / dark display setting'}
              </Text>
            </View>
            <View style={[styles.chevronBox, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </View>
          </View>
        </Pressable>

        {/* Hardware & System Permissions Card (Borderless) */}
        <Pressable
          onPress={() => setPermissionsModalVisible(true)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.accentCyan }]}>
              DEVICE HARDWARE & ACCESS
            </Text>
            <Badge label="SYSTEM" variant="cyan" size="sm" />
          </View>
          <View style={styles.clickableRow}>
            <View style={styles.clickableTextWrap}>
              <Text style={[styles.optionTitle, { color: theme.text }]}>
                Hardware & System Permissions
              </Text>
              <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                Manage Wi-Fi Direct mesh, Bluetooth radio, Push Notifications, Audio recording, and Downloads/Radii media storage access.
              </Text>
            </View>
            <View style={[styles.chevronBox, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </View>
          </View>
        </Pressable>

        {/* Radio Diagnostics Card (Borderless) */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.accentCyan }]}>
            RADIO STACK DIAGNOSTICS
          </Text>

          <View style={styles.diagnosticItem}>
            <View>
              <Text style={[styles.diagName, { color: theme.text }]}>BLE Peripheral Advertiser</Text>
              <Text style={[styles.diagSub, { color: theme.textTertiary }]}>GATT Server + Zero-drop Beacon</Text>
            </View>
            <Badge label="ACTIVE" variant="green" size="sm" />
          </View>

          <View style={styles.diagnosticItem}>
            <View>
              <Text style={[styles.diagName, { color: theme.text }]}>High-Speed Radio Mesh</Text>
              <Text style={[styles.diagSub, { color: theme.textTertiary }]}>Wi-Fi Direct + UDP Subnet Mesh</Text>
            </View>
            <Badge label="ACTIVE" variant="green" size="sm" />
          </View>

          <View style={styles.diagnosticItem}>
            <View>
              <Text style={[styles.diagName, { color: theme.text }]}>Local Antenna Socket</Text>
              <Text style={[styles.diagSub, { color: theme.textTertiary }]}>Zero-cloud direct delivery</Text>
            </View>
            <Badge label="READY" variant="cyan" size="sm" />
          </View>
        </View>

        {/* Internet Layer & Cloud Reach (Disabled - Coming Soon) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              opacity: 0.7,
            },
          ]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.plus }]}>
              INTERNET LAYER & CLOUD REACH
            </Text>
            <Badge label="COMING SOON" variant="purple" size="sm" />
          </View>
          <Text style={[styles.optionTitle, { color: theme.text }]}>
            Internet Layer & Cloud Reach
          </Text>
          <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
            Reach paired friends over the internet when they are far away. Encrypted backup, 2 GB Cloud Drop, and larger rooms.
          </Text>
        </View>

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

      {/* Hardware & System Permissions Modal */}
      <PermissionsManagerSheet
        visible={permissionsModalVisible}
        onClose={() => setPermissionsModalVisible(false)}
      />

      {/* Appearance Theme Selection Modal */}
      <ThemeSelectionSheet
        visible={themeModalVisible}
        onClose={() => setThemeModalVisible(false)}
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
    marginBottom: Spacing.xs,
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
    borderRadius: Radius.xl,
    borderWidth: 0,
    padding: Spacing.md + 2,
    gap: Spacing.sm,
    ...Shadows.subtle,
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
  identityViewWrap: {
    gap: Spacing.sm,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityAvatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  identityDetails: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  deviceModel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
  },
  editIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    gap: 4,
  },
  editIconBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  identityEditWrap: {
    gap: Spacing.sm + 2,
    marginTop: Spacing.xs,
  },
  editFieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    fontFamily: Typography.fontFamily,
  },
  editInput: {
    width: '100%',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
  editActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  editCancelBtn: {
    paddingVertical: Spacing.xs + 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  editCancelText: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
  },
  editSaveBtn: {
    paddingVertical: Spacing.xs + 4,
    paddingHorizontal: Spacing.md + 4,
    borderRadius: Radius.lg,
  },
  editSaveText: {
    fontSize: Typography.sizes.xs + 1,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
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
  diagnosticItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs + 2,
  },
  diagName: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
  diagSub: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
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
  clickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  clickableTextWrap: {
    flex: 1,
    gap: 2,
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
