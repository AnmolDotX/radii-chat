import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';

import { pickNativeDocument } from '../../transport/NativeRadioTransport';

declare const require: any;
let ImagePickerModule: typeof import('expo-image-picker') | null = null;

function getImagePicker(): typeof import('expo-image-picker') | null {
  if (ImagePickerModule) return ImagePickerModule;
  try {
    ImagePickerModule = require('expo-image-picker');
    return ImagePickerModule;
  } catch (err) {
    console.warn('[MediaAttachmentSheet] Native ImagePicker not found in current binary:', err);
    return null;
  }
}

interface MediaAttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSendMedia: (
    uri: string,
    base64?: string,
    mimeType?: string,
    fileName?: string,
    mediaType?: 'image' | 'file'
  ) => void;
}

export const MediaAttachmentSheet: React.FC<MediaAttachmentSheetProps> = ({
  visible,
  onClose,
  onSendMedia,
}) => {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();

  const handlePickDocument = async () => {
    try {
      const doc = await pickNativeDocument();
      if (doc && doc.uri) {
        onClose();
        onSendMedia(
          doc.uri,
          doc.base64 || undefined,
          doc.mimeType || 'application/octet-stream',
          doc.fileName,
          'file'
        );
      }
    } catch (err) {
      console.warn('Document picker error:', err);
      Alert.alert('File Picker Error', 'Could not open file picker on this device.');
    }
  };

  const handleLaunchCamera = async () => {
    try {
      const picker = getImagePicker();
      if (!picker) {
        Alert.alert(
          'Rebuild Required for Camera',
          'The camera native module is not yet compiled into this running APK. Rebuild the app with "pnpm run android:device".'
        );
        return;
      }

      const permission = await picker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera Permission', 'Camera access is required to capture radio photos.');
        return;
      }

      const result = await picker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onClose();
        const asset = result.assets[0];
        onSendMedia(
          asset.uri,
          asset.base64 || undefined,
          asset.mimeType || 'image/jpeg',
          asset.fileName || `photo_${Date.now()}.jpg`,
          'image'
        );
      }
    } catch (err) {
      console.warn('Camera error:', err);
      Alert.alert('Camera Error', 'Could not open camera on this device.');
    }
  };

  const handleLaunchGallery = async () => {
    try {
      const picker = getImagePicker();
      if (!picker) {
        Alert.alert(
          'Rebuild Required for Gallery',
          'The photo gallery native module is not yet compiled into this running APK. Rebuild the app with "pnpm run android:device".'
        );
        return;
      }

      const permission = await picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos Permission', 'Photo library access is required to send images over radio.');
        return;
      }

      const result = await picker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onClose();
        const asset = result.assets[0];
        onSendMedia(
          asset.uri,
          asset.base64 || undefined,
          asset.mimeType || 'image/jpeg',
          asset.fileName || `photo_${Date.now()}.jpg`,
          'image'
        );
      }
    } catch (err) {
      console.warn('Gallery error:', err);
      Alert.alert('Gallery Error', 'Could not open photo gallery on this device.');
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
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close media attachments"
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
          {/* Top Bar with Title and Close Cross Icon */}
          <View style={styles.topBar}>
            <View style={{ width: 36 }} />
            <Text style={[styles.sheetTitle, { color: theme.textTertiary }]}>
              MESH MEDIA & FILE TRANSFER
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

          <Text style={[styles.heading, { color: theme.text }]}>Share via Direct Radio</Text>
          <Text style={[styles.subheading, { color: theme.textSecondary }]}>
            Files are chunked and transmitted peer-to-peer over Wi-Fi Direct or Bluetooth mesh into Downloads/Radii.
          </Text>

          {/* Action Grid */}
          <View style={styles.grid}>
            <Pressable
              onPress={handleLaunchCamera}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: theme.surfaceElevated,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                <Ionicons name="camera" size={24} color={theme.accentCyan} />
              </View>
              <Text style={[styles.actionLabel, { color: theme.text }]}>Camera</Text>
              <Text style={[styles.actionHint, { color: theme.textTertiary }]}>Snap radio photo</Text>
            </Pressable>

            <Pressable
              onPress={handleLaunchGallery}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: theme.surfaceElevated,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
                <Ionicons name="images" size={24} color="#A855F7" />
              </View>
              <Text style={[styles.actionLabel, { color: theme.text }]}>Gallery</Text>
              <Text style={[styles.actionHint, { color: theme.textTertiary }]}>Choose from device</Text>
            </Pressable>

            <Pressable
              onPress={handlePickDocument}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: theme.surfaceElevated,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(234, 179, 8, 0.12)' }]}>
                <Ionicons name="document-text" size={24} color="#EAB308" />
              </View>
              <Text style={[styles.actionLabel, { color: theme.text }]}>Files & Docs</Text>
              <Text style={[styles.actionHint, { color: theme.textTertiary }]}>PDF, movie, any file</Text>
            </Pressable>
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
    gap: Spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  heading: {
    fontSize: Typography.sizes.base + 2,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
  },
  subheading: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionCard: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 0,
    ...Shadows.subtle,
    alignItems: 'center',
    gap: 4,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: Typography.sizes.xs + 1,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  actionHint: {
    fontSize: 9,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
});
