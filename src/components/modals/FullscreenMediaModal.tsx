import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrbitorTheme, Typography, Spacing } from '../../theme';
import { openFileWithNativeIntent } from '../../transport/NativeRadioTransport';

interface FullscreenMediaModalProps {
  visible: boolean;
  imageUri?: string | null;
  senderName?: string;
  timestamp?: number;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FullscreenMediaModal: React.FC<FullscreenMediaModalProps> = ({
  visible,
  imageUri,
  senderName,
  timestamp,
  onClose,
}) => {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();

  if (!imageUri) return null;

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const handleShareOrOpen = () => {
    openFileWithNativeIntent(imageUri, 'image/*').catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Top Header Bar */}
        <View
          style={[
            styles.headerBar,
            {
              paddingTop: Math.max(insets.top, 24),
              backgroundColor: 'rgba(0,0,0,0.85)',
            },
          ]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close image preview"
            style={({ pressed }) => [
              styles.iconButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text numberOfLines={1} style={styles.senderTitle}>
              {senderName || 'Radio Photo'}
            </Text>
            {formattedTime ? (
              <Text style={styles.timestampSubtitle}>{formattedTime}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={handleShareOrOpen}
            hitSlop={12}
            accessibilityLabel="Open with external app"
            style={({ pressed }) => [
              styles.iconButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}>
            <Ionicons name="share-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Fullscreen Photo View */}
        <Pressable style={styles.imageBackdrop} onPress={onClose}>
          <Image
            source={{ uri: imageUri }}
            style={styles.fullscreenImage}
            contentFit="contain"
            transition={150}
          />
        </Pressable>

        {/* Bottom Bar Info */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: 'rgba(0,0,0,0.85)',
            },
          ]}>
          <Ionicons name="shield-checkmark" size={15} color={theme.accentCyan} />
          <Text style={[styles.bottomNotice, { color: theme.accentCyan }]}>
            OFFLINE DIRECT RADIO TRANSFER // SAVED IN DOWNLOADS/RADII
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    zIndex: 10,
    gap: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  senderTitle: {
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
    color: '#FFFFFF',
  },
  timestampSubtitle: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.base,
    gap: Spacing.xs,
  },
  bottomNotice: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
    letterSpacing: 0.5,
  },
});
