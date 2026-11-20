import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EtaCard } from '@/components/EtaCard';
import { Screen } from '@/components/Screen';
import { colors, font, radius, spacing } from '@/constants/theme';
import { useNow, usePilotData } from '@/hooks/usePilotData';
import { computeBestStopEtas } from '@/lib/eta';
import { exportWaitsCsv, finishWait, listWaits, startWait } from '@/lib/metrics';

export default function PassengerEtaScreen() {
  const router = useRouter();
  const { ruta, paradas, vehiculos } = usePilotData();
  const now = useNow(5_000);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [activeWait, setActiveWait] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(() => listWaits().length);
  const [exporting, setExporting] = useState(false);

  const hasVehicle = useMemo(
    () =>
      Boolean(ruta) &&
      vehiculos.some(
        (item) => item.en_servicio && item.ruta_activa === ruta?.id,
      ),
    [vehiculos, ruta],
  );

  const etas = useMemo(() => {
    if (!ruta) {
      return [];
    }
    return computeBestStopEtas(ruta, paradas, vehiculos, now);
  }, [ruta, paradas, vehiculos, now]);

  function beginWait() {
    if (!selectedStopId) {
      return;
    }
    setActiveWait(startWait(selectedStopId));
  }

  function endWait() {
    if (!activeWait) {
      return;
    }
    finishWait(activeWait);
    setActiveWait(null);
    setSavedCount(listWaits().length);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const uri = await exportWaitsCsv();
      if (!uri) {
        Alert.alert('Sin datos', 'Todavía no hay mediciones de espera registradas.');
      }
    } catch (error) {
      Alert.alert('No se pudo exportar', (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Tiempo estimado</Text>
          <Badge
            label={hasVehicle ? 'Vehículo en servicio' : 'Sin unidades'}
            tone={hasVehicle ? 'success' : 'neutral'}
          />
        </View>

        <Text style={styles.hint}>
          Toca una parada para seleccionarla. Las distancias se calculan sobre el recorrido
          de la ruta, no en línea recta.
        </Text>

        {etas.length === 0 ? (
          <Text style={styles.empty}>
            No hay datos para calcular el tiempo estimado en este momento.
          </Text>
        ) : (
          etas.map((stopEta) => (
            <EtaCard
              key={stopEta.parada.id}
              stopEta={stopEta}
              selected={selectedStopId === stopEta.parada.id}
              onPress={() => setSelectedStopId(stopEta.parada.id)}
            />
          ))
        )}

        <View style={styles.measureCard}>
          <Text style={styles.cardTitle}>Medición de espera (estudio)</Text>
          <Text style={styles.hint}>
            Registra cuánto espera una persona en la parada seleccionada. Los datos son
            anónimos y se guardan solo en este dispositivo.
          </Text>
          <Text style={styles.selected}>
            Parada seleccionada:{' '}
            {paradas.find((parada) => parada.id === selectedStopId)?.nombre ??
              'ninguna'}
          </Text>
          <Button
            label={activeWait ? 'Finalizar medición' : 'Iniciar medición'}
            variant={activeWait ? 'danger' : 'primary'}
            disabled={!selectedStopId}
            onPress={activeWait ? endWait : beginWait}
          />
          <Text style={styles.hint}>
            Mediciones guardadas: {savedCount}
          </Text>
          <Button
            label="Exportar CSV anónimo"
            variant="secondary"
            loading={exporting}
            disabled={savedCount === 0}
            onPress={exportCsv}
          />
        </View>

        <Button
          label="Volver al mapa"
          variant="secondary"
          onPress={() => router.back()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: font.xl,
    fontWeight: '800',
  },
  hint: {
    color: colors.muted,
    fontSize: font.sm,
    lineHeight: 20,
  },
  empty: {
    color: colors.muted,
    fontSize: font.md,
    paddingVertical: spacing.lg,
  },
  measureCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
  },
  selected: {
    color: colors.text,
    fontSize: font.sm,
    fontWeight: '600',
  },
});
