import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { applyReleaseSigning } from '../plugins/withReleaseSigning';

const gradle = readFileSync(new URL('./fixtures/expo-app.build.gradle', import.meta.url), 'utf8');

describe('release signing Gradle transform', () => {
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
