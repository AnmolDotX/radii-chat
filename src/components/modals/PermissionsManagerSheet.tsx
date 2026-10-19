import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import {
  checkAppPermissionsStatus,
  openWifiSettingsPanel,
  requestAppAudioPermission,
  requestAppNotificationPermission,
  requestAppStoragePermission,
  openDeviceAppSettings,
  PermissionsStatus,
} from '../../transport/NativeRadioTransport';

interface PermissionsManagerSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const PermissionsManagerSheet: React.FC<PermissionsManagerSheetProps> = ({
  visible,
  onClose,
}) => {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<PermissionsStatus>({
    bluetooth: true,
    bluetoothEnabled: true,
    wifi: true,
    wifiEnabled: true,
    location: true,
    audio: true,
    notifications: true,
  });

  const refreshStatus = async () => {
    const s = await checkAppPermissionsStatus();
    setStatus(s);
  };

  useEffect(() => {
    if (visible) {
      refreshStatus();
    }
  }, [visible]);

  const handleToggleWifi = async () => {
    await openWifiSettingsPanel();
    setTimeout(refreshStatus, 1000);
  };

  const handleToggleAudio = async () => {
    await requestAppAudioPermission();
    setTimeout(refreshStatus, 600);
  };

  const handleToggleNotifications = async () => {
    await requestAppNotificationPermission();
    setTimeout(refreshStatus, 600);
  };

  const handleToggleStorage = async () => {
    await requestAppStoragePermission();
    setTimeout(refreshStatus, 600);
  };

  const handleOpenAppSettings = () => {
    openDeviceAppSettings();
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
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close permissions manager"
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
          {/* Top Header */}
          <View style={styles.topBar}>
            <View style={{ width: 36 }} />
            <Text style={[styles.sheetTitle, { color: theme.textTertiary }]}>
              DEVICE RADIO & PERMISSIONS
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

          <Text style={[styles.heading, { color: theme.text }]}>Hardware & Permissions</Text>
          <Text style={[styles.subheading, { color: theme.textSecondary }]}>
            Radii functions completely offline using direct radio links. Check and configure access below.
          </Text>

          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {/* Section 1: Compulsory Radios */}
            <Text style={[styles.sectionHeader, { color: theme.accentCyan }]}>
              COMPULSORY (CORE RADIO MESH)
            </Text>

            {/* Bluetooth Row */}
            <View style={[styles.permItem, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.permIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                <Ionicons name="bluetooth" size={20} color={theme.accentCyan} />
              </View>
              <View style={styles.permInfo}>
                <Text style={[styles.permTitle, { color: theme.text }]}>Bluetooth & BLE Mesh</Text>
                <Text style={[styles.permSubtitle, { color: theme.textSecondary }]}>
                  {status.bluetooth ? 'Active · Radio broadcast ready' : 'Disabled · Required for nearby discovery'}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.bluetooth ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={[styles.statusBadgeText, { color: status.bluetooth ? theme.success : theme.danger }]}>
                  {status.bluetooth ? 'ACTIVE' : 'ACTION'}
                </Text>
              </View>
            </View>

            {/* Wi-Fi Row */}
            <View style={[styles.permItem, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.permIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Ionicons name="wifi" size={20} color={theme.accentBlue} />
              </View>
              <View style={styles.permInfo}>
                <Text style={[styles.permTitle, { color: theme.text }]}>Wi-Fi & Direct Radio</Text>
                <Text style={[styles.permSubtitle, { color: theme.textSecondary }]}>
                  {status.wifi ? 'Enabled · Zero-data local packets' : 'Wi-Fi is off · Needed for high-speed file transfers'}
                </Text>
              </View>
              {!status.wifi ? (
                <Pressable
                  onPress={handleToggleWifi}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: theme.accentCyan, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <Text style={styles.actionBtnText}>Enable</Text>
                </Pressable>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Text style={[styles.statusBadgeText, { color: theme.success }]}>ACTIVE</Text>
                </View>
              )}
            </View>

            {/* Location Row */}
            <View style={[styles.permItem, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.permIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
                <Ionicons name="location" size={20} color="#A855F7" />
              </View>
              <View style={styles.permInfo}>
                <Text style={[styles.permTitle, { color: theme.text }]}>Nearby Radio Location</Text>
                <Text style={[styles.permSubtitle, { color: theme.textSecondary }]}>
                  Android requirement for Bluetooth hardware scanning
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.location ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={[styles.statusBadgeText, { color: status.location ? theme.success : theme.danger }]}>
                  {status.location ? 'GRANTED' : 'DENIED'}
                </Text>
              </View>
            </View>

            {/* Section 2: Optional Features */}
            <Text style={[styles.sectionHeader, { color: theme.textTertiary, marginTop: Spacing.md }]}>
              OPTIONAL (MEDIA & ALERTS)
            </Text>

            {/* Notifications Row */}
            <View style={[styles.permItem, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.permIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Ionicons name="notifications" size={20} color="#F59E0B" />
              </View>
              <View style={styles.permInfo}>
                <Text style={[styles.permTitle, { color: theme.text }]}>Push Notifications</Text>
                <Text style={[styles.permSubtitle, { color: theme.textSecondary }]}>
                  Alerts for incoming companion messages & rooms
                </Text>
              </View>
              {!status.notifications ? (
                <Pressable
                  onPress={handleToggleNotifications}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: theme.accentCyan, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <Text style={styles.actionBtnText}>Allow</Text>
                </Pressable>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Text style={[styles.statusBadgeText, { color: theme.success }]}>ALLOWED</Text>
                </View>
              )}
            </View>

            {/* Microphone Row */}
            <View style={[styles.permItem, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.permIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Ionicons name="mic" size={20} color="#EF4444" />
              </View>
              <View style={styles.permInfo}>
                <Text style={[styles.permTitle, { color: theme.text }]}>Microphone</Text>
                <Text style={[styles.permSubtitle, { color: theme.textSecondary }]}>
                  Record 10-second push-to-talk voice notes
                </Text>
              </View>
              {!status.audio ? (
                <Pressable
                  onPress={handleToggleAudio}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: theme.accentCyan, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <Text style={styles.actionBtnText}>Allow</Text>
                </Pressable>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Text style={[styles.statusBadgeText, { color: theme.success }]}>ALLOWED</Text>
                </View>
              )}
            </View>

            {/* Storage & Downloads Row */}
            <View style={[styles.permItem, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.permIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
                <Ionicons name="folder" size={20} color={theme.success} />
              </View>
              <View style={styles.permInfo}>
                <Text style={[styles.permTitle, { color: theme.text }]}>Downloads & Media Access</Text>
                <Text style={[styles.permSubtitle, { color: theme.textSecondary }]}>
                  Save received media to Downloads/Radii
                </Text>
              </View>
              {!status.storage ? (
                <Pressable
                  onPress={handleToggleStorage}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: theme.accentCyan, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <Text style={styles.actionBtnText}>Allow</Text>
                </Pressable>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Text style={[styles.statusBadgeText, { color: theme.success }]}>ALLOWED</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Settings Link */}
          <Pressable
            onPress={handleOpenAppSettings}
            style={({ pressed }) => [
              styles.settingsLinkBtn,
              {
                backgroundColor: theme.surfaceElevated,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Ionicons name="settings-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.settingsLinkText, { color: theme.textSecondary }]}>
              Open Android App Info Settings
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 0,
    ...Shadows.elevated,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    maxHeight: '85%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  sheetTitle: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 1.2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  heading: {
    fontSize: Typography.sizes.xl,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.bold,
  },
  subheading: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  scrollList: {
    maxHeight: 380,
  },
  sectionHeader: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.monoFamily,
    letterSpacing: 1,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.xs,
  },
  permItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 0,
    ...Shadows.subtle,
    marginBottom: Spacing.xs + 2,
    gap: Spacing.sm,
  },
  permIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permInfo: {
    flex: 1,
  },
  permTitle: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
  },
  permSubtitle: {
    fontSize: Typography.sizes.xs - 1,
    fontFamily: Typography.fontFamily,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  statusBadgeText: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.bold,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  actionBtnText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.bold,
    color: '#000000',
  },
  settingsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 0,
    ...Shadows.subtle,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  settingsLinkText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.medium,
  },
});
