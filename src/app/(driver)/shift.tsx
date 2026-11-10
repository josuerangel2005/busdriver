import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { PILOT_ROUTE_ID } from '@/constants/config';
import { colors, font, radius, spacing } from '@/constants/theme';
import { PLACEHOLDER_ROUTE } from '@/data/seed';
import { getRepository } from '@/services/repository';
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
  const { active, loading, refresh, setActive } = useTrackingStore();
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);

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

  async function beginShift() {
    if (!uid) {
      return;
    }
    setWorking(true);
    try {
      const permissions = await requestLocationPermissions();
      if (!permissions.background) {
        Alert.alert(
          'Permiso de ubicación en segundo plano',
          'Para transmitir con la pantalla apagada necesitas otorgar el permiso "Permitir todo el tiempo" en los ajustes de la aplicación.',
        );
        return;
      }
      await startTracking({ vehiculoId: uid, rutaId: PILOT_ROUTE_ID });
      await getRepository().setService(uid, true);
      setActive(true, { vehiculoId: uid, rutaId: PILOT_ROUTE_ID });
    } catch (error) {
      Alert.alert('No se pudo iniciar el turno', (error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function endShift() {
    if (!uid) {
      return;
    }
    setWorking(true);
    try {
      await getRepository().setService(uid, false);
      await stopTracking();
      setActive(false, null);
    } catch (error) {
      Alert.alert('No se pudo finalizar el turno', (error as Error).message);
    } finally {
      setWorking(false);
    }
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
              ? 'La ubicación se está compartiendo en segundo plano. Puedes bloquear el teléfono.'
              : 'Inicia el turno para compartir tu ubicación con los pasajeros.'}
          </Text>
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
          onPress={active ? endShift : beginShift}
        />

        <Button
          label="Volver al inicio"
          variant="secondary"
          onPress={() => router.replace('/')}
        />
      </ScrollView>
    </Screen>
  );
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
