import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { EtaCard } from '@/components/EtaCard';
import { RouteMap } from '@/components/RouteMap';
import { Screen } from '@/components/Screen';
import { colors, font, radius, spacing } from '@/constants/theme';
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
        />

        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <View style={styles.overlayHeader}>
              <Text style={styles.routeName} numberOfLines={1}>
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
            <Pressable hitSlop={8} onPress={handleChangeRole}>
              <Text style={styles.roleSwitch}>Cambiar rol</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Próximas paradas</Text>
          <Pressable onPress={() => router.push('/(passenger)/eta')}>
            <Text style={styles.link}>Ver detalle</Text>
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
  overlayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  routeName: {
    flex: 1,
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  roleSwitch: {
    color: colors.muted,
    fontSize: font.sm,
    fontWeight: '600',
  },
  panel: {
    maxHeight: '48%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  panelTitle: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: '700',
  },
  link: {
    color: colors.primary,
    fontSize: font.sm,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  empty: {
    color: colors.muted,
    fontSize: font.sm,
    lineHeight: 20,
    paddingVertical: spacing.md,
  },
});
