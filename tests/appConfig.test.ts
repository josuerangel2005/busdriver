import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { ExpoConfig } from 'expo/config';
import { describe, expect, it } from 'vitest';

import { applyFirebaseMode } from '../app.config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

const appJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../app.json', import.meta.url)), 'utf8'),
) as { expo: ExpoConfig };

const baseConfig = structuredClone(appJson.expo);

function pluginName(plugin: PluginEntry): string {
  return Array.isArray(plugin) ? (plugin[0] ?? '') : plugin;
}

function firebaseFixture(): ExpoConfig {
  const fixture = structuredClone(baseConfig);
  fixture.plugins = (fixture.plugins ?? []).map<PluginEntry>((plugin) =>
    plugin === '@react-native-firebase/app'
      ? ['@react-native-firebase/app', { android: {} }]
      : plugin,
  );
  return fixture;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

describe('applyFirebaseMode', () => {
  it('removes Firebase plugins (string and tuple forms) and googleServicesFile fields in mock mode', () => {
    const fixture = firebaseFixture();

    expect(fixture.plugins).toContainEqual(['@react-native-firebase/app', { android: {} }]);
    expect(fixture.plugins).toContain('@react-native-firebase/auth');

    const result = applyFirebaseMode(fixture, true, () => false);

    const expectedPlugins = (fixture.plugins ?? []).filter(
      (plugin) =>
        pluginName(plugin) !== '@react-native-firebase/app' &&
        pluginName(plugin) !== '@react-native-firebase/auth',
    );

    const expected: ExpoConfig = {
      ...fixture,
      plugins: expectedPlugins,
      android: { ...fixture.android },
      ios: { ...fixture.ios },
    };
    delete expected.android?.googleServicesFile;
    delete expected.ios?.googleServicesFile;

    expect(result).toEqual(expected);
    expect(result.plugins).toEqual(expectedPlugins);
    expect(result.android?.googleServicesFile).toBeUndefined();
    expect(result.ios?.googleServicesFile).toBeUndefined();
    expect(result.plugins?.some((plugin) => pluginName(plugin).startsWith('@react-native-firebase/'))).toBe(false);
  });

  it('does not mutate the input object in mock mode', () => {
    const fixture = deepFreeze(firebaseFixture());
    const snapshot = structuredClone(fixture);

    applyFirebaseMode(fixture, true, () => false);

    expect(fixture).toEqual(snapshot);
  });

  it('returns the input deeply unchanged in Firebase mode when the Android file exists', () => {
    const fixture = firebaseFixture();

    // Android file present; iOS file deliberately missing must be ignored.
    const result = applyFirebaseMode(
      fixture,
      false,
      (path) => path.endsWith('google-services.json'),
    );

    expect(result).toEqual(fixture);
  });

  it('keeps the pinned Kotlin version and static iOS frameworks in mock mode', () => {
    const result = applyFirebaseMode(firebaseFixture(), true, () => false);

    const buildProperties = (result.plugins ?? []).find(
      (plugin) => pluginName(plugin) === 'expo-build-properties',
    );

    expect(Array.isArray(buildProperties)).toBe(true);

    const options = (
      buildProperties as [string, { android?: { kotlinVersion?: string }; ios?: { useFrameworks?: string } }]
    )[1];

    expect(options.android?.kotlinVersion).toBe('2.3.21');
    expect(options.ios?.useFrameworks).toBe('static');
  });

  it('throws a Spanish error naming google-services.json when the Android file is missing', () => {
    const fixture = firebaseFixture();

    expect(() => applyFirebaseMode(fixture, false, () => false)).toThrow(/google-services\.json/);

    let message = '';
    try {
      applyFirebaseMode(fixture, false, () => false);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('Puesta en marcha con Firebase');
  });
});
