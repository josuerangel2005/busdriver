import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, radius, spacing } from '@/constants/theme';
import { ROUTES } from '@/data/seed';
import type { Ruta } from '@/types/models';

type Props = {
  route: Ruta;
  onSelect: (route: Ruta) => void;
  disabled?: boolean;
};

export function RouteSelector({ route, onSelect, disabled = false }: Props) {
  const directions = ROUTES.filter((item) => item.linea_id === route.linea_id);
  const lines = ROUTES.filter((item) => item.sentido === route.sentido);
  const direction = route.sentido === 'ida' ? 'Ida' : 'Vuelta';

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cambiar línea. Actual: ${route.linea_nombre}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => Alert.alert('Selecciona la línea', undefined, lines.map((item) => ({
          text: item.linea_nombre,
          onPress: () => onSelect(item),
        })), { cancelable: true })}
        style={[styles.control, styles.lineControl]}
      >
        <Text numberOfLines={1} style={styles.label}>{route.linea_nombre}</Text>
        <Icon name="chevron-down" color={colors.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cambiar sentido. Actual: ${direction}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => Alert.alert(
          'Selecciona el sentido',
          directions.map((item) =>
            `${item.sentido === 'ida' ? 'Ida' : 'Vuelta'}: ${item.nombre.split(' · ')[1]}`,
          ).join('\n'),
          directions.map((item) => ({
            text: item.sentido === 'ida' ? 'Ida' : 'Vuelta',
            onPress: () => onSelect(item),
          })),
          { cancelable: true },
        )}
        style={styles.control}
      >
        <Text numberOfLines={1} style={styles.label}>{direction}</Text>
        <Icon name="chevron-down" color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  control: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 48,
    minHeight: 48,
    padding: spacing.sm,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderRadius: radius.control,
    borderColor: colors.ink,
  },
  lineControl: { flex: 2 },
  label: { flexShrink: 1, color: colors.ink, fontSize: font.body, fontWeight: '700' },
});
