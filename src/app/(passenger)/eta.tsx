import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EtaCard } from '@/components/EtaCard';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Placard } from '@/components/Placard';
import { Screen } from '@/components/Screen';
import { colors, font, fontFamily, spacing } from '@/constants/theme';
import { useNow, useRouteData } from '@/hooks/useRouteData';
import { passengerStatus } from '@/lib/offlinePresentation';
import { useConnection } from '@/stores/connection';
import { computeBestStopEtas } from '@/lib/eta';
import {
  exportFieldLogCsv,
  listEtaTrials,
  listLatencies,
  logEtaTrial,
} from '@/lib/fieldLog';
import {
  summarizeEtaErrors,
  summarizeLatencies,
  type EtaTrialLog,
  type LatencyLog,
} from '@/lib/fieldTest';
import { exportWaitsCsv, finishWait, listWaits, startWait } from '@/lib/metrics';

type ActiveTrial = {
  waitId: string;
  paradaId: string;
  vehiculoId: string | null;
  etaPredichaS: number | null;
  inicio: number;
};

export default function PassengerEtaScreen() {
  const router = useRouter();
  const connection = useConnection((state) => state.status);
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const { ruta, paradas, vehiculos } = useRouteData(routeId);
  const now = useNow(5_000);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [activeTrial, setActiveTrial] = useState<ActiveTrial | null>(null);
  const [savedCount, setSavedCount] = useState(() => listWaits().length);
  const [exporting, setExporting] = useState(false);
  const [exportingField, setExportingField] = useState<
    'latencias' | 'pruebas_eta' | null
  >(null);
  const activeWait = activeTrial?.waitId ?? null;

  const latencyLogs: LatencyLog[] = listLatencies();
  const etaTrials: EtaTrialLog[] = listEtaTrials();
  const latencySummary = useMemo(
    () => summarizeLatencies(latencyLogs),
    [latencyLogs],
  );
  const etaSummary = useMemo(
    () => summarizeEtaErrors(etaTrials),
    [etaTrials],
  );

  const hasVehicle = vehiculos.length > 0;
  const status = passengerStatus(connection, hasVehicle, false, 'Vehículo en servicio');

  const etas = useMemo(() => {
    if (!ruta) {
      return [];
    }
    return computeBestStopEtas(ruta, paradas, vehiculos, now);
  }, [ruta, paradas, vehiculos, now]);

  const highlightStopId = useMemo(
    () => etas.find((stopEta) => !stopEta.pasada)?.parada.id ?? null,
    [etas],
  );

  function beginWait() {
    if (!selectedStopId) {
      return;
    }
    const stopEta = etas.find((eta) => eta.parada.id === selectedStopId);
    setActiveTrial({
      waitId: startWait(selectedStopId),
      paradaId: selectedStopId,
      vehiculoId: stopEta?.vehiculoId ?? null,
      etaPredichaS: stopEta?.etaSegundos ?? null,
      inicio: Date.now(),
    });
  }

  function endWait() {
    if (!activeTrial) {
      return;
    }
    const llegada = Date.now();
    finishWait(activeTrial.waitId);
    logEtaTrial({
      parada_id: activeTrial.paradaId,
      vehiculo_id: activeTrial.vehiculoId,
      inicio: activeTrial.inicio,
      eta_predicha_s: activeTrial.etaPredichaS,
      llegada,
    });
    setActiveTrial(null);
    setSavedCount(listWaits().length);
  }

  async function exportFieldCsv(kind: 'latencias' | 'pruebas_eta') {
    setExportingField(kind);
    try {
      const uri = await exportFieldLogCsv(kind);
      if (!uri) {
        Alert.alert(
          'Sin datos',
          kind === 'latencias'
            ? 'Todavía no hay mediciones de latencia registradas.'
            : 'Todavía no hay pruebas de ETA registradas.',
        );
      }
    } catch (error) {
      Alert.alert('No se pudo exportar', (error as Error).message);
    } finally {
      setExportingField(null);
    }
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
          {ruta ? <Text style={styles.hint}>{ruta.nombre} · Trazado aproximado</Text> : null}
          {status.banner && <OfflineNotice message={status.banner} />}
          <Badge label={status.label} tone={status.tone} />
        </View>

        <Text style={styles.hint}>
          Toca una parada para seleccionarla. Las distancias se calculan sobre el recorrido
          de la ruta, no en línea recta.
        </Text>

        {etas.length === 0 ? (
          <Text style={styles.empty}>
            No hay datos para calcular el tiempo estimado en este momento.
          </Text>
        ) : null}
        {etas.map((stopEta) => (
          <EtaCard
            key={stopEta.parada.id}
            stopEta={stopEta}
            selected={selectedStopId === stopEta.parada.id}
            highlight={highlightStopId === stopEta.parada.id}
            onPress={() => setSelectedStopId(stopEta.parada.id)}
          />
        ))}
        {!hasVehicle && paradas.map((stop) => (
          <Placard key={stop.id} tone="plain" selected={selectedStopId === stop.id} onPress={() => setSelectedStopId(stop.id)}>
            <Text style={styles.hint}>{stop.orden}. {stop.nombre}</Text>
          </Placard>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medición de espera (estudio)</Text>
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
          <Text style={styles.count}>Mediciones guardadas: {savedCount}</Text>
          <Button
            label="Exportar CSV anónimo"
            variant="secondary"
            loading={exporting}
            disabled={savedCount === 0}
            onPress={exportCsv}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pruebas de campo</Text>
          <Text style={styles.hint}>
            Latencia del marcador (meta ≤ 15 s): {latencySummary.total} registros ·
            promedio {formatMs(latencySummary.promedioMs)} · máx{' '}
            {formatMs(latencySummary.maxMs)} ·{' '}
            {formatPercent(latencySummary.porcentajeDentroMeta)} dentro de meta.
          </Text>
          <Text style={styles.hint}>
            Error del ETA (meta ≤ 3 min): {etaSummary.total} pruebas (
            {etaSummary.conPrediccion} con predicción) · promedio{' '}
            {formatSeconds(etaSummary.errorAbsPromedioS)} · máx{' '}
            {formatSeconds(etaSummary.errorAbsMaxS)} ·{' '}
            {formatPercent(etaSummary.porcentajeDentroMeta)} dentro de meta.
          </Text>
          <Button
            label="Exportar latencias CSV"
            variant="secondary"
            loading={exportingField === 'latencias'}
            disabled={latencyLogs.length === 0}
            onPress={() => exportFieldCsv('latencias')}
          />
          <Button
            label="Exportar pruebas ETA CSV"
            variant="secondary"
            loading={exportingField === 'pruebas_eta'}
            disabled={etaTrials.length === 0}
            onPress={() => exportFieldCsv('pruebas_eta')}
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

function formatMs(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return `${Math.round(value)} ms`;
}

function formatSeconds(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return `${value.toFixed(1)} s`;
}

function formatPercent(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return `${Math.round(value)} %`;
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: font.headline,
    lineHeight: 32,
  },
  hint: {
    color: colors.inkMuted,
    fontSize: font.body,
    lineHeight: 24,
  },
  empty: {
    color: colors.inkMuted,
    fontSize: font.body,
    lineHeight: 24,
    paddingVertical: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: font.title,
    lineHeight: 24,
  },
  selected: {
    color: colors.ink,
    fontSize: font.body,
    lineHeight: 24,
    fontWeight: '600',
  },
  count: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
