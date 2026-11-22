import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, radius, spacing } from '@/constants/theme';
import { activeRoutes, linesOf } from '@/lib/routeCatalog';
import { useRouteCatalog } from '@/stores/routeCatalog';
import type { Ruta } from '@/types/models';

type Props = {
  route: Ruta;
  onSelect: (route: Ruta) => void;
  disabled?: boolean;
};

export function RouteSelector({ route, onSelect, disabled = false }: Props) {
  const catalog = useRouteCatalog((state) => state.catalog);
  const [linePickerOpen, setLinePickerOpen] = useState(false);
  const directions = activeRoutes(catalog).filter((item) => item.linea_id === route.linea_id);
  const lines = linesOf(catalog, route.sentido);
  const direction = route.sentido === 'ida' ? 'Ida' : 'Vuelta';

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cambiar línea. Actual: ${route.linea_nombre}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setLinePickerOpen(true)}
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
            `${item.sentido === 'ida' ? 'Ida' : 'Vuelta'}: ${item.nombre.split(' · ')[1] ?? item.nombre}`,
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
      <Modal
        transparent
        visible={linePickerOpen}
        onRequestClose={() => setLinePickerOpen(false)}
      >
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.picker}>
            <Text accessibilityRole="header" style={styles.label}>Selecciona la línea</Text>
            <ScrollView style={styles.lineList}>
              {lines.map((item) => (
                <Pressable
                  key={item.linea_id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.linea_id === route.linea_id }}
                  style={styles.control}
                  onPress={() => {
                    setLinePickerOpen(false);
                    onSelect(item);
                  }}
                >
                  <Text style={styles.label}>{item.linea_nombre}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" style={styles.control} onPress={() => setLinePickerOpen(false)}>
              <Text style={styles.label}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: '#0008' },
  picker: { backgroundColor: colors.ground, padding: spacing.md, gap: spacing.sm, borderRadius: radius.control },
  lineList: { maxHeight: 300 },
  lineControl: { flex: 2 },
  label: { flexShrink: 1, color: colors.ink, fontSize: font.body, fontWeight: '700' },
});
