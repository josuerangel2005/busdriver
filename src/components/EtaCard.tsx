import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Placard, type PlacardTone } from '@/components/Placard';
import { colors, font, fontFamily, radius, spacing } from '@/constants/theme';
import { formatDistance, formatEta } from '@/lib/eta';
import type { StopEta } from '@/lib/eta';

type Props = {
  stopEta: StopEta;
  selected?: boolean;
  onPress?: () => void;
  highlight?: boolean;
};

export function EtaCard({
  stopEta,
  selected = false,
  onPress,
  highlight = false,
}: Props) {
  const { parada, distanciaRestanteM, etaSegundos, pasada, desactualizado } = stopEta;

  const isStale = desactualizado;
  const isPassed = !isStale && pasada;
  const isFresh = !isStale && !isPassed;

  const tone: PlacardTone = isStale
    ? 'red'
    : isPassed
      ? 'passed'
      : highlight
        ? 'yellow'
        : 'plain';

  const foreground = isStale
    ? colors.onRed
    : isPassed
      ? colors.passedInk
      : colors.ink;

  const distanceColor = isStale
    ? colors.onRed
    : isPassed
      ? colors.passedInk
      : colors.inkMuted;

  const state: { icon: IconName; word: string } = isStale
    ? { icon: 'signal-off', word: 'Sin datos' }
    : isPassed
      ? { icon: 'check', word: 'Pasada' }
      : { icon: 'bus', word: 'En ruta' };

  return (
    <Placard tone={tone} selected={selected} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.order}>
            <Text style={styles.orderText}>{parada.orden}</Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: foreground }]}
          >
            {parada.nombre}
          </Text>
        </View>
        <View style={styles.state}>
          <Icon color={foreground} name={state.icon} size={16} />
          <Text style={[styles.stateText, { color: foreground }]}>
            {state.word}
          </Text>
        </View>
      </View>

      {isPassed ? (
        <Text style={[styles.passed, { color: colors.passedInk }]}>ya pasó</Text>
      ) : (
        <View style={styles.footer}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={[
              styles.eta,
              isFresh && highlight ? styles.etaLarge : styles.etaSmall,
              { color: foreground },
            ]}
          >
            {isStale ? '—' : formatEta(etaSegundos)}
          </Text>
          <Text style={[styles.distance, { color: distanceColor }]}>
            {pasada ? 'ya pasó' : `a ${formatDistance(distanciaRestanteM)}`}
          </Text>
        </View>
      )}
    </Placard>
  );
}

const styles = StyleSheet.create({
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
    width: 28,
    height: 28,
    borderRadius: radius.sign,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    color: colors.surface,
    fontFamily: fontFamily.display,
    fontSize: font.body,
    lineHeight: 18,
    includeFontPadding: false,
  },
  name: {
    flexShrink: 1,
    fontFamily: fontFamily.display,
    fontSize: font.title,
    lineHeight: 23,
    textTransform: 'uppercase',
  },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  stateText: {
    fontSize: font.label,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  eta: {
    fontFamily: fontFamily.display,
    includeFontPadding: false,
  },
  etaLarge: {
    fontSize: font.eta,
    lineHeight: 66,
    flexShrink: 1,
  },
  etaSmall: {
    fontSize: font.display,
    lineHeight: 42,
  },
  distance: {
    fontSize: font.body,
    lineHeight: 22,
  },
  passed: {
    fontSize: font.body,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});
