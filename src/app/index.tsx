import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { APP_NAME, USE_MOCK } from '@/constants/config';
import { colors, font, radius, spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { uid, role, ready, signIn } = useAuthStore();

  useEffect(() => {
    if (!ready || !uid || !role) {
      return;
    }
    router.replace(role === 'conductor' ? '/(driver)/shift' : '/(passenger)/map');
  }, [ready, uid, role, router]);

  async function choose(nextRole: 'conductor' | 'pasajero') {
    await signIn(nextRole);
    router.replace(nextRole === 'conductor' ? '/(driver)/shift' : '/(passenger)/map');
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>RC</Text>
        </View>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>
          Seguimiento del transporte público en tiempo real para la ciudad de Cúcuta.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Soy conductor" onPress={() => choose('conductor')} />
        <Button
          label="Soy pasajero"
          variant="secondary"
          onPress={() => choose('pasajero')}
        />
        {USE_MOCK ? (
          <Text style={styles.note}>
            Modo demostración: los datos se simulan en el dispositivo. Configura Firebase
            para usar datos reales.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: colors.surface,
    fontSize: font.xxl,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: font.xxl,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: font.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  note: {
    color: colors.muted,
    fontSize: font.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
