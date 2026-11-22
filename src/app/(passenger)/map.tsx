import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { OfflineNotice } from '@/components/OfflineNotice';
import { PassengerStopCard } from '@/components/PassengerStopCard';
import { Placard } from '@/components/Placard';
import { RouteMap } from '@/components/RouteMap';
import { RouteSelector } from '@/components/RouteSelector';
import { Screen } from '@/components/Screen';
import { DEFAULT_ROUTE_ID } from '@/constants/config';
import { colors, font, fontFamily, radius, spacing } from '@/constants/theme';
import { useFavoriteStop } from '@/hooks/useFavoriteStop';
import { useNow, useRouteData } from '@/hooks/useRouteData';
import { computeBestStopEtas, isStale } from '@/lib/eta';
import { favoriteFirst } from '@/lib/favoriteStop';
import { passengerStatus } from '@/lib/offlinePresentation';
import { readCleanMapMode, saveCleanMapMode } from '@/lib/passengerMapMode';
import { readPassengerSelection, savePassengerRoute, type RouteSelection } from '@/lib/routeSelection';
import { useAuthStore } from '@/stores/auth';
import { useConnection } from '@/stores/connection';
import type { Parada } from '@/types/models';

export default function PassengerMapScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const connection = useConnection((state) => state.status);
  const [selection, setSelection] = useState<RouteSelection>({ id: DEFAULT_ROUTE_ID });
  const [restoring, setRestoring] = useState(true);
  const [placardHeight, setPlacardHeight] = useState<number>();
  const [viewport, setViewport] = useState<{ width: number; height: number }>();
  const stopList = useRef<ComponentRef<typeof ScrollView>>(null);
  const { ruta, paradas, vehiculos } = useRouteData(selection.id, selection.lineId);
  const routeId = ruta?.id;
  const destination = paradas.at(-1);
  const { favorite, setFavorite } = useFavoriteStop(restoring ? undefined : routeId, paradas);
  const [cleanMode, setCleanMode] = useState(false);
  const modeChanged = useRef(false);

  useEffect(() => {
    let active = true;
    void readCleanMapMode(AsyncStorage).then((saved) => {
      if (active && !modeChanged.current && saved) {
        setViewport(undefined);
        setPlacardHeight(undefined);
        setCleanMode(true);
      }
    });
    return () => { active = false; };
  }, []);

  function measureMapViewport({ nativeEvent: { layout: { width, height } } }: LayoutChangeEvent) {
    setViewport((current) => current?.width === width && current.height === height
      ? current
      : { width, height });
  }

  const changeMode = useCallback((value: boolean) => {
    modeChanged.current = true;
    // Each mode mounts a fresh map; wait for that layout and the returning placard.
    setPlacardHeight(undefined);
    setViewport(undefined);
    setCleanMode(value);
    void saveCleanMapMode(AsyncStorage, value);
  }, []);

  useFocusEffect(useCallback(() => {
    if (!cleanMode) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      changeMode(false);
      return true;
    });
    return () => listener.remove();
  }, [cleanMode, changeMode]));

  useEffect(() => {
    let mounted = true;
    void readPassengerSelection(AsyncStorage).then((saved) => {
      if (mounted) {
        setSelection(saved);
        setRestoring(false);
      }
    });
    return () => { mounted = false; };
  }, []);
  const now = useNow(5_000);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  function selectStop(stop: Parada) {
    setSelectedStopId(stop.id);
    if (restoring || !routeId) return;
    const remove = favorite?.id === stop.id;
    Alert.alert(stop.nombre, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: remove ? 'Quitar mi paradero' : 'Marcar como mi paradero',
        onPress: () => {
          setFavorite(remove ? null : stop.id);
          if (!remove) stopList.current?.scrollTo({ y: 0, animated: false });
        },
      },
    ], { cancelable: true });
  }

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

  const status = passengerStatus(connection, hasVehicle, stale);
  const etasByStop = new Map(etas.map((eta) => [eta.parada.id, eta]));
  const orderedStops = favoriteFirst(paradas, favorite?.id ?? null, (stop) => stop.id);

  return (
    <Screen padded={false}>
      <View style={styles.mapWrapper}>
        <RouteMap
          key={String(cleanMode)}
          ruta={ruta}
          paradas={paradas}
          vehiculos={vehiculos}
          selectedStopId={selectedStopId}
          onSelectStop={selectStop}
          favoriteStopId={favorite?.id}
          cleanMode={cleanMode}
          now={now}
          placardHeight={placardHeight}
          viewport={viewport}
          onViewportLayout={measureMapViewport}
        />
        {!cleanMode && (
          <View style={styles.header} onLayout={(event) => setPlacardHeight(Math.ceil(event.nativeEvent.layout.height))}>
            <Placard tone="plain">
              <View style={styles.placardContent}>
                <Text accessibilityRole="header" numberOfLines={1} ellipsizeMode="tail" style={styles.routeName}>
                  {destination ? `Hacia ${destination.nombre}` : 'Destino no disponible'}
                </Text>
                {ruta && (
                  <RouteSelector
                    route={ruta}
                    disabled={restoring}
                    onSelect={(route) => {
                      if (route.id === routeId) return;
                      setSelectedStopId(null);
                      setSelection({ id: route.id, lineId: route.linea_id });
                      void savePassengerRoute(AsyncStorage, route.id, route.linea_id);
                    }}
                  />
                )}
                {status.banner && <OfflineNotice message={status.banner} />}
                <View style={styles.metaRow}>
                  <Text style={styles.traceNote}>Trazado aproximado</Text>
                  <View>
                    <Badge label={status.label} tone={status.tone} />
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Cambiar rol" onPress={handleChangeRole} style={styles.roleSwitchButton}>
                    <Text style={styles.roleSwitch}>Cambiar rol</Text>
                  </Pressable>
                </View>
              </View>
            </Placard>
          </View>
        )}
        {cleanMode && status.banner && (
          <View style={styles.offline} pointerEvents="none">
            <Badge accessibilityLiveRegion="polite" label={status.label} tone={status.tone} />
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cleanMode ? 'Mostrar información' : 'Ver solo el mapa'}
          onPress={() => changeMode(!cleanMode)}
          style={[styles.modeButton, { bottom: spacing.sm + (cleanMode ? bottom : 0) }]}
        >
          <Icon name={cleanMode ? 'fullscreen-exit' : 'fullscreen'} color={colors.ink} size={24} />
        </Pressable>
      </View>

      {!cleanMode && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Próximas paradas</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver detalle del tiempo estimado"
              accessibilityState={{ disabled: restoring || !routeId }}
              hitSlop={8}
              disabled={restoring || !routeId}
              onPress={() => router.push({ pathname: '/(passenger)/eta', params: { routeId } })}
              style={styles.detailButton}
            >
              <Text style={styles.detailText}>Ver detalle</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={stopList}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {!favorite && !hasVehicle && !status.banner ? (
              <Text style={styles.empty}>
                No hay vehículos en servicio. El tiempo estimado aparecerá cuando un
                conductor inicie su turno.
              </Text>
            ) : null}
            {orderedStops.map((stop) => (
              <PassengerStopCard
                key={stop.id}
                stop={stop}
                eta={etasByStop.get(stop.id)}
                favorite={favorite?.id === stop.id}
                offline={connection === 'offline'}
                selected={selectedStopId === stop.id}
                highlight={highlightStopId === stop.id}
                onPress={() => selectStop(stop)}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
  },
  modeButton: {
    position: 'absolute',
    right: spacing.sm,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: 2,
    borderRadius: radius.control,
  },
  offline: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
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
