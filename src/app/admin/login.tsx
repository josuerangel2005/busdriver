import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { USE_MOCK } from '@/constants/config';
import { colors, font, fontFamily, radius, spacing } from '@/constants/theme';
import { DEMO_ADMIN } from '@/services/demoAdmin';
import { useAuthStore } from '@/stores/auth';

function signInMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  switch (code) {
    case 'admin/not-allowed':
      return 'Esta cuenta no tiene permisos de administrador.';
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'El correo electrónico o la contraseña no son correctos.';
    case 'auth/network-request-failed':
    case 'database/network-error':
    case 'database/disconnected':
      return 'No hay conexión. Revisa tu conexión a internet e inténtalo de nuevo.';
    default:
      if (error instanceof Error && /client is offline|network error/i.test(error.message)) {
        return 'No hay conexión. Revisa tu conexión a internet e inténtalo de nuevo.';
      }
      return 'No pudimos iniciar sesión. Inténtalo de nuevo.';
  }
}

export default function AdminLoginScreen() {
  const { ready, role, adminSigningIn, signInAdmin } = useAuthStore();
  const { bottom } = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0 && !adminSigningIn;

  async function submit() {
    if (!canSubmit || !ready || role) return;
    setError(null);
    Keyboard.dismiss();
    try {
      await signInAdmin(email.trim(), password);
      setPassword('');
    } catch (cause) {
      setError(signInMessage(cause));
    }
  }

  if (!ready) return <Screen />;
  if (role === 'admin') return <Redirect href="/admin" />;
  if (role) return <Redirect href="/" />;

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.lg }]}
      >
        <Text accessibilityRole="header" style={styles.title}>Ingreso de administrador</Text>
        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              accessibilityLabel="Correo electrónico"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!adminSigningIn}
              keyboardType="email-address"
              onChangeText={setEmail}
              style={styles.input}
              value={email}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              accessibilityLabel="Contraseña"
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!adminSigningIn}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              returnKeyType="go"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>
        </View>
        {error && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        )}
        <Button label="Iniciar sesión" onPress={() => void submit()} loading={adminSigningIn} disabled={!canSubmit} />
        {USE_MOCK && (
          <Text style={styles.hint}>
            Cuenta de demostración: {DEMO_ADMIN.email}{'\n'}
            Contraseña: {DEMO_ADMIN.password}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.lg },
  title: { color: colors.ink, fontFamily: fontFamily.display, fontSize: font.headline },
  fields: { gap: spacing.md },
  field: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: font.body },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderColor: colors.inkMuted,
    borderRadius: radius.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: font.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  hint: { color: colors.inkMuted, fontSize: font.body },
  error: { color: colors.signRed, fontSize: font.body },
});
