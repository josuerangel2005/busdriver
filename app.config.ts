import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

const FIREBASE_PLUGINS = new Set(['@react-native-firebase/app', '@react-native-firebase/auth']);

function pluginName(plugin: PluginEntry): string {
  return Array.isArray(plugin) ? (plugin[0] ?? '') : plugin;
}

/**
 * Pure transform applied to the static Expo config.
 *
 * In mock mode the React Native Firebase config plugins and the
 * `googleServicesFile` entries are removed so a native prebuild/build does not
 * require the Firebase credential files. In Firebase mode the config is
 * returned untouched, except that a missing Android credential file fails
 * early with an actionable message.
 */
export function applyFirebaseMode(
  config: ExpoConfig,
  useMock: boolean,
  fileExists: (path: string) => boolean,
): ExpoConfig {
  if (!useMock) {
    const androidGoogleServicesFile = config.android?.googleServicesFile;
    if (androidGoogleServicesFile && !fileExists(androidGoogleServicesFile)) {
      throw new Error(
        `No se encontró el archivo ${androidGoogleServicesFile} en la raíz del proyecto. ` +
          'Colócalo antes de compilar sin modo simulado. ' +
          'Consulta la sección "Puesta en marcha con Firebase" del README.',
      );
    }
    return config;
  }

  const plugins = (config.plugins ?? []).filter((plugin) => !FIREBASE_PLUGINS.has(pluginName(plugin)));

  const next: ExpoConfig = { ...config, plugins };

  if (config.android) {
    next.android = { ...config.android };
    delete next.android.googleServicesFile;
  }

  if (config.ios) {
    next.ios = { ...config.ios };
    delete next.ios.googleServicesFile;
  }

  return next;
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const useMock = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
  const fileExists = (path: string): boolean => existsSync(resolve(projectRoot, path));

  return applyFirebaseMode(config as ExpoConfig, useMock, fileExists);
};
