import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

export type PlacardTone = 'yellow' | 'green' | 'red' | 'blue' | 'passed' | 'plain';

type Props = PropsWithChildren<{
  tone: PlacardTone;
  onPress?: () => void;
  selected?: boolean;
}>;

const toneStyles: Record<
  PlacardTone,
  { backgroundColor: string; borderColor: string }
> = {
  yellow: { backgroundColor: colors.signYellow, borderColor: colors.ink },
  green: { backgroundColor: colors.signGreen, borderColor: colors.ink },
  red: { backgroundColor: colors.signRed, borderColor: colors.ink },
  blue: { backgroundColor: colors.signBlue, borderColor: colors.ink },
  passed: { backgroundColor: colors.passedGround, borderColor: colors.ink },
  plain: { backgroundColor: colors.surface, borderColor: colors.ink },
};

export function Placard({ tone, onPress, selected = false, children }: Props) {
  const toneStyle = toneStyles[tone];

  if (!onPress) {
    return (
      <View style={[styles.base, toneStyle, selected && styles.selected]}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        toneStyle,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sign,
    borderWidth: 2,
    padding: spacing.md,
  },
  selected: {
    borderWidth: 4,
  },
  pressed: {
    opacity: 0.9,
  },
});
