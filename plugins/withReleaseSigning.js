const { withAppBuildGradle } = require('expo/config-plugins');

const marker = '// Buseta Ya release signing';
const signingConfigsStart = /^    signingConfigs \{/m;
const stockReleaseSigning = /(^    buildTypes \{\r?\n[\s\S]*?^        release \{\r?\n)(?:            \/\/[^\r\n]*\r?\n)*            signingConfig signingConfigs\.debug(?=\r?$)/m;

function applyReleaseSigning(contents) {
  if (contents.includes(marker)) return contents;
  if (!signingConfigsStart.test(contents) || !stockReleaseSigning.test(contents)) {
    throw new Error('Buseta Ya: expected Expo signing blocks not found in app/build.gradle');
  }

  const lineEnding = contents.includes('\r\n') ? '\r\n' : '\n';
  const lines = (block) => block.replaceAll('\n', lineEnding);

  return contents
    .replace(signingConfigsStart, lines(`    ${marker}
    def releaseStorePath = project.findProperty('BUSETA_RELEASE_STORE_FILE')
    def releaseKeyAlias = project.findProperty('BUSETA_RELEASE_KEY_ALIAS')
    def releaseStorePassword = project.findProperty('BUSETA_RELEASE_STORE_PASSWORD')
    def releaseKeyPassword = project.findProperty('BUSETA_RELEASE_KEY_PASSWORD')
    def releaseStoreFile = releaseStorePath ? project.file(releaseStorePath) : null
    def hasReleaseSigning = releaseStoreFile?.isFile() && releaseKeyAlias && releaseStorePassword && releaseKeyPassword

    signingConfigs {
        release {
            if (hasReleaseSigning) {
                storeFile = releaseStoreFile
                keyAlias = releaseKeyAlias
                storePassword = releaseStorePassword
                keyPassword = releaseKeyPassword
            }
        }`))
    .replace(stockReleaseSigning, (_, releaseStart) => releaseStart + lines(`            if (hasReleaseSigning) {
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
                logger.warn('Buseta Ya: release keystore not configured, using debug signing')
            }`));
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('Buseta Ya: release signing requires a Groovy app/build.gradle');
    }
    config.modResults.contents = applyReleaseSigning(config.modResults.contents);
    return config;
  });
}

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;
