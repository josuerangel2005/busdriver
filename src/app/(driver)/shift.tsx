import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Placard } from '@/components/Placard';
import { RouteSelector } from '@/components/RouteSelector';
import { Screen } from '@/components/Screen';
import { DEFAULT_ROUTE_ID, UPDATE_INTERVAL_MS, USE_MOCK } from '@/constants/config';
import { colors, font, fontFamily, spacing } from '@/constants/theme';
import { findActiveRoute, findRoute, oppositeRoute } from '@/lib/routeCatalog';
import { resolveRouteId } from '@/lib/routeSelection';
import { clearFieldLogs, exportFieldLogCsv, listPings } from '@/lib/fieldLog';
import { summarizePings } from '@/lib/fieldTest';
import { canSwitchRole } from '@/lib/roleSwitch';
import { shiftStartBlock } from '@/lib/offlinePresentation';
import { TimeoutError, withTimeout } from '@/lib/withTimeout';
import { loadConsent } from '@/services/consent';
import { getRepository } from '@/services/repository';
import { beginShift, changeShiftDirection, endShift } from '@/services/shift';
import {
  requestLocationPermissions,
  startTracking,
  stopTracking,
  updateTrackingDirection,
} from '@/services/tracking';
import { useAuthStore } from '@/stores/auth';
import { useConnection } from '@/stores/connection';
import { useRouteCatalog } from '@/stores/routeCatalog';
import { useTrackingStore } from '@/stores/tracking';

