import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Screen } from '@/components/Screen';
import { CONSENT_VERSION } from '@/constants/config';
import { colors, font, fontFamily, spacing } from '@/constants/theme';
import { saveAcceptedConsent } from '@/services/consent';
import { getRepository } from '@/services/repository';
import { useAuthStore } from '@/stores/auth';
import { useConnection } from '@/stores/connection';

const SECTIONS = [
  {
    title: 'Qué datos se recolectan',
    body: 'Mientras el turno está activo, la aplicación registra la ubicación GPS del vehículo, la velocidad estimada y la hora de cada lectura.',
  },
  {
    title: 'Para qué se usan',
    body: 'Los datos se usan únicamente para calcular la posición del vehículo y el tiempo estimado de llegada a las paradas. No se almacena un historial de recorridos.',
  },
  {
    title: 'Quién puede verlos',
    body: 'Los pasajeros de la aplicación ven la posición del vehículo mientras está en servicio. El equipo del proyecto accede a los datos de forma anónima para fines académicos.',
  },
  {
    title: 'Cómo se controlan',
    body: 'La transmisión solo ocurre entre el inicio y el fin del turno. Al finalizar el turno, el vehículo deja de ser visible para los pasajeros.',
  },
];

export default function ConsentScreen() {
  const router = useRouter();
  const uid = useAuthStore((state) => state.uid);
  const offline = useConnection((state) => state.status === 'offline');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function accept() {
    if (!uid || offline) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveAcceptedConsent(getRepository(), AsyncStorage, uid, {
        aceptado: true,
        version: CONSENT_VERSION,
        timestamp: Date.now(),
      });
      router.replace('/(driver)/shift');
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Aviso de tratamiento de datos</Text>
        <Text style={styles.intro}>
          Antes de iniciar un turno debes autorizar el uso de tu ubicación. Lee el aviso y
          acepta para continuar.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <Text style={styles.version}>Versión del aviso: {CONSENT_VERSION}</Text>
      </ScrollView>

      <View style={styles.footer}>
        {offline && <OfflineNotice message="Necesitas conexión para guardar el consentimiento." />}
        {!offline && failed && <OfflineNotice message="No se pudo guardar el consentimiento. Inténtalo de nuevo." />}
        <Button label="Acepto y continúo" onPress={accept} disabled={offline} loading={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: font.headline,
    lineHeight: 32,
  },
  intro: {
    color: colors.inkMuted,
    fontSize: font.body,
    lineHeight: 24,
  },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: font.body,
    fontWeight: '700',
  },
  sectionBody: {
    color: colors.inkMuted,
    fontSize: font.body,
    lineHeight: 24,
  },
  version: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
});
