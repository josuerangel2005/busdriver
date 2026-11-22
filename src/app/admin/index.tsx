import { Redirect } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, font, fontFamily, spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';
import { useRouteCatalog } from '@/stores/routeCatalog';
import type { Ruta } from '@/types/models';

function groupByLine(routes: Ruta[]) {
  const lines = new Map<string, { key: string; title: string; data: Ruta[] }>();
  for (const route of routes) {
    const line = lines.get(route.linea_id);
    if (line) {
      line.data.push(route);
    } else {
      lines.set(route.linea_id, { key: route.linea_id, title: route.linea_nombre, data: [route] });
    }
  }
  return [...lines.values()];
}

export default function AdminScreen() {
  const { ready, uid, role, signOut } = useAuthStore();
  const catalog = useRouteCatalog((state) => state.catalog);
  const { bottom } = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError('No pudimos cerrar la sesión. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Screen />;
  if (role !== 'admin' || !uid) return <Redirect href="/" />;

  return (
    <Screen>
      <SectionList
        sections={groupByLine(catalog.routes)}
        keyExtractor={(route) => route.id}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.lg }]}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Administración</Text>
            <Text style={styles.note}>Podrás editar las rutas en una próxima versión.</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.note}>No hay rutas para mostrar.</Text>}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={styles.line}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.nombre}</Text>
            <Text style={styles.note}>
              {item.sentido === 'ida' ? 'Ida' : 'Vuelta'} · {item.activa === false ? 'Inactiva' : 'Activa'}
            </Text>
          </View>
        )}
        ListFooterComponent={(
          <View style={styles.footer}>
            {error && (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            )}
            <Button label="Cerrar sesión" variant="secondary" loading={busy} onPress={() => void leave()} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.ink, fontFamily: fontFamily.display, fontSize: font.display },
  line: { color: colors.ink, fontSize: font.title, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  row: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
  name: { color: colors.ink, fontSize: font.body, fontWeight: '700' },
  note: { color: colors.inkMuted, fontSize: font.body },
  footer: { marginTop: spacing.lg, gap: spacing.sm },
  error: { color: colors.signRed, fontSize: font.body },
});
