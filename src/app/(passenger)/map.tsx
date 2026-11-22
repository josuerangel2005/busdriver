import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { EtaCard } from '@/components/EtaCard';
import { Placard } from '@/components/Placard';
import { RouteMap } from '@/components/RouteMap';
import { RouteSelector } from '@/components/RouteSelector';
import { Screen } from '@/components/Screen';
import { DEFAULT_ROUTE_ID } from '@/constants/config';
import { colors, font, fontFamily, spacing } from '@/constants/theme';
import { findRoute, PARADAS } from '@/data/seed';
import { useNow, useRouteData } from '@/hooks/useRouteData';
import { computeBestStopEtas, isStale } from '@/lib/eta';
import { loadPassengerRoute, savePassengerRoute } from '@/lib/routeSelection';
import { useAuthStore } from '@/stores/auth';

export default function PassengerMapScreen() {
  const router = useRouter();
  const [routeId, setRouteId] = useState(DEFAULT_ROUTE_ID);
  const [restoring, setRestoring] = useState(true);
  const [placardHeight, setPlacardHeight] = useState<number>();
  const { ruta, paradas, vehiculos } = useRouteData(routeId);
  const selectedRoute = ruta ?? findRoute(routeId)!;
  const destination = paradas[paradas.length - 1] ?? PARADAS.reduce<(typeof PARADAS)[number] | undefined>(
    (last, stop) => stop.ruta_id === routeId && (!last || stop.orden > last.orden) ? stop : last,
    undefined,
  );

  useEffect(() => {
    let mounted = true;
    void loadPassengerRoute(AsyncStorage).then((savedId) => {
      if (mounted) {
        setRouteId(savedId);
        setRestoring(false);
      }
    });
    return () => { mounted = false; };
  }, []);
  const now = useNow(5_000);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  async function handleChangeRole() {
    await useAuthStore.getState().signOut();
    router.replace('/');
  }

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

  const hasVehicle = vehiculos.length > 0;
  const stale =
    hasVehicle &&
    vehiculos.every((vehiculo) =>
      isStale(vehiculo.timestamp_ultima_actualizacion, now),
    );

  return (
    <Screen padded={false}>
      <View style={styles.mapWrapper}>
        <RouteMap
          ruta={ruta}
          paradas={paradas}
          vehiculos={vehiculos}
          selectedStopId={selectedStopId}
          onSelectStop={(parada) => setSelectedStopId(parada.id)}
          now={now}
          placardHeight={placardHeight}
        />
        <View style={styles.header} onLayout={(event) => setPlacardHeight(Math.ceil(event.nativeEvent.layout.height))}>
          <Placard tone="plain">
            <View style={styles.placardContent}>
              <Text accessibilityRole="header" numberOfLines={1} ellipsizeMode="tail" style={styles.routeName}>
                {destination ? `Hacia ${destination.nombre}` : 'Destino no disponible'}
              </Text>
              <RouteSelector
                route={selectedRoute}
                disabled={restoring}
                onSelect={(route) => {
                  if (route.id === routeId) return;
                  setSelectedStopId(null);
                  setRouteId(route.id);
                  void savePassengerRoute(AsyncStorage, route.id);
                }}
              />
              <View style={styles.metaRow}>
                <Text style={styles.traceNote}>Trazado aproximado</Text>
                <View>
                  <Badge
                    label={!hasVehicle ? 'Sin unidades' : stale ? 'Desactualizado' : 'En servicio'}
                    tone={!hasVehicle ? 'neutral' : stale ? 'danger' : 'success'}
                  />
                </View>
                <Pressable accessibilityRole="button" onPress={handleChangeRole} style={styles.roleSwitchButton}>
                  <Text style={styles.roleSwitch}>Cambiar rol</Text>
                </Pressable>
              </View>
            </View>
          </Placard>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Próximas paradas</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            disabled={restoring}
            onPress={() => router.push({ pathname: '/(passenger)/eta', params: { routeId } })}
            style={styles.detailButton}
          >
            <Text style={styles.detailText}>Ver detalle</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {!hasVehicle ? (
            <Text style={styles.empty}>
              No hay vehículos en servicio. El tiempo estimado aparecerá cuando un
              conductor inicie su turno.
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
              <Text style={styles.routeNote}>{stop.orden}. {stop.nombre}</Text>
            </Placard>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: spacing.sm,
    right: spacing.sm,
    paddingTop: spacing.sm,
  },
  placardContent: {
    marginVertical: -spacing.sm,
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  traceNote: {
    flexShrink: 1,
    color: colors.inkMuted,
    fontSize: font.label,
  },
  routeName: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: font.title,
    lineHeight: 23,
  },
  routeNote: {
    color: colors.inkMuted,
    fontSize: font.body,
  },
  roleSwitchButton: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
  },
  roleSwitch: {
    color: colors.ink,
    fontSize: font.label,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  panel: {
    maxHeight: '38%',
    backgroundColor: colors.ground,
    paddingTop: spacing.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  panelTitle: {
    flexShrink: 1,
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: font.headline,
    lineHeight: 32,
  },
  detailButton: {
    justifyContent: 'center',
    minHeight: 48,
    paddingLeft: spacing.md,
  },
  detailText: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  empty: {
    color: colors.inkMuted,
    fontSize: font.body,
    lineHeight: 24,
    paddingVertical: spacing.md,
  },
});
