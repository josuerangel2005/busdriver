import { StyleSheet, Text, View } from 'react-native';

import { EtaCard, FavoriteStopLabel } from '@/components/EtaCard';
import { Icon } from '@/components/Icon';
import { Placard } from '@/components/Placard';
import { colors, font, spacing } from '@/constants/theme';
import type { StopEta } from '@/lib/eta';
import type { Parada } from '@/types/models';

type Props = {
  stop: Parada;
  eta?: StopEta;
  favorite: boolean;
  offline: boolean;
  selected: boolean;
  highlight: boolean;
  onPress: () => void;
};

export function PassengerStopCard({ stop, eta, favorite, offline, selected, highlight, onPress }: Props) {
  if (eta && !(favorite && offline)) {
    return <EtaCard stopEta={eta} favorite={favorite} selected={selected} highlight={highlight || favorite} onPress={onPress} />;
  }

  const foreground = favorite ? (offline ? colors.onRed : colors.onYellow) : colors.inkMuted;
  return (
    <Placard tone={favorite ? (offline ? 'red' : 'yellow') : 'plain'} selected={selected} onPress={onPress}>
      {favorite && <FavoriteStopLabel color={foreground} />}
      <Text style={[styles.name, { color: foreground }]}>{stop.orden}. {stop.nombre}</Text>
      {favorite && (
        <View style={styles.state}>
          <Icon name={offline ? 'signal-off' : 'minus-circle'} color={foreground} size={16} />
          <Text style={[styles.name, { color: foreground }]}>{offline ? 'Sin conexión' : 'Sin unidades'}</Text>
        </View>
      )}
    </Placard>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: font.body, lineHeight: 24 },
  state: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
});
