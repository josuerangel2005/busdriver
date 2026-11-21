import { Anton_400Regular, useFonts } from '@expo-google-fonts/anton';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth';
import '@/tasks/backgroundLocation';

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const [fontsLoaded, fontError] = useFonts({ Anton_400Regular });

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!fontsLoaded && !fontError) {
    return <View style={styles.boot} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.ground,
  },
});
