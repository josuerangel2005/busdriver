import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { EtaCard } from '@/components/EtaCard';
import { Placard } from '@/components/Placard';
import { RouteMap } from '@/components/RouteMap';
import { Screen } from '@/components/Screen';
import { colors, font, fontFamily, spacing } from '@/constants/theme';
import { useNow, usePilotData } from '@/hooks/usePilotData';
import { computeBestStopEtas, isStale } from '@/lib/eta';
import { useAuthStore } from '@/stores/auth';

export default function PassengerMapScreen() {
  const router = useRouter();
  const { ruta, paradas, vehiculos } = usePilotData();
  const now = useNow(5_000);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  async function handleChangeRole() {
    await useAuthStore.getState().signOut();
    router.replace('/');
  }

  const activeVehicles = useMemo(
    () => vehiculos.filter((vehiculo) => vehiculo.en_servicio),
    [vehiculos],
  );
  const routeVehicles = useMemo(
    () =>
      ruta
        ? activeVehicles.filter((vehiculo) => vehiculo.ruta_activa === ruta.id)
        : [],
    [activeVehicles, ruta],
  );

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

  const hasVehicle = routeVehicles.length > 0;
  const stale =
    hasVehicle &&
    routeVehicles.every((vehiculo) =>
      isStale(vehiculo.timestamp_ultima_actualizacion, now),
    );

  return (
    <Screen padded={false}>
      <View style={styles.mapWrapper}>
        <RouteMap
          ruta={ruta}
          paradas={paradas}
          vehiculos={activeVehicles}
          selectedStopId={selectedStopId}
          onSelectStop={(parada) => setSelectedStopId(parada.id)}
          now={now}
        />

        <View style={styles.overlay}>
          <Placard tone="plain">
            <View style={styles.placardContent}>
              <View style={styles.overlayHeader}>
                <Text style={styles.routeName} numberOfLines={2}>
                  {ruta?.nombre ?? 'Cargando ruta…'}
                </Text>
                <Badge
                  label={
                    !hasVehicle
                      ? 'Sin unidades'
                      : stale
                        ? 'Datos desactualizados'
                        : 'En servicio'
                  }
                  tone={!hasVehicle ? 'neutral' : stale ? 'danger' : 'success'}
                />
              </View>
              {ruta ? <Text style={styles.routeNote}>Trazado aproximado</Text> : null}
              <Pressable
                accessibilityRole="button"
                hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
                onPress={handleChangeRole}
                style={styles.roleSwitchButton}
              >
                <Text style={styles.roleSwitch}>Cambiar rol</Text>
              </Pressable>
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
            onPress={() => router.push('/(passenger)/eta')}
            style={styles.detailButton}
          >
            <Text style={styles.detailText}>Ver detalle</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {etas.length === 0 ? (
            <Text style={styles.empty}>
              No hay vehículos en servicio. El tiempo estimado aparecerá cuando un
              conductor inicie su turno.
            </Text>
          ) : (
            etas.map((stopEta) => (
              <EtaCard
                key={stopEta.parada.id}
                stopEta={stopEta}
                selected={selectedStopId === stopEta.parada.id}
                highlight={highlightStopId === stopEta.parada.id}
                onPress={() => setSelectedStopId(stopEta.parada.id)}
              />
            ))
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  placardContent: {
    marginVertical: -spacing.xs,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  routeName: {
    flex: 1,
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
    alignSelf: 'flex-start',
  },
  roleSwitch: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  panel: {
    maxHeight: '48%',
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
