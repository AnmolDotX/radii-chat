import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useOrbitorTheme,
  useThemeContext,
  ThemeMode,
  Typography,
  Radius,
  Spacing,
  Shadows,
} from '../../theme';

interface ThemeSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface ThemeOptionItem {
  mode: ThemeMode;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const THEME_OPTIONS: ThemeOptionItem[] = [
  {
    mode: 'dark',
    title: 'Dark Theme',
    desc: 'OLED deep black solid surfaces, gentle on the eyes in dim lighting',
    icon: 'moon',
  },
  {
    mode: 'light',
    title: 'Light Theme',
    desc: 'Apple solid white cards with soft subtle depth for daytime use',
    icon: 'sunny',
  },
  {
    mode: 'system',
    title: 'System Default',
    desc: 'Automatically matches your phone’s system light or dark display setting',
    icon: 'phone-portrait',
  },
];

export const ThemeSelectionSheet: React.FC<ThemeSelectionSheetProps> = ({
  visible,
  onClose,
}) => {
  const theme = useOrbitorTheme();
  const { themeMode, setThemeMode, isDark } = useThemeContext();
  const insets = useSafeAreaInsets();

  const sheetBottomPadding =
    (Platform.OS === 'android' ? Math.max(insets.bottom, 48) : Math.max(insets.bottom, 16)) +
    Spacing.base;

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

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
          accessibilityLabel="Close appearance bottom sheet"
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
            <View style={{ width: 32 }} />
            <Text style={[styles.sheetTitle, { color: theme.accentCyan }]}>
              APPEARANCE & THEME
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

          <Text style={[styles.heading, { color: theme.text }]}>Display Theme</Text>
          <Text style={[styles.subheading, { color: theme.textSecondary }]}>
            Select your preferred color theme. Radii adapts solid surfaces and soothing accents instantly.
          </Text>

          <View style={styles.optionsList}>
            {THEME_OPTIONS.map((item) => {
              const isSelected = themeMode === item.mode;
              return (
                <Pressable
                  key={item.mode}
                  onPress={() => handleSelect(item.mode)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(0, 194, 13, 0.12)'
                          : 'rgba(0, 194, 13, 0.08)'
                        : theme.surfaceElevated,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isSelected
                          ? theme.accentCyan
                          : isDark
                          ? '#21242B'
                          : '#DCE0E8',
                      },
                    ]}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isSelected ? '#FFFFFF' : theme.textSecondary}
                    />
                  </View>

                  <View style={styles.optionInfo}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.optionTitle,
                          {
                            color: isSelected ? theme.accentCyan : theme.text,
                            fontWeight: isSelected ? '700' : '600',
                          },
                        ]}>
                        {item.title}
                      </Text>
                      {item.mode === 'system' && (
                        <Text style={[styles.systemStatusTag, { color: theme.textTertiary }]}>
                          Active: {isDark ? 'Dark' : 'Light'}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                      {item.desc}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.checkCircle,
                      {
                        backgroundColor: isSelected ? theme.accentCyan : 'transparent',
                        borderColor: isSelected ? theme.accentCyan : theme.divider,
                      },
                    ]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                </Pressable>
              );
            })}
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
    gap: Spacing.xs,
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
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
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
    fontSize: Typography.sizes.xl,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.bold,
  },
  subheading: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  optionsList: {
    gap: Spacing.sm,
    marginTop: Spacing.xxs,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    ...Shadows.subtle,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  optionTitle: {
    fontSize: Typography.sizes.sm + 1,
    fontFamily: Typography.fontFamily,
  },
  systemStatusTag: {
    fontSize: Typography.sizes.xs - 2,
    fontFamily: Typography.monoFamily,
  },
  optionDesc: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