export default function ShiftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = useAuthStore((state) => state.uid);
  const role = useAuthStore((state) => state.role);
  const { active, session, loading, refresh, setActive } = useTrackingStore();
  const connection = useConnection((state) => state.status);
  const offline = connection === 'offline';
  const startBlock = shiftStartBlock(connection);
  const [attempt, setAttempt] = useState(0);
  const [consent, setConsent] = useState<{
    uid: string;
    attempt: number;
    status: Awaited<ReturnType<typeof loadConsent>>;
  }>();
  const consentStatus = !uid ? 'unavailable'
    : consent?.uid === uid && consent.attempt === attempt ? consent.status : 'checking';
  const [routeId, setRouteId] = useState(DEFAULT_ROUTE_ID);
  const { catalog, ready } = useRouteCatalog();
  const selectedId = active ? session?.rutaId : resolveRouteId(routeId, catalog);
  const route = ready ? (active ? findRoute : findActiveRoute)(catalog, selectedId) : undefined;
  const reverse = route && oppositeRoute(catalog, route);
  const [working, setWorking] = useState(false);
  const [pings, setPings] = useState(() => listPings());
  const [exportingPings, setExportingPings] = useState(false);
  const pingSummary = useMemo(() => summarizePings(pings), [pings]);

  useEffect(() => {
    const timer = setInterval(() => setPings(listPings()), 5_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!uid) return;
    void refresh().catch((error) => {
      console.warn('[tracking] session refresh failed', error);
    });
  }, [uid, refresh]);

  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    void loadConsent(getRepository(), AsyncStorage, uid, useConnection.getState().status)
      .then((status) => {
        if (mounted) setConsent({ uid, attempt, status });
      });
    return () => {
      mounted = false;
    };
  }, [uid, attempt]);

  useEffect(() => {
    if (consentStatus === 'required' && !active && !loading) {
      router.replace('/(driver)/consent');
    }
  }, [consentStatus, active, loading, router]);

  async function handleBeginShift() {
    if (!uid || !route || active || working || consentStatus !== 'accepted'
      || shiftStartBlock(useConnection.getState().status)) {
      return;
    }
    setWorking(true);
    try {
      if (!USE_MOCK) {
        const permissions = await requestLocationPermissions();
        if (!permissions.background) {
          Alert.alert(
            'Permiso de ubicación en segundo plano',
            'Para transmitir con la pantalla apagada necesitas otorgar el permiso "Permitir todo el tiempo" en los ajustes de la aplicación.',
          );
          return;
        }
      }
      const session = { vehiculoId: uid, rutaId: route.id };
      await beginShift(
        {
          getCurrentPosition: USE_MOCK
            ? async () => ({
                lat: route.polyline[0].latitude,
                lng: route.polyline[0].longitude,
                timestamp: Date.now(),
                speed: 0,
              })
            : async () => {
                const position = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.High,
                });
                return {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  timestamp: position.timestamp || Date.now(),
                  speed: position.coords.speed,
                };
              },
          publishVehicle: async (vehicle) => {
            const repository = getRepository();
            try {
              await withTimeout(repository.publishVehicle(vehicle), 8000);
            } catch (error) {
              if (!(error instanceof TimeoutError)) throw error;
              // The initial publish may still reach Firebase. Queue an inactive state
              // after it, since local tracking was never started.
              void repository.setService(vehicle.vehiculo_id, false).catch((failure) => {
                console.warn('[shift] queued start cleanup failed', failure);
              });
              throw new Error('No se pudo confirmar la conexión. Inténtalo de nuevo.');
            }
          },
          startTracking: USE_MOCK ? async () => undefined : startTracking,
        },
        session,
      );
      setActive(true, session);
    } catch (error) {
      Alert.alert('No se pudo iniciar el turno', (error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function handleChangeDirection() {
    if (!active || !session || !reverse || working || consentStatus !== 'accepted'
      || useConnection.getState().status === 'offline') return;
    setWorking(true);
    try {
      const next = await changeShiftDirection(async (nextSession) => {
        const publish = async () => {
          try {
            await withTimeout(getRepository().setVehicleRoute(nextSession.vehiculoId, nextSession.rutaId), 2000);
          } catch (error) {
            // Keep local tracking aligned with a direction change still queued in Firebase.
            if (!(error instanceof TimeoutError)) throw error;
          }
        };
        if (USE_MOCK) await publish();
        else await updateTrackingDirection(session, nextSession, publish);
      }, session, reverse.id, useRouteCatalog.getState().catalog);
      setRouteId(next.rutaId);
      setActive(true, next);
    } catch (error) {
      Alert.alert('No se pudo cambiar el sentido', (error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function handleEndShift() {
    if (!uid) {
      return;
    }
    setWorking(true);
    try {
      await endShift(
        {
          stopTracking: async () => {
            if (!USE_MOCK) await stopTracking();
            setActive(false, null);
          },
          setService: (vehiculoId, enServicio) =>
            getRepository().setService(vehiculoId, enServicio),
        },
        uid,
      );
    } catch (error) {
      Alert.alert('No se pudo finalizar el turno', (error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function handleChangeRole() {
    const check = canSwitchRole({ role, shiftActive: active });
    if (!check.allowed) {
      Alert.alert('Cambiar rol', check.reason ?? '');
      return;
    }
    await useAuthStore.getState().signOut();
    router.replace('/');
  }

  async function handleExportPings() {
    setExportingPings(true);
    try {
      const uri = await exportFieldLogCsv('pings');
      if (!uri) {
        Alert.alert('Sin datos', 'Todavía no hay pings registrados.');
      }
    } catch (error) {
      Alert.alert('No se pudo exportar', (error as Error).message);
    } finally {
      setExportingPings(false);
    }
  }

  function handleClearLogs() {
    Alert.alert(
      'Borrar registros de prueba',
      'Se eliminarán los pings, las latencias y las pruebas de ETA guardadas en este dispositivo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => {
            clearFieldLogs();
            setPings([]);
          },
        },
      ],
    );
  }

  const waitingForConsent = !active && (consentStatus === 'checking' || consentStatus === 'required');
  if (uid && (loading || waitingForConsent)) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>Verificando consentimiento…</Text>
        </View>
      </Screen>
    );
  }

  const consentNotice = (
    <View style={styles.consentNotice}>
      <OfflineNotice message="Sin conexión: no se pudo verificar el consentimiento." />
      <Button label="Reintentar" variant="secondary" onPress={() => setAttempt(attempt + 1)} />
    </View>
  );

  if (!active && consentStatus === 'unavailable') {
    return <Screen>{consentNotice}</Screen>;
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Panel del conductor</Text>
        {active && offline && (
          <OfflineNotice message="Sin conexión: la ubicación se enviará cuando vuelva la señal." />
        )}
        {active && consentStatus === 'unavailable' && consentNotice}

        <Placard tone={active ? 'green' : 'passed'}>
          <View style={styles.stateRow}>
            <Icon
              color={active ? colors.onGreen : colors.passedInk}
              name={active ? 'steering' : 'steering-off'}
              size={36}
            />
            <Text
              style={[
                styles.stateText,
                { color: active ? colors.onGreen : colors.passedInk },
              ]}
            >
              {active ? 'En servicio' : 'Fuera de servicio'}
            </Text>
          </View>
        </Placard>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{route?.nombre ?? 'Ruta no disponible'}</Text>
          <Text style={styles.muted}>
            Trazado aproximado · solicitud de ubicación cada {UPDATE_INTERVAL_MS / 1_000} s
          </Text>
          {!active && route ? (
            <RouteSelector route={route} disabled={working} onSelect={(next) => setRouteId(next.id)} />
          ) : null}
          {active && reverse ? (
            <>
              <Button label="Cambiar sentido" variant="secondary" disabled={working || offline || consentStatus !== 'accepted'} onPress={handleChangeDirection} />
              <Text style={styles.muted}>Hazlo solo con el vehículo detenido. Para cambiar de línea, finaliza el turno.</Text>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transmisión</Text>
          {(!active || !offline) && <Text style={styles.muted}>
            {active
              ? USE_MOCK
                ? 'Turno activo en modo simulado: tu buseta avanza sola por la ruta. No se usa el GPS ni se transmite tu ubicación.'
                : 'La ubicación se está compartiendo en segundo plano. Puedes bloquear el teléfono.'
              : 'Inicia el turno para compartir tu ubicación con los pasajeros.'}
          </Text>}
          {USE_MOCK && !active ? (
            <Text style={styles.muted}>
              Modo simulado: la buseta avanza sola por la ruta, no se usa el GPS del teléfono.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prueba de transmisión</Text>
          <Text style={styles.muted}>
            Pings registrados: {pingSummary.total} · fallidos: {pingSummary.fallidos}
          </Text>
          <Text style={styles.muted}>
            Duración: {formatMinutes(pingSummary.duracionMs)} · intervalo máx:{' '}
            {formatInterval(pingSummary.intervaloMaxMs)}
          </Text>
          <Text style={styles.muted}>
            Intervalos ≤ 10 s: {formatPercent(pingSummary.porcentajeDentroMeta)}
          </Text>
          <Button
            label="Exportar pings CSV"
            variant="secondary"
            loading={exportingPings}
            disabled={pingSummary.total === 0}
            onPress={handleExportPings}
          />
          <Button
            label="Borrar registros de prueba"
            variant="dangerOutline"
            onPress={handleClearLogs}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recomendaciones</Text>
          <Text style={styles.muted}>
            · Mantén la batería por encima del 30 %.{'\n'}
            · Desactiva la optimización de batería para esta app.{'\n'}
            · Verifica que el GPS esté activo.
          </Text>
        </View>

        <Button
          label="Cambiar rol"
          variant="secondary"
          disabled={working}
          onPress={handleChangeRole}
        />
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        {!active && startBlock && <OfflineNotice message={startBlock} />}
        <Button
          label={active ? 'Finalizar turno' : 'Iniciar turno'}
          variant={active ? 'danger' : 'primary'}
          loading={working}
          disabled={!active && (!route || Boolean(startBlock) || consentStatus !== 'accepted')}
          onPress={active ? handleEndShift : handleBeginShift}
        />
      </View>
    </Screen>
  );
}

function formatMinutes(duracionMs: number): string {
  if (duracionMs <= 0) {
    return '0 min';
  }
  return `${(duracionMs / 60_000).toFixed(1)} min`;
}

function formatInterval(intervaloMs: number | null): string {
  if (intervaloMs == null) {
    return '—';
  }
  return `${(intervaloMs / 1000).toFixed(1)} s`;
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: font.headline,
    lineHeight: 32,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateText: {
    flexShrink: 1,
    fontFamily: fontFamily.display,
    fontSize: font.display,
    lineHeight: 44,
  },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '700',
  },
  muted: {
    color: colors.inkMuted,
    fontSize: font.body,
    lineHeight: 24,
  },
  consentNotice: { gap: spacing.sm },
  footer: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.ground,
    borderTopWidth: 2,
    borderTopColor: colors.line,
  },
});
