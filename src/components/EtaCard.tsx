import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { colors, font, radius, spacing } from '@/constants/theme';
import { formatDistance, formatEta } from '@/lib/eta';
import type { StopEta } from '@/lib/eta';

type Props = {
  stopEta: StopEta;
  selected?: boolean;
  onPress?: () => void;
};

export function EtaCard({ stopEta, selected = false, onPress }: Props) {
  const { parada, distanciaRestanteM, etaSegundos, pasada, desactualizado } = stopEta;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.order}>
            <Text style={styles.orderText}>{parada.orden}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {parada.nombre}
          </Text>
        </View>
        {desactualizado ? (
          <Badge label="Sin datos" tone="danger" />
        ) : pasada ? (
          <Badge label="Pasada" tone="neutral" />
        ) : (
          <Badge label="En ruta" tone="success" />
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.eta}>{pasada ? '—' : formatEta(etaSegundos)}</Text>
        <Text style={styles.distance}>
          {pasada ? 'ya pasó' : `a ${formatDistance(distanciaRestanteM)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  selected: {
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.9,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  order: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${colors.marker}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    color: colors.marker,
    fontSize: font.sm,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  eta: {
    color: colors.primary,
    fontSize: font.xl,
    fontWeight: '700',
  },
  distance: {
    color: colors.muted,
    fontSize: font.sm,
  },
});
