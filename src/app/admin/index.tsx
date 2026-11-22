import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Placard } from '@/components/Placard';
import { Screen } from '@/components/Screen';
import { colors, font, fontFamily, spacing } from '@/constants/theme';
import { stopsFor } from '@/lib/routeCatalog';
import { getRepository } from '@/services/repository';
import { useAuthStore } from '@/stores/auth';
import { useRouteCatalog } from '@/stores/routeCatalog';
import type { Ruta } from '@/types/models';

function groupByLine(routes: Ruta[]) {
  const lines = new Map<string, { id: string; name: string; directions: Ruta[] }>();
  for (const route of routes) {
    const line = lines.get(route.linea_id);
    if (line) line.directions.push(route);
    else lines.set(route.linea_id, { id: route.linea_id, name: route.linea_nombre, directions: [route] });
  }
  return [...lines.values()];
}

export default function AdminScreen() {
  const { ready, uid, role, adminVerified, signOut } = useAuthStore();
  const catalog = useRouteCatalog((state) => state.catalog);
  const { bottom } = useSafeAreaInsets();
  const [busy, setBusy] = useState<{ action: 'sign-out' } | { action: 'toggle'; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setBusy({ action: 'sign-out' });
    setError(null);
    try {
      await signOut();
    } catch {
      setError('No pudimos cerrar la sesión. Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  function edit(lineaId: string) {
    router.push({ pathname: '/admin/line/[lineaId]', params: { lineaId } });
  }

  async function setActive(id: string, active: boolean) {
    if (!useAuthStore.getState().adminVerified) return;
    setBusy({ action: 'toggle', id });
    setError(null);
    try {
      await getRepository().setLineActive(id, active);
    } catch {
      setError('No pudimos cambiar el estado de la línea. Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  function confirm(id: string, name: string, active: boolean) {
    const action = active ? 'Activar línea' : 'Desactivar línea';
    Alert.alert(action, active
      ? `Los dos sentidos de ${name} volverán a aparecer en la selección de rutas.`
      : `Los dos sentidos de ${name} dejarán de aparecer en la selección de rutas. Sus datos se conservarán.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: action, style: active ? 'default' : 'destructive', onPress: () => void setActive(id, active) },
    ]);
  }

  if (!ready) return <Screen />;
  if (role !== 'admin' || !uid) return <Redirect href="/" />;

  if (!adminVerified) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Administración</Text>
          <OfflineNotice message="Permisos sin verificar. Se comprobarán cuando vuelva la conexión." />
          {error && <Badge label={error} tone="danger" accessibilityLiveRegion="polite" />}
          <Button label="Cerrar sesión" variant="secondary" loading={busy?.action === 'sign-out'} onPress={leave} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={groupByLine(catalog.routes)}
        keyExtractor={(line) => line.id}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.lg }]}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Administración</Text>
            <Button label="Nueva línea" disabled={busy !== null} onPress={() => edit('nueva')} />
            {error && <Badge label={error} tone="danger" accessibilityLiveRegion="polite" />}
          </View>
        )}
        ListEmptyComponent={<Badge label="No hay rutas para mostrar." />}
        renderItem={({ item }) => {
          const active = item.directions.some((route) => route.activa !== false);
          return (
            <Placard tone="plain">
              <View style={styles.line}>
                <Text accessibilityRole="header" style={styles.name}>{item.name}</Text>
                <Badge label={active ? 'Activa' : 'Inactiva'} tone={active ? 'success' : 'neutral'} />
                {[...item.directions].sort((a, b) => a.sentido.localeCompare(b.sentido)).map((route) => {
                  const stops = stopsFor(catalog, route.id);
                  const endpoints = stops.length >= 2
                    ? `${stops[0].nombre} → ${stops.at(-1)?.nombre}`
                    : route.nombre;
                  return (
                    <Text key={route.id} style={styles.note}>
                      {route.sentido === 'ida' ? 'Ida' : 'Vuelta'}: {endpoints}
                    </Text>
                  );
                })}
                <View style={styles.actions}>
                  <Button label="Editar" accessibilityLabel={`Editar ${item.name}`} variant="secondary" disabled={busy !== null} onPress={() => edit(item.id)} />
                  <Button
                    label={active ? 'Desactivar línea' : 'Activar línea'}
                    accessibilityLabel={`${active ? 'Desactivar línea' : 'Activar línea'}: ${item.name}`}
                    variant={active ? 'dangerOutline' : 'secondary'}
                    disabled={busy !== null}
                    loading={busy?.action === 'toggle' && busy.id === item.id}
                    onPress={() => confirm(item.id, item.name, !active)}
                  />
                </View>
              </View>
            </Placard>
          );
        }}
        ListFooterComponent={(
          <Button label="Cerrar sesión" variant="secondary" loading={busy?.action === 'sign-out'} disabled={busy !== null} onPress={() => void leave()} />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.md },
  header: { gap: spacing.md },
  title: { color: colors.ink, fontFamily: fontFamily.display, fontSize: font.display },
  line: { gap: spacing.sm },
  name: { color: colors.ink, fontSize: font.title, fontWeight: '700' },
  note: { color: colors.inkMuted, fontSize: font.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
