import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, radius, spacing } from '@/constants/theme';

type Props = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerOutline';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  label,
  accessibilityLabel = label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: Props) {
  const isDisabled = disabled || loading;
  // Keep busy=false explicit so Android rebuilds the content description.
  const accessibilityState = { disabled: isDisabled, busy: loading };

  const labelColor =
    variant === 'secondary' || variant === 'dangerOutline'
      ? variant === 'dangerOutline'
        ? colors.signRed
        : colors.ink
      : colors.surface;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} importantForAccessibility="no" accessibilityElementsHidden />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.ink,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  danger: {
    backgroundColor: colors.signRed,
  },
  dangerOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.signRed,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: font.body,
    fontWeight: '700',
  },
});
