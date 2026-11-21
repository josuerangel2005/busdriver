import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, font, radius, spacing } from '@/constants/theme';

type Props = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
};

const toneStyle: Record<
  NonNullable<Props['tone']>,
  { backgroundColor: string; color: string; icon: IconName }
> = {
  neutral: {
    backgroundColor: colors.passedGround,
    color: colors.passedInk,
    icon: 'minus-circle',
  },
  success: {
    backgroundColor: colors.signGreen,
    color: colors.onGreen,
    icon: 'circle',
  },
  warning: {
    backgroundColor: colors.signYellow,
    color: colors.onYellow,
    icon: 'alert',
  },
  danger: {
    backgroundColor: colors.signRed,
    color: colors.onRed,
    icon: 'alert',
  },
};

export function Badge({ label, tone = 'neutral' }: Props) {
  const current = toneStyle[tone];

  return (
    <View style={[styles.badge, { backgroundColor: current.backgroundColor }]}>
      <Icon color={current.color} name={current.icon} size={14} />
      <Text style={[styles.label, { color: current.color }]}>{label}</Text>
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
  label: {
    fontSize: font.label,
    fontWeight: '600',
  },
});
