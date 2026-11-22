import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { applyReleaseSigning } from '../plugins/withReleaseSigning';

const gradle = readFileSync(new URL('./fixtures/expo-app.build.gradle', import.meta.url), 'utf8');

describe('release signing Gradle transform', () => {
  it.each([
    ['tab indentation', '            signingConfig signingConfigs.debug', '\tsigningConfig signingConfigs.debug'],
    ['missing debug signing line', '            signingConfig signingConfigs.debug', ''],
  ])('throws when the release template drifts: %s', (_case, original, replacement) => {
    const releaseStart = gradle.indexOf('        release {');
    const signingLine = gradle.indexOf(original, releaseStart);
    expect(releaseStart).toBeGreaterThanOrEqual(0);
    expect(signingLine).toBeGreaterThan(releaseStart);
    const drifted = gradle.slice(0, signingLine) + replacement + gradle.slice(signingLine + original.length);

    expect(() => applyReleaseSigning(drifted)).toThrow('expected Expo signing blocks not found');
  });

  it('inserts one signing config, leaves the debug build type alone and is idempotent', () => {
    const result = applyReleaseSigning(gradle);
    expect(result.split('    buildTypes {')[0].match(/^        release \{/gm)).toHaveLength(1);
    const debugBuildType = gradle.match(/    buildTypes \{\n        debug \{[^}]+\}/)?.[0];
    expect(debugBuildType).toBeDefined();
    expect(result).toContain(debugBuildType!);
    expect(result).toContain('minifyEnabled enableMinifyInReleaseBuilds');
    expect(applyReleaseSigning(result)).toBe(result);
  });

  it('requires all four properties and a real file, otherwise warns and uses debug signing', () => {
    const result = applyReleaseSigning(gradle);
    expect(result).toContain('releaseStoreFile?.isFile() && releaseKeyAlias && releaseStorePassword && releaseKeyPassword');
    expect(result).toContain(`if (hasReleaseSigning) {
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
                logger.warn('Buseta Ya: release keystore not configured, using debug signing')
            }`);
  });

  it('adds only property names as string literals in the signing configuration', () => {
    const addedSigning = applyReleaseSigning(gradle).split('    signingConfigs {')[0];
    expect(addedSigning.match(/['"][^'"]*['"]/g)).toEqual([
      "'BUSETA_RELEASE_STORE_FILE'",
      "'BUSETA_RELEASE_KEY_ALIAS'",
      "'BUSETA_RELEASE_STORE_PASSWORD'",
      "'BUSETA_RELEASE_KEY_PASSWORD'",
    ]);
    expect(addedSigning.match(/project\.findProperty\(/g)).toHaveLength(4);
  });
});
