import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

type Props = PropsWithChildren<{
  padded?: boolean;
}>;

export function Screen({ children, padded = true }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.content, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  content: {
    flex: 1,
    backgroundColor: colors.ground,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});
