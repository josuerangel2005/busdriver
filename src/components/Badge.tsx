import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/constants/theme';

type Props = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
};

const toneColor: Record<NonNullable<Props['tone']>, string> = {
  neutral: colors.muted,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

export function Badge({ label, tone = 'neutral' }: Props) {
  const color = toneColor[tone];

  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
  },
});
