import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { TransportType } from '../../core/types';

interface BadgeProps {
  label: string;
  variant?: 'cyan' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'neutral';
  transport?: TransportType;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'cyan',
  transport,
  size = 'sm',
  style,
}) => {
  const theme = useOrbitorTheme();

  // If transport is provided, map to specific radio color
  let activeVariant = variant;
  if (transport) {
    switch (transport) {
      case 'ble':
        activeVariant = 'blue';
        break;
      case 'nearby':
        activeVariant = 'cyan';
        break;
      case 'location':
        activeVariant = 'green';
        break;
      case 'link':
        activeVariant = 'purple';
        break;
    }
  }

  const getColors = () => {
    switch (activeVariant) {
      case 'cyan':
        return { bg: theme.accentCyanMuted, text: theme.accentCyan, border: theme.accentCyan };
      case 'blue':
        return { bg: theme.accentBlueMuted, text: theme.accentBlue, border: theme.accentBlue };
      case 'green':
        return { bg: theme.successMuted, text: theme.success, border: theme.success };
      case 'amber':
        return { bg: theme.warningMuted, text: theme.warning, border: theme.warning };
      case 'red':
        return { bg: theme.dangerMuted, text: theme.danger, border: theme.danger };
      case 'purple':
        return { bg: theme.plusMuted, text: theme.plus, border: theme.plus };
      case 'neutral':
      default:
        return { bg: theme.surfaceHighlight, text: theme.textSecondary, border: theme.border };
    }
  };

  const colors = getColors();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? Spacing.xs + 2 : Spacing.sm + 2,
        },
        style,
      ]}>
      <Text
        style={[
          styles.label,
          {
            color: colors.text,
            fontSize: isSm ? Typography.sizes.xs : Typography.sizes.sm,
          },
        ]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Typography.monoFamily,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
