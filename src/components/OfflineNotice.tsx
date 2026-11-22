import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, radius, spacing } from '@/constants/theme';

export function OfflineNotice({ message }: { message: string }) {
  return (
    <View style={styles.notice}>
      <Icon color={colors.onRed} name="signal-off" size={20} />
      <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.signRed,
  },
  text: {
    flex: 1,
    color: colors.onRed,
    fontSize: font.body,
  },
});
