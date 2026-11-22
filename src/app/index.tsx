import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Placard } from '@/components/Placard';
import { Screen } from '@/components/Screen';
import { APP_NAME, USE_MOCK } from '@/constants/config';
import { colors, font, fontFamily, spacing } from '@/constants/theme';
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
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.mark}
        >
          <Placard tone="yellow">
            <View style={styles.markContent}>
              <View style={styles.markIcon}>
                <Icon name="bus-side" size={46} color={colors.onYellow} />
              </View>
              <Text allowFontScaling={false} style={styles.markText}>YA</Text>
            </View>
          </Placard>
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
  mark: {
    alignItems: 'center',
  },
  markContent: {
    // Use the placard padding for the artwork without changing its outer size.
    width: 42 + 2 * spacing.md,
    height: 48 + 2 * spacing.md,
    margin: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  markIcon: {
    height: 32,
    justifyContent: 'center',
  },
  markText: {
    color: colors.onYellow,
    fontFamily: fontFamily.display,
    fontSize: 46,
    lineHeight: 44,
    includeFontPadding: false,
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: font.display,
    lineHeight: 44,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: font.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  note: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
