import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useOrbitorTheme, Typography, Radius, Spacing, Shadows } from '../../theme';
import { OutboxItem } from '../../core/types';

interface OutboxNoticeProps {
  items: OutboxItem[];
  onPressDeliverWithPlus?: () => void;
}

export const OutboxNotice: React.FC<OutboxNoticeProps> = ({
  items,
  onPressDeliverWithPlus,
}) => {
  const theme = useOrbitorTheme();

  if (items.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceElevated,
        },
      ]}>
      <View style={styles.content}>
        <View style={styles.indicatorRow}>
          <View style={[styles.dot, { backgroundColor: theme.warning }]} />
          <Text style={[styles.title, { color: theme.text }]}>
            {items.length} {items.length === 1 ? 'Message' : 'Messages'} Queued in Outbox
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Zero-internet guarantee active. Will deliver via radio when peer is in range.
        </Text>
      </View>

      {onPressDeliverWithPlus && (
        <Pressable
          onPress={onPressDeliverWithPlus}
          style={({ pressed }) => [
            styles.plusButton,
            {
              backgroundColor: theme.plusMuted,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Text style={[styles.plusButtonText, { color: theme.plus }]}>Send via Plus</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0,
    ...Shadows.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  title: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
  },
  plusButton: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.full,
    borderWidth: 0,
  },
  plusButtonText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.monoFamily,
  },
});
