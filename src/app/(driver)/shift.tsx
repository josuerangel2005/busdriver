import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { PILOT_ROUTE_ID, USE_MOCK } from '@/constants/config';
import { colors, font, radius, spacing } from '@/constants/theme';
import { PLACEHOLDER_ROUTE } from '@/data/seed';
import { clearFieldLogs, exportFieldLogCsv, listPings } from '@/lib/fieldLog';
import { summarizePings } from '@/lib/fieldTest';
import { canSwitchRole } from '@/lib/roleSwitch';
import { getRepository } from '@/services/repository';
import { beginShift, endShift } from '@/services/shift';
import {
  requestLocationPermissions,
  startTracking,
  stopTracking,
} from '@/services/tracking';
import { useAuthStore } from '@/stores/auth';
import { useTrackingStore } from '@/stores/tracking';

export default function ShiftScreen() {
  const router = useRouter();
  const uid = useAuthStore((state) => state.uid);
  const role = useAuthStore((state) => state.role);
  const { active, loading, refresh, setActive } = useTrackingStore();
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [pings, setPings] = useState(() => listPings());
  const [exportingPings, setExportingPings] = useState(false);
  const pingSummary = useMemo(() => summarizePings(pings), [pings]);

  useEffect(() => {
    const timer = setInterval(() => setPings(listPings()), 5_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkConsent() {
      if (!uid) {
        return;
      }
      const consent = await getRepository().getConsent(uid);
      if (!mounted) {
        return;
      }
      if (!consent?.aceptado) {
        router.replace('/(driver)/consent');
        return;
      }
      await refresh();
      if (mounted) {
        setChecking(false);
      }
    }

    void checkConsent();

    return () => {
      mounted = false;
    };
  }, [uid, refresh, router]);

  async function handleBeginShift() {
    if (!uid) {
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
      const session = { vehiculoId: uid, rutaId: PILOT_ROUTE_ID };
      await beginShift(
        {
          getCurrentPosition: USE_MOCK
            ? async () => ({
                lat: PLACEHOLDER_ROUTE.polyline[0].latitude,
                lng: PLACEHOLDER_ROUTE.polyline[0].longitude,
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
          publishVehicle: (vehiculo) => getRepository().publishVehicle(vehiculo),
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

  async function handleEndShift() {
    if (!uid) {
      return;
    }
    setWorking(true);
    try {
      await endShift(
        {
          stopTracking: USE_MOCK ? async () => undefined : stopTracking,
          setService: (vehiculoId, enServicio) =>
            getRepository().setService(vehiculoId, enServicio),
        },
        uid,
      );
      setActive(false, null);
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

  if (checking || loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>Verificando consentimiento…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Panel del conductor</Text>
          <Badge
            label={active ? 'En servicio' : 'Fuera de servicio'}
            tone={active ? 'success' : 'neutral'}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{PLACEHOLDER_ROUTE.nombre}</Text>
          <Text style={styles.muted}>
            {PLACEHOLDER_ROUTE.polyline.length} puntos de recorrido · actualización cada 10 s
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transmisión</Text>
          <Text style={styles.muted}>
            {active
              ? USE_MOCK
                ? 'Turno activo en modo simulado: tu buseta avanza sola por la ruta. No se usa el GPS ni se transmite tu ubicación.'
                : 'La ubicación se está compartiendo en segundo plano. Puedes bloquear el teléfono.'
              : 'Inicia el turno para compartir tu ubicación con los pasajeros.'}
          </Text>
          {USE_MOCK && !active ? (
            <Text style={styles.muted}>
              Modo simulado: la buseta avanza sola por la ruta, no se usa el GPS del teléfono.
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Prueba de transmisión</Text>
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
            variant="danger"
            onPress={handleClearLogs}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recomendaciones</Text>
          <Text style={styles.muted}>
            · Mantén la batería por encima del 30 %.{'\n'}
            · Desactiva la optimización de batería para esta app.{'\n'}
            · Verifica que el GPS esté activo.
          </Text>
        </View>

        <Button
          label={active ? 'Finalizar turno' : 'Iniciar turno'}
          variant={active ? 'danger' : 'primary'}
          loading={working}
          onPress={active ? handleEndShift : handleBeginShift}
        />

        <Button
          label="Cambiar rol"
          variant="secondary"
          onPress={handleChangeRole}
        />
      </ScrollView>
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
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: font.xl,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
  },
  muted: {
    color: colors.muted,
    fontSize: font.sm,
    lineHeight: 20,
  },
});
